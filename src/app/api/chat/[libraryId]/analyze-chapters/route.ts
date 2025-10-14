import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'

// Einfache Heuristik-basierte Kapitelanalyse auf Markdown-Basis.
// Ziel: Stabiler, deterministischer Output ohne externe Python-Abhängigkeiten.

interface ChapterOut {
  chapterId: string
  title: string
  level: number
  startOffset: number
  endOffset: number
  startPage?: number
  endPage?: number
  evidence: string
  summary?: string
  keywords?: string[]
  pageCount?: number
}

const chapterInSchema = z.object({
  title: z.string().optional(),
  level: z.number().optional(),
  order: z.number().optional(),
  startPage: z.number().optional(),
  endPage: z.number().optional(),
  pageCount: z.number().optional(),
  startEvidence: z.string().optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional()
})

const bodySchema = z.object({
  fileId: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['heuristic', 'llm']).default('heuristic'),
  chaptersIn: z.array(chapterInSchema).optional()
})

function hashStable(input: string): string {
  let h = 2166136261 >>> 0 // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `h${(h >>> 0).toString(36)}`
}

function analyzeHeuristic(markdown: string): { chapters: ChapterOut[]; toc: Array<{ title: string; level: number; page?: number }> } {
  const chapters: ChapterOut[] = []
  const toc: Array<{ title: string; level: number; page?: number }> = []

  // Page-Anker: <!--page:12--> oder Zeilen wie "— Seite 3 —"
  const pageAnchors: Array<{ idx: number; page: number }> = []
  {
    const re = /(<!--\s*page\s*:\s*(\d+)\s*-->)|^\s*[\u2013\u2014\-\u2212\s]*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212\s]*$/gim
    let m: RegExpExecArray | null
    while ((m = re.exec(markdown))) {
      const pageNo = Number(m[2] || m[3])
      pageAnchors.push({ idx: m.index, page: pageNo })
    }
  }

  // Heading-Kandidaten
  type Cand = { level: number; title: string; idx: number; evidence: string }
  const cands: Cand[] = []

  const lines = markdown.split(/\n/)
  let offset = 0
  for (const line of lines) {
    // Markdown-Heading #, ##, ###
    const m1 = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (m1) {
      const level = m1[1].length
      const title = m1[2].trim()
      cands.push({ level, title, idx: offset, evidence: line.trim().slice(0, 160) })
    } else {
      // Nummerierte Gliederung am Zeilenanfang (z. B. 1. oder 1.2.3)
      const m2 = /^(?:\d+[.)])(?:\s+\d+[.)])*\s+(.+?)\s*$/.exec(line)
      if (m2) {
        const title = m2[1].trim()
        const prefix = line.split(title)[0]
        const level = Math.max(1, Math.min(3, (prefix.match(/\d+[.)]/g) || []).length))
        cands.push({ level, title, idx: offset, evidence: line.trim().slice(0, 160) })
      }
    }
    offset += line.length + 1 // +1 für Newline
  }

  // TOC-Heuristik: Abschnitt nach Überschrift "Inhalt|Inhaltsverzeichnis|Contents"
  {
    const tocHeader = /(#{1,6})\s*(inhalt|inhaltsverzeichnis|contents)\b/i
    const i = markdown.search(tocHeader)
    if (i >= 0) {
      const end = markdown.indexOf('\n\n', i) >= 0 ? markdown.indexOf('\n\n', i) : Math.min(markdown.length, i + 4000)
      const region = markdown.slice(i, end)
      const lines = region.split(/\n/)
      for (const ln of lines) {
        const t = ln.trim()
        // Unterstütze Dot-Leaders, Unicode-Ellipsis … (\u2026) und größere Lücken
        const m = /^(.*?)(?:\.{2,}|\u2026+|\s{3,})\s*(\d{1,4})\s*$/.exec(t)
        if (m) {
          toc.push({ title: m[1].trim(), level: 1, page: Number(m[2]) })
          continue
        }
        // Nummerierte TOC-Einträge (z. B. 2.1 Titel … 12)
        const m2 = /^(\d+(?:\.\d+)*)\s+(.+?)\s*(\d{1,4})$/.exec(t)
        if (m2) {
          const lvl = Math.max(1, Math.min(3, m2[1].split('.').length))
          toc.push({ title: m2[2].trim(), level: lvl, page: Number(m2[3]) })
        }
      }
    }
  }

  // Kapitel bilden (Level bis 3)
  const filtered = cands.filter(c => c.level <= 3)
  filtered.sort((a, b) => a.idx - b.idx)
  const docLen = markdown.length
  for (let i = 0; i < filtered.length; i++) {
    const cur = filtered[i]
    const nextIdx = i + 1 < filtered.length ? filtered[i + 1].idx : docLen
    const startPage = (() => {
      let p: number | undefined
      for (let j = 0; j < pageAnchors.length; j++) {
        if (pageAnchors[j].idx <= cur.idx) p = pageAnchors[j].page
        else break
      }
      return p
    })()
    const endPage = (() => {
      let p: number | undefined
      for (let j = 0; j < pageAnchors.length; j++) {
        if (pageAnchors[j].idx < nextIdx) p = pageAnchors[j].page
        else break
      }
      return p
    })()
    const id = hashStable(`${cur.title.toLowerCase()}|${cur.idx}`)
    chapters.push({
      chapterId: id,
      title: cur.title,
      level: cur.level,
      startOffset: cur.idx,
      endOffset: Math.max(cur.idx, nextIdx - 1),
      startPage,
      endPage,
      evidence: cur.evidence
    })
  }

  // Fallback: Seiten via TOC mappen, falls kein Seitenanker oder fehlend
  if (toc.length > 0) {
    const norm = (s: string) => s
      .toLowerCase()
      // führende Nummerierung entfernen: "2.1.3 ", "2) ", "2- "
      .replace(/^\s*(?:\d+(?:\.\d+)*)(?:\s+|\s*[-.)])\s*/, '')
      // typografische Striche/Anführungen normalisieren
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/["'„”“‚’]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const tocNorm = toc.map(t => ({ ...t, n: norm(t.title) }))

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i]
      if (typeof ch.startPage === 'number') continue
      const nc = norm(ch.title)
      // bestes Match: startsWith in beide Richtungen, sonst includes
      let hit = tocNorm.find(t => t.n.startsWith(nc) || nc.startsWith(t.n))
      if (!hit) hit = tocNorm.find(t => t.n.includes(nc) || nc.includes(t.n))
      if (hit?.page) ch.startPage = hit.page
    }
    for (let i = 0; i < chapters.length; i++) {
      const nextStart = chapters[i + 1]?.startPage
      if (typeof chapters[i].endPage !== 'number' && typeof nextStart === 'number') {
        chapters[i].endPage = Math.max(nextStart - 1, chapters[i].startPage ?? nextStart - 1)
      }
    }
  }

  return { chapters, toc }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const internalBypass = (() => {
      const t = request.headers.get('x-internal-token') || request.headers.get('X-Internal-Token')
      const env = process.env.INTERNAL_TEST_TOKEN || ''
      if (t && env && t === env) return true
      // Zusätzlicher Bypass für interne Job-Aufrufe
      const jobHdr = request.headers.get('x-external-job') || request.headers.get('X-External-Job')
      return typeof jobHdr === 'string' && jobHdr.length > 0
    })()
    if (!internalBypass) {
      const { userId } = await auth()
      const user = await currentUser()
      const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    const { fileId, content, mode, chaptersIn } = parsed.data

    // Gemeinsame Normalisierung: Kapitelseiten lückenlos, führende Lücken → "Inhalt", interne Lücken → vorheriges Kapitel verlängern
    function normalizeChaptersByPages(
      markdownAll: string,
      chaptersIn: ChapterOut[],
      pageAnchors: Array<{ idx: number; page: number }>
    ): { chapters: ChapterOut[]; totalPages: number } {
      const anchors = [...pageAnchors].sort((a, b) => a.idx - b.idx)
      const totalPages = anchors.length > 0 ? anchors[anchors.length - 1].page : 1
      type PageSeg = { page: number; start: number; end: number }
      const segs: PageSeg[] = []
      if (anchors.length === 0) {
        segs.push({ page: 1, start: 0, end: markdownAll.length })
      } else {
        for (let i = 0; i < anchors.length; i++) {
          const start = anchors[i].idx
          const end = i + 1 < anchors.length ? anchors[i + 1].idx : markdownAll.length
          segs.push({ page: anchors[i].page, start, end })
        }
      }

      const firstWords = (s: string, n: number) => s.split(/\s+/).filter(Boolean).slice(0, n).join(' ')
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const buildEvidenceRegex = (snippet: string) => {
        const words = firstWords(snippet, 10)
          .normalize('NFKD')
          .replace(/[\p{P}\p{S}]+/gu, ' ')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map(escapeRegExp)
        if (words.length === 0) return null
        return new RegExp(words.join('\\W+'), 'i')
      }

      // Tiefe Kopie und Startseiten ggf. via Evidence ermitteln
      const chapters = chaptersIn.map(c => ({ ...c }))
      for (let i = 0; i < chapters.length; i++) {
        const c = chapters[i]
        if (typeof c.startPage !== 'number' || !(c.startPage >= 1)) {
          const rx = c.evidence ? buildEvidenceRegex(c.evidence) : null
          if (rx) {
            for (const s of segs) {
              const txt = markdownAll.slice(s.start, s.end)
              if (rx.test(txt)) { c.startPage = s.page; break }
            }
          }
          if (typeof c.startPage !== 'number' || !(c.startPage >= 1)) {
            // Fallback: an vorherigen Anschluss hängen oder auf 1 setzen
            const prev = i > 0 ? chapters[i - 1] : undefined
            c.startPage = typeof prev?.endPage === 'number' && prev.endPage >= 1 ? prev.endPage + 1 : 1
          }
        }
      }

      // Nach Startseite sortieren (stabil)
      chapters.sort((a, b) => (a.startPage ?? 1) - (b.startPage ?? 1))

      // Endseiten ableiten und klemmen
      for (let i = 0; i < chapters.length; i++) {
        const cur = chapters[i]
        const next = chapters[i + 1]
        if (typeof cur.endPage !== 'number' || !(cur.endPage >= (cur.startPage ?? 1))) {
          const nextStart = typeof next?.startPage === 'number' ? next.startPage : undefined
          cur.endPage = typeof nextStart === 'number' ? Math.max((cur.startPage ?? 1), nextStart - 1) : (cur.startPage ?? 1)
        }
        // Klemmen auf [1..totalPages]
        cur.startPage = Math.max(1, Math.min(totalPages, cur.startPage ?? 1))
        cur.endPage = Math.max(cur.startPage, Math.min(totalPages, cur.endPage ?? cur.startPage))
      }

      // Führende Lücke: Kapitel "Inhalt"
      const first = chapters[0]
      const addHead = !first || (typeof first.startPage === 'number' && first.startPage > 1)
      if (addHead) {
        const headEnd = first ? Math.max(1, (first.startPage as number) - 1) : totalPages
        chapters.unshift({
          chapterId: hashStable('inhalt|1'),
          title: 'Inhalt',
          level: 1,
          startOffset: 0,
          endOffset: 0,
          startPage: 1,
          endPage: headEnd,
          evidence: ''
        })
      }

      // Interne Lücken schließen durch Verlängerung des vorherigen Kapitels
      for (let i = 0; i < chapters.length - 1; i++) {
        const cur = chapters[i]
        const next = chapters[i + 1]
        if ((cur.endPage as number) < (next.startPage as number) - 1) {
          cur.endPage = (next.startPage as number) - 1
          cur.pageCount = (next.startPage as number) - (cur.startPage as number)
        }
      }

      // Schluss an Dokumentende ziehen
      const last = chapters[chapters.length - 1]
      if (last && (last.endPage as number) < totalPages) last.endPage = totalPages

      return { chapters, totalPages }
    }

    // Pfad A: vorhandene Kapitel (Frontmatter) wurden mitgeliefert → als Quelle verwenden und lückenfrei normalisieren
    if (Array.isArray(chaptersIn) && chaptersIn.length > 0) {
      // Page-Anker extrahieren (wie in analyzeHeuristic)
      const anchors: Array<{ idx: number; page: number }> = []
      {
        const re = /(<!--\s*page\s*:\s*(\d+)\s*-->)|^\s*[\u2013\u2014\-\u2212\s]*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212\s]*$/gim
        let m: RegExpExecArray | null
        while ((m = re.exec(content))) anchors.push({ idx: m.index, page: Number(m[2] || m[3]) })
      }

      // Eingehende Kapitel in ChapterOut überführen (vorhandene Seiten beibehalten)
      const toOut = (inp: { title?: string; level?: number; startPage?: number; endPage?: number; startEvidence?: string; summary?: string; keywords?: string[] }): ChapterOut | null => {
        if (!inp.title) return null
        const level = typeof inp.level === 'number' ? Math.max(1, Math.min(3, inp.level)) : 1
        const ev = typeof inp.startEvidence === 'string' ? inp.startEvidence.slice(0, 160) : ''
        const startOffset = ev ? content.indexOf(ev) : -1
        return {
          chapterId: hashStable(`${inp.title.toLowerCase()}|${Math.max(0, startOffset)}`),
          title: inp.title.trim(),
          level,
          startOffset: Math.max(0, startOffset),
          endOffset: Math.max(0, startOffset),
          startPage: typeof inp.startPage === 'number' ? inp.startPage : undefined,
          endPage: typeof inp.endPage === 'number' ? inp.endPage : undefined,
          evidence: ev,
          summary: typeof inp.summary === 'string' ? inp.summary.slice(0, 1000) : undefined,
          keywords: Array.isArray(inp.keywords) ? inp.keywords.filter(k => typeof k === 'string').slice(0, 12) : undefined,
        }
      }
      const seedChapters: ChapterOut[] = chaptersIn.map(toOut).filter(Boolean) as ChapterOut[]
      const norm = normalizeChaptersByPages(content, seedChapters, anchors)
      // Optional: TOC aus Inhalt heuristisch ermitteln, um UI zu versorgen
      const { toc } = analyzeHeuristic(content)
      return NextResponse.json({ ok: true, libraryId, fileId, mode: 'heuristic', result: { chapters: norm.chapters, toc, stats: { chapterCount: norm.chapters.length, pages: norm.totalPages } } })
    }

    if (mode === 'heuristic') {
      const { chapters, toc } = analyzeHeuristic(content)
      // Page-Anker erneut bestimmen (ident wie oben in analyzeHeuristic)
      const anchors: Array<{ idx: number; page: number }> = []
      {
        const re = /(<!--\s*page\s*:\s*(\d+)\s*-->)|^\s*[\u2013\u2014\-\u2212\s]*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212\s]*$/gim
        let m: RegExpExecArray | null
        while ((m = re.exec(content))) anchors.push({ idx: m.index, page: Number(m[2] || m[3]) })
      }
      const norm = normalizeChaptersByPages(content, chapters, anchors)
      return NextResponse.json({ ok: true, libraryId, fileId, mode, result: { chapters: norm.chapters, toc, stats: { chapterCount: norm.chapters.length, pages: norm.totalPages } } })
    }

    // LLM-basierte Analyse (extraktiv, streng JSON)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4.1'

    // Seitenanker vorher extrahieren, um spaeter Seiten zuzuordnen
    const pageAnchors: Array<{ idx: number; page: number }> = []
    {
      const re = /(?:<!--\s*page\s*:\s*(\d+)\s*-->)|^(?:[\-\\s]*?[\u2013\u2014\-\u2212]?\s*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212]?)$/gim
      let m: RegExpExecArray | null
      while ((m = re.exec(content))) {
        const pageNo = Number(m[1] || m[2])
        pageAnchors.push({ idx: m.index, page: pageNo })
      }
      pageAnchors.sort((a, b) => a.idx - b.idx)
    }

    //const charBudget = 120_000
    //const text = content.length > charBudget ? content.slice(0, charBudget) : content
    const text = content
    const system = 'Du extrahierst Kapitel aus gegebenem Volltext. Du bist strikt EXTRAKTIV und erfindest nichts.'
    const userPrompt = `Aufgabe: Erkenne Kapitel- und Unterkapitelstarts (Level 1..3) im folgenden OCR/Markdown-Text UND liefere pro erkanntem Kapitel eine kompakte, EXTRAKTIVE Summary.
Antworte ausschließlich als kompaktes JSON ohne Kommentare.

Anforderungen:
- Gib nur Kapitel/Unterkapitel zurück, die EXAKT im Text vorkommen.
- Für jedes Kapitel liefere:
  - title (string)
  - level (1..3)
  - startEvidence (<=160 Zeichen, genau wie im Text am Kapitelstart vorkommend)
  - summary (max 1000 Zeichen, extraktiv: nur Inhalte aus dem Bereich zwischen diesem Kapitelstart und dem nächsten Kapitelstart; wenn unklar, leere Zeichenkette)
  - keywords (5-12 kurze Stichwörter, optional)
- Optional: toc (Liste von { title, page?, level? }) falls erkennbar. TOC-Titel dürfen nur Kapitel referenzieren, die im Text vorkommen.
- KEIN weiterer Text in der Antwort, nur JSON.

Beispiel-Response:
{"chapters":[{"title":"Einleitung","level":1,"startEvidence":"1 EINLEITUNG und AUFGABENSTELLUNG","summary":"…","keywords":["Ziel","Gebiet","Methode"]}],"toc":[{"title":"Einleitung","page":3,"level":1}]}

Text (ggf. gekürzt):\n\n${text}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ]
      })
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `OpenAI Chat Fehler: ${res.status} ${err.slice(0, 300)}` }, { status: 502 })
    }
    const raw = await res.text()
    let outUnknown: unknown
    try {
      outUnknown = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }
    let contentJson: string | undefined
    if (outUnknown && typeof outUnknown === 'object') {
      const maybe = outUnknown as { choices?: Array<{ message?: { content?: unknown } }> }
      const c = maybe.choices?.[0]?.message?.content
      if (typeof c === 'string') contentJson = c
    }
    if (!contentJson) {
      return NextResponse.json({ error: 'LLM JSON ungültig', details: String((contentJson as unknown) ?? '').slice(0, 400) }, { status: 502 })
    }
    let parsedJsonUnknown: unknown
    try {
      parsedJsonUnknown = JSON.parse(contentJson)
    } catch {
      return NextResponse.json({ error: 'LLM JSON ungültig', details: String(contentJson).slice(0, 400) }, { status: 502 })
    }

    const root = (parsedJsonUnknown && typeof parsedJsonUnknown === 'object') ? parsedJsonUnknown as Record<string, unknown> : {}
    const chaptersRaw: Array<{ title?: string; level?: number; startEvidence?: string; summary?: string; keywords?: string[] }>
      = Array.isArray((root as { chapters?: unknown }).chapters) ? (root as { chapters?: Array<{ title?: string; level?: number; startEvidence?: string; summary?: string; keywords?: string[] }> }).chapters! : []
    const tocRaw: Array<{ title?: string; page?: number; level?: number }>
      = Array.isArray((root as { toc?: unknown }).toc) ? (root as { toc?: Array<{ title?: string; page?: number; level?: number }> }).toc! : []

    const chapters: ChapterOut[] = []
    const findPage = (idx: number): number | undefined => {
      let p: number | undefined
      for (let i = 0; i < pageAnchors.length; i++) {
        if (pageAnchors[i].idx <= idx) p = pageAnchors[i].page
        else break
      }
      return p
    }

    // Verifikation: evidence muss im Text vorkommen
    for (const c of chaptersRaw) {
      if (!c?.title || !c?.startEvidence) continue
      const level = typeof c.level === 'number' ? Math.max(1, Math.min(3, c.level)) : 1
      const ev = c.startEvidence.slice(0, 160)
      const idx = content.indexOf(ev)
      if (idx < 0) continue
      chapters.push({
        chapterId: hashStable(`${c.title.toLowerCase()}|${idx}`),
        title: c.title.trim(),
        level,
        startOffset: idx,
        endOffset: idx, // vorerst; unten korrigieren
        startPage: findPage(idx),
        evidence: ev,
        summary: typeof c.summary === 'string' ? c.summary.slice(0, 1000) : undefined,
        keywords: Array.isArray(c.keywords) ? c.keywords.filter(k => typeof k === 'string').slice(0, 12) : undefined
      })
    }
    chapters.sort((a, b) => a.startOffset - b.startOffset)
    for (let i = 0; i < chapters.length; i++) {
      const next = i + 1 < chapters.length ? chapters[i + 1].startOffset : content.length
      chapters[i].endOffset = Math.max(chapters[i].startOffset, next - 1)
      const endPageIdx = chapters[i].endOffset
      chapters[i].endPage = ((): number | undefined => {
        let p: number | undefined
        for (let j = 0; j < pageAnchors.length; j++) {
          if (pageAnchors[j].idx <= endPageIdx) p = pageAnchors[j].page
          else break
        }
        return p
      })()
    }

    const toc = tocRaw
      .filter(t => typeof t?.title === 'string')
      .map(t => ({ title: (t.title as string).trim(), page: typeof t.page === 'number' ? t.page : undefined, level: typeof t.level === 'number' ? Math.max(1, Math.min(3, t.level)) : 1 }))

    // Page‑Anker (LLM‑Pfad) – identisch zur Heuristik‑Suche (separat oben)
    const anchors: Array<{ idx: number; page: number }> = []
    {
      const re = /(?:<!--\s*page\s*:\s*(\d+)\s*-->)|^(?:[\x10-\x7f\s]*?[\u2013\u2014\-\u2212]?\s*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212]?)/gim
      let m: RegExpExecArray | null
      while ((m = re.exec(content))) anchors.push({ idx: m.index, page: Number(m[1] || m[2]) })
    }

    const norm = normalizeChaptersByPages(content, chapters, anchors)
    return NextResponse.json({ ok: true, libraryId, fileId, mode, result: { chapters: norm.chapters, toc, stats: { chapterCount: norm.chapters.length, pages: norm.totalPages } } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



