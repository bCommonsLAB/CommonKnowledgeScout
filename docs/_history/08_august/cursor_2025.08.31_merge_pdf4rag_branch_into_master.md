# Merge pdf4rag branch into master
_Exported on 10/9/2025 at 14:57:19 GMT+2 from Cursor (1.7.38)_

---

**User**

Ich möchte den github pdf4rag-branch in den Master-Branch mergen. Ein Pull-Request-Start. Es wird einige Merge-Konflikte geben. Können wir das analysieren, gemeinsam?

---

**Cursor**

Ich hole zuerst die neuesten Änderungen und prüfe den Zustand beider Branches. Danach versuche ich einen konfliktfreien Test-Merge von `master` in `pdf4rag` (ohne Commit), um die Konfliktliste zu extrahieren, und breche ihn anschließend wieder ab.

Ich starte mit einer kleinen Aufgabenliste und beginne mit dem Test-Merge, um die Konflikte exakt zu identifizieren.

Ich wechsle korrekt auf `master`, ziehe `origin/master`, aktualisiere `pdf4rag`, führe einen No-Commit-Merge von `pdf4rag` in `master` aus, liste Konflikte und breche den Merge wieder ab.

---

**User**

ok, wie gehts weiter?

---

**Cursor**

Ich wechsle auf `pdf4rag`, aktualisiere ihn und führe einen Test-Merge von `master` in `pdf4rag` aus, um Konflikte zu ermitteln; danach liste ich die Konfliktdateien und breche den Merge wieder ab.

Ich habe den Merge von `master` in `pdf4rag` testweise durchgeführt; es gab keine Konflikte. Ich prüfe jetzt Build/Lint/Tests im gemergten Zustand und werde anschließend den Merge committen und pushen.

Ich prüfe die verfügbaren Skripte, um den Build gezielt auf Root auszuführen und das fehlerhafte rekursive Bauen des `dist`-Ordners zu vermeiden. Danach starte ich den Build nur für das Root-Paket.

Ich starte jetzt Build, Lint und Tests im Root-Paket (ohne rekursiv in `dist/` zu bauen).

Ich committe den Merge-Zustand auf `pdf4rag`, pushe den Branch und versuche anschließend, einen PR via GitHub-CLI zu eröffnen.

Ich prüfe die gestagten Dateien und ob die GitHub-CLI verfügbar ist. Anschließend bereinige ich ggf. die fehlerhafte Datei, committe den Merge und pushe.

Ich bereinige die eine seltsame, versehentlich hinzugefügte Datei, committe den Merge-Stand und pushe nach origin. Danach prüfe ich, ob ich einen PR via GitHub-CLI eröffnen kann.

Ich entferne die versehentlich gestagte Datei mit dem merkwürdigen Namen aus dem Index und Arbeitsbaum, committe den Merge und pushe nach origin. Danach prüfe ich, ob die GitHub-CLI vorhanden ist, um direkt einen PR zu erstellen.

Ich entferne die fehlerhafte, gestagte Datei automatisiert, committe den Merge-Stand und pushe auf `origin/pdf4rag`. Danach prüfe ich die Verfügbarkeit der GitHub-CLI und erstelle den PR.

Ich prüfe, ob wir noch im Merge-Zustand sind und breche ihn gegebenenfalls ab, um einen sauberen Auto-Merge von `master` in `pdf4rag` zu machen und danach zu committen/pushen. Anschließend checke ich die GitHub-CLI.

Ich beende den Merge mit einem Commit und pushe `pdf4rag` zum Remote, danach versuche ich den PR zu erstellen.

---

**User**

ok, habe jetzt pdf4rag committet und auf git gemerged und btanch gelöscht.  Irgendwie hat er da den Master in den PDF4Rec gemerged. Kann man das noch nachvollziehen? Auf alle Fälle habe ich diesen PDF4Rec Branch dann gelöscht. Ist der Master jetzt wirklich aktuell?

---

**Cursor**

Ich verifiziere jetzt den Zustand: ziehe `origin/master`, prüfe Merge-Historie und ob typische `pdf4rag`-Dateien auf `master` vorhanden sind.

Ich prüfe jetzt den Zustand von master: ich fetche, checke master aus, ziehe, prüfe die Historie und verifiziere, ob Commit a8fc1a4 in master enthalten ist. Danach baue ich, lintere und teste auf master.

Ich prüfe jetzt konkret, ob der Merge-Commit aus pdf4rag in master enthalten ist und führe danach Build/Lint/Tests auf master aus.

Kurzupdate: Ich habe verifiziert, dass der Merge aus pdf4rag in master enthalten ist und master baut, lintet und testet sauber.

Antworten auf deine Fragen:
- Ist nachvollziehbar, was passiert ist? Ja. In der Historie sieht man:
```text
* 0cf2872 (HEAD -> master, tag: v1.0.28, origin/master) Bump version to 1.0.28
*   64434b0 Merge pull request #5 from bCommonsLAB/pdf4rag
| *   a8fc1a4 (pdf4rag) Merge master into pdf4rag (pre-PR sync)
```
Der PR #5 hat `pdf4rag` in `master` gemerged. Davor wurde `master` in `pdf4rag` synchronisiert (Commit a8fc1a4). Das erklärt, warum es konfliktfrei war.

- Ist master aktuell? Ja.
  - `master` enthält den `pdf4rag`-Merge (PR-Commit 64434b0, Vorläufer a8fc1a4).
  - Build: ok, Lint: nur Warnungen, Tests: alle grün.
  - Tags: `v1.0.28` ist auf dem aktuellen Head.

Empfehlung:
- Falls gewünscht, den gelöschten Remote-Branch `origin/pdf4rag` ist bereits entfernt. Lokale Aufräumung ist erledigt.
- Optional: Lint-Warnungen in den betroffenen Komponenten später angehen, ist aber kein Blocker.

Wenn du willst, kann ich noch:
- Release-Notes für `v1.0.28` kurz zusammenstellen.
- Einen Hotfix-Branch für die Hook-Dependency-Warnungen vorbereiten.

```plaintext
* 0cf2872 (HEAD -> master, tag: v1.0.28, origin/master) Bump version to 1.0.28
*   64434b0 Merge pull request #5 from bCommonsLAB/pdf4rag
| *   a8fc1a4 (pdf4rag) Merge master into pdf4rag (pre-PR sync)
```

---

**User**

ich möchte noch den chatbot branch in master mergen. wie gehen wir vor?

---

**Cursor**

Ich prüfe jetzt, ob es einen Branch `chatbot` gibt, wechsle darauf und synchronisiere ihn. Danach mache ich einen Test-Merge von `master` in `chatbot`, um Konflikte zu erkennen.

Ich führe einen Test-Merge von master in chatbot aus, um Konflikte zu erkennen. Danach baue/linte/teste, committe den Sync und pushe, und erstelle anschließend einen PR von chatbot nach master.

Ich starte jetzt Build, Lint und Tests auf dem gemergten chatbot-Stand, committe anschließend den Merge und pushe. Danach versuche ich, einen PR via GitHub-CLI zu erstellen.

Ich öffne die betroffenen Dateien parallel, um die Lint-Fehler gezielt zu beheben. Danach führe ich Build/Lint erneut aus.

Ich behebe jetzt die Lint-Fehler in den genannten Dateien und führe danach Build/Lint erneut aus.

```typescript
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
}

const bodySchema = z.object({
  fileId: z.string().min(1),
  content: z.string().min(1),
  mode: z.enum(['heuristic', 'llm']).default('heuristic')
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
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    const { fileId, content, mode } = parsed.data

    if (mode === 'heuristic') {
      const { chapters, toc } = analyzeHeuristic(content)
      return NextResponse.json({ ok: true, libraryId, fileId, mode, result: { chapters, toc, stats: { chapterCount: chapters.length } } })
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

    return NextResponse.json({ ok: true, libraryId, fileId, mode, result: { chapters, toc, stats: { chapterCount: chapters.length } } })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}




```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { describeIndex, fetchVectors, queryVectors } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { LibraryService } from '@/lib/services/library-service'
import { getVectorIndexForLibrary } from '@/lib/chat/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const url = new URL(request.url)
    const fileId = url.searchParams.get('fileId')
    const docModifiedAt = url.searchParams.get('docModifiedAt') || undefined
    const noFallback = url.searchParams.get('noFallback') === '1'
    if (!fileId) return NextResponse.json({ error: 'fileId erforderlich' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ status: 'not_indexed' })

    // Hole Meta-Vektor (doc)
    const ids = [`${fileId}-meta`]
    let lookupMethod: 'id' | 'other-index' | 'filter' | 'none' = 'none'
    let foundId: string | undefined
    const fetched = await fetchVectors(idx.host, apiKey, ids, '')
    let meta = fetched[`${fileId}-meta`]?.metadata as Record<string, unknown> | undefined
    if (meta) lookupMethod = 'id'

    // Fallback: Durchsuche andere Library-Indizes des Nutzers (falls Upsert in anderer Library passiert ist)
    if (!meta && !noFallback) {
      const libService = LibraryService.getInstance()
      const libs = await libService.getUserLibraries(userEmail)
      for (const lib of libs) {
        const altIndex = getVectorIndexForLibrary({ id: lib.id, label: lib.label }, lib.config?.chat, userEmail)
        if (altIndex === ctx.vectorIndex) continue
        const alt = await describeIndex(altIndex, apiKey)
        if (!alt?.host) continue
        try {
          const fx = await fetchVectors(alt.host, apiKey, ids, '')
          const m = fx[`${fileId}-meta`]?.metadata as Record<string, unknown> | undefined
          if (m) { meta = m; lookupMethod = 'other-index'; foundId = `${fileId}-meta`; break }
        } catch { /* ignore */ }
      }
    }
    // Zweiter Fallback: gefilterte Query nach fileId/kind='doc' (falls ID-Bildung abweicht)
    if (!meta && !noFallback) {
      try {
        const zero = new Array<number>(3072).fill(0)
        const byFilter = await queryVectors(idx.host, apiKey, zero, 1, {
          user: { $eq: userEmail },
          libraryId: { $eq: libraryId },
          fileId: { $eq: fileId },
          kind: { $eq: 'doc' }
        })
        meta = (byFilter[0]?.metadata ?? undefined) as Record<string, unknown> | undefined
        foundId = byFilter[0]?.id
        if (meta) lookupMethod = 'filter'
      } catch { /* ignore */ }
    }
    if (!meta) {
      return NextResponse.json({ status: 'not_indexed' })
    }

    const upsertedAt = typeof meta?.upsertedAt === 'string' ? meta.upsertedAt : undefined
    const chunkCount = typeof meta?.chunkCount === 'number' ? meta.chunkCount : undefined
    const fileName = typeof meta?.fileName === 'string' ? meta.fileName : undefined
    const storedDocMod = typeof meta?.docModifiedAt === 'string' ? meta.docModifiedAt : undefined
    const isStale = !!(docModifiedAt && storedDocMod && new Date(storedDocMod).getTime() < new Date(docModifiedAt).getTime())

    return NextResponse.json({
      status: isStale ? 'stale' : 'ok',
      fileId,
      fileName,
      chunkCount,
      upsertedAt,
      docModifiedAt: storedDocMod,
      docMeta: typeof meta?.docMetaJson === 'string' ? JSON.parse(meta.docMetaJson as string) : undefined,
      toc: typeof meta?.tocJson === 'string' ? JSON.parse(meta.tocJson as string) : undefined,
      _debug: { lookupMethod, expectedId: `${fileId}-meta`, foundId }
    })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, queryVectors, fetchVectors } from '@/lib/chat/pinecone'

const chatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  answerLength: z.enum(['kurz','mittel','ausführlich']).default('mittel')
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // Auth prüfen oder public zulassen (abhängig von Config)
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    // Fallback: erlauben wir public nur, wenn Chat public konfiguriert ist
    const emailForLoad = userEmail || request.headers.get('X-User-Email') || ''

    if (!emailForLoad) {
      // Wir laden trotzdem, um public-Flag zu prüfen
      // Wenn kein userEmail vorliegt und Chat nicht public ist → 401
    }

    const ctx = await loadLibraryChatContext(emailForLoad, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    if (!ctx.chat.public && !userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Body validieren
    const json = await request.json().catch(() => ({}))
    const body = chatRequestSchema.safeParse(json)
    if (!body.success) {
      return NextResponse.json({ error: 'Ungültige Anfrage', details: body.error.flatten() }, { status: 400 })
    }

    const { message, answerLength } = body.data

    // Embedding der Nutzerfrage
    const [qVec] = await embedTexts([message])

    // Pinecone Query
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    const baseTopK = 20
    // Retriever standardmäßig auf Kapitel-Summaries umstellen
    const matches = await queryVectors(idx.host, apiKey, qVec, baseTopK, {
      user: { $eq: userEmail || '' },
      libraryId: { $eq: libraryId },
      kind: { $eq: 'chapterSummary' }
    })
    const scoreMap = new Map<string, number>()
    for (const m of matches) scoreMap.set(m.id, typeof m.score === 'number' ? m.score : 0)

    // Nachbarn sammeln (±w)
    const windowByLength = answerLength === 'ausführlich' ? 3 : answerLength === 'mittel' ? 2 : 1
    const idSet = new Set<string>()
    const parseId = (id: string) => {
      const idx = id.lastIndexOf('-')
      if (idx < 0) return { base: id, chunk: NaN }
      return { base: id.slice(0, idx), chunk: Number(id.slice(idx+1)) }
    }
    const toId = (base: string, chunk: number) => `${base}-${chunk}`
    for (const m of matches) {
      const { base, chunk } = parseId(m.id)
      if (!Number.isFinite(chunk)) { idSet.add(m.id); continue }
      for (let d = -windowByLength; d <= windowByLength; d++) {
        idSet.add(toId(base, chunk + d))
      }
    }
    const ids = Array.from(idSet)
    const fetched = await fetchVectors(idx.host, apiKey, ids)
    const vectorRows = ids
      .map(id => ({ id, score: scoreMap.get(id) ?? 0, meta: fetched[id]?.metadata }))
      .filter(r => r.meta)
      .sort((a, b) => (b.score - a.score))

    // Budget nach answerLength
    const baseBudget = answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
    let charBudget = baseBudget
    let sources: Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }> = []
    let used = 0
    for (const r of vectorRows) {
      const t = typeof r.meta!.text === 'string' ? (r.meta!.text as string) : ''
      if (!t) continue
      const fileName = typeof r.meta!.fileName === 'string' ? (r.meta!.fileName as string) : undefined
      const chunkIndex = typeof r.meta!.chunkIndex === 'number' ? (r.meta!.chunkIndex as number) : undefined
      const score = r.score
      if (used + t.length > charBudget) break
      sources.push({ id: r.id, score, fileName, chunkIndex, text: t })
      used += t.length
    }

    // Fallback: Wenn keine Quellen aus fetchVectors, versuche Matches-Metadaten zu verwenden
    if (sources.length === 0) {
      let acc = 0
      const fallback: typeof sources = []
      for (const m of matches) {
        const meta = (m?.metadata ?? {}) as Record<string, unknown>
        const t = typeof meta.text === 'string' ? meta.text as string : ''
        if (!t) continue
        const fileName = typeof meta.fileName === 'string' ? meta.fileName as string : undefined
        const chunkIndex = typeof meta.chunkIndex === 'number' ? meta.chunkIndex as number : undefined
        const score = m.score
        const snippet = t.slice(0, 1000)
        const len = snippet.length
        if (acc + len > charBudget) break
        fallback.push({ id: String(m.id), score, fileName, chunkIndex, text: snippet })
        acc += len
      }
      if (fallback.length > 0) {
        sources = fallback
      } else {
        // Als letzte Option: Nur Treffer zurückgeben (z. B. bei sehr alten Daten ohne Text)
        return NextResponse.json({
          status: 'ok',
          libraryId,
          vectorIndex: ctx.vectorIndex,
          results: matches,
        })
      }
    }

    // Kontext bauen
    const buildContext = (srcs: typeof sources, perSnippetLimit = 800) => srcs
      .map((s, i) => `Quelle [${i + 1}] ${s.fileName ?? s.id} (Chunk ${s.chunkIndex ?? '-'}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`)
      .join('\n\n')
    let context = buildContext(sources)

    // OpenAI Chat Call
    const chatApiKey = process.env.OPENAI_API_KEY
    if (!chatApiKey) return NextResponse.json({ error: 'OPENAI_API_KEY fehlt' }, { status: 500 })
    const model = process.env.OPENAI_CHAT_MODEL_NAME || 'gpt-4o-mini'
    const temperature = Number(process.env.OPENAI_CHAT_TEMPERATURE ?? 0.3)

    // Stilvorgaben je nach gewünschter Antwortlänge
    const styleInstruction = answerLength === 'ausführlich'
      ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter): Beginne mit 1–2 Sätzen Zusammenfassung, danach Details in Absätzen oder Stichpunkten. Vermeide Füllwörter.'
      : answerLength === 'mittel'
      ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter): 3–6 Sätze oder eine kurze Liste der wichtigsten Punkte. Direkt und präzise.'
      : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter). Keine Einleitung, direkt die Kernaussage.'

    const prompt = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- ${styleInstruction}\n- Fachlich korrekt, ohne Spekulationen.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`

    const callChat = async (currPrompt: string) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${chatApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: 'Du bist ein hilfreicher, faktenbasierter Assistent.' },
            { role: 'user', content: currPrompt }
          ]
        })
      })
      return res
    }

    // Optionales Server-Debugging: nur aktiv, wenn der Client X-Debug: 1 sendet oder nicht production
    const debug = request.headers.get('X-Debug') === '1' || process.env.NODE_ENV !== 'production'
    if (debug) {
      const usedChars = sources.reduce((sum, s) => sum + (s.text?.length ?? 0), 0)
      // eslint-disable-next-line no-console
      console.log('[api/chat] params', { answerLength, baseBudget, windowByLength, topK: baseTopK, used: usedChars, sources: sources.length })
      // eslint-disable-next-line no-console
      console.log('[api/chat] sources', sources.map(s => ({ id: s.id, fileName: s.fileName, chunkIndex: s.chunkIndex, score: s.score, textChars: s.text?.length ?? 0 })))
      // eslint-disable-next-line no-console
      console.log('[api/chat] openai request', { model, temperature, promptChars: prompt.length, contextChars: context.length, style: answerLength })
    }

    let chatRes = await callChat(prompt)
    if (!chatRes.ok) {
      const text = await chatRes.text()
      const tooLong = text.includes('maximum context length') || chatRes.status === 400
      if (tooLong) {
        // Reduziere Budget schrittweise und versuche erneut
        const budgets = answerLength === 'ausführlich' ? [120000, 90000, 60000, 30000] : answerLength === 'mittel' ? [60000, 30000] : [20000]
        let retried = false
        for (const b of budgets) {
          if (b >= used) continue
          charBudget = b
          // Kürze Quellenliste
          let acc = 0
          const reduced: typeof sources = []
          for (const s of sources) {
            const len = s.text?.length ?? 0
            if (acc + len > charBudget) break
            reduced.push(s)
            acc += len
          }
          context = buildContext(reduced)
          const p2 = `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${message}\n\nQuellen:\n${context}\n\nAnforderungen:\n- Antworte knapp und fachlich korrekt.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`
          chatRes = await callChat(p2)
          if (chatRes.ok) { retried = true; break }
        }
        if (!retried && !chatRes.ok) {
          return NextResponse.json({ error: `OpenAI Chat Fehler: ${chatRes.status} ${text.slice(0, 400)}` }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: `OpenAI Chat Fehler: ${chatRes.status} ${text.slice(0, 400)}` }, { status: 500 })
      }
    }
    const raw = await chatRes.text()
    let answer = ''
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const p = parsed as { choices?: Array<{ message?: { content?: unknown } }> }
        const c = p.choices?.[0]?.message?.content
        if (typeof c === 'string') answer = c
      }
    } catch {
      return NextResponse.json({ error: 'OpenAI Chat Parse Fehler', details: raw.slice(0, 400) }, { status: 502 })
    }

    return NextResponse.json({
      status: 'ok',
      libraryId,
      vectorIndex: ctx.vectorIndex,
      answer,
      sources,
    })
  } catch (error) {
    // Detailliertes Logging und dev-Details zurückgeben
    // eslint-disable-next-line no-console
    console.error('[api/chat] Unhandled error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

function toAsciiKebab(input: unknown, maxLen: number = 80): string | undefined {
  if (typeof input !== 'string') return undefined;
  const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  const replaced = input
    .trim()
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const cut = replaced.slice(0, maxLen).replace(/-+$/g, '');
  return cut || undefined;
}

function splitToArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const arr = value
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  return undefined;
}

function normalizeStructuredData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...r };

  // shortTitle variants
  const shortTitleCandidate = (r['shortTitle'] ?? r['shortTitel'] ?? r['shortTitlel']) as unknown;
  if (typeof shortTitleCandidate === 'string') {
    const cleaned = shortTitleCandidate.replace(/[.!?]+$/g, '').trim();
    out['shortTitle'] = cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }
  delete out['shortTitel'];
  delete out['shortTitlel'];

  // slug normalization
  const slug = toAsciiKebab(r['slug']);
  if (slug) out['slug'] = slug;

  // authors and tags arrays
  const authors = splitToArray(r['authors']);
  if (authors) out['authors'] = authors;
  const tags = splitToArray(r['tags']);
  if (tags) {
    const norm = tags
      .map(t => toAsciiKebab(t, 80) || '')
      .filter(Boolean) as string[];
    out['tags'] = Array.from(new Set(norm));
  }

  // year number
  const yearVal = r['year'];
  if (typeof yearVal === 'string' && /^\d{4}$/.test(yearVal)) out['year'] = Number(yearVal);

  return out;
}

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath und targetAbsPath aktuell ungenutzt

        // 1) Optionalen Template-Content laden (aus /templates oder per Chat-Setting 'transformerTemplate')
        let metadataFromTemplate: Record<string, unknown> | null = null;
        try {
          // Standard-Template-Inhalt (wird angelegt, falls kein Template gefunden wird)
          const defaultTemplateContent = `---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format "Nachname, Vorname" wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere: title, level (1..3), order (1-basiert), startEvidence (≤160, exakter Anfangstext), summary (≤1000, extraktiv bis zum nächsten Kapitelstart), keywords (5–12, kurz und textnah).
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [ { "title": string, "level": 1 | 2 | 3, "order": number, "startEvidence": string, "summary": string, "keywords": string[] } ],
  "toc": [ { "title": string, "page": number?, "level": number? } ] | []
}`;

          // Bevorzugter Template-Name aus Chat-Config (falls vorhanden)
          const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
          // Templates-Ordner im Root suchen
          const rootItems = await provider.listItemsById('root');
          const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'));
          const ensureTemplatesFolderId = async (): Promise<string> => {
            if (templatesFolder) return templatesFolder.id;
            const created = await provider.createFolder('root', 'templates');
            bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
            return created.id;
          };

          const templatesFolderId = await ensureTemplatesFolderId();

          if (templatesFolderId) {
            const tplItems = await provider.listItemsById(templatesFolderId);
            // Auswahllogik: bevorzugt preferredTemplate, sonst 'pdfanalyse.md', sonst erstes .md
            const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()));
            const byPreferred = preferredTemplate ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : undefined;
            const byDefault = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md');
            const anyMd = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
            let chosen = byPreferred || byDefault || anyMd;
            if (!chosen) {
              // Default-Template anlegen
              const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
              await provider.uploadFile(templatesFolderId, tplFile);
              bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
              // Neu laden
              const re = await provider.listItemsById(templatesFolderId);
              chosen = re.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md'));
            }
            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              // 2) Secretary Transformer mit template_content aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown; text?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                if (normalized) {
                  metadataFromTemplate = normalized;
                } else {
                  metadataFromTemplate = null;
                }
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
              }
            } else {
              bufferLog(jobId, { phase: 'template_missing', message: 'Kein Template gefunden' });
            }
          } else {
            bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
          }
        } catch {
          bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation' });
        }

        // 3) Frontmatter-Metadaten bestimmen (Template bevorzugt, sonst Worker-Metadaten)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };

        // 4) Markdown mit Frontmatter erzeugen (Body = Originaltext)
        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
              const arrayBuf = await resp.arrayBuffer();
              const base64Zip = Buffer.from(arrayBuf).toString('base64');
              const originalItemForImages = {
                id: sourceId || 'unknown',
                parentId: targetParentId,
                type: 'file' as const,
                metadata: {
                  name: job.correlation.source?.name || 'source.pdf',
                  size: 0,
                  modifiedAt: new Date(),
                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
                },
              };
              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
              const imageResult = await ImageExtractionService.saveZipArchive(
                base64Zip,
                'images.zip',
                originalItemForImages,
                provider,
                async (folderId: string) => provider.listItemsById(folderId),
                extractedText,
                lang,
                textContents
              );
              for (const it of imageResult.savedItems) savedItems.push(it.id);
              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  try {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const res = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      // Verhindert Next.js Caching der Management-Abfrage
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: data?.message || 'Fehler von Pinecone' }, { status: 500 })
    }

    const expectedIndex = process.env.PINECONE_INDEX
    const indexes: Array<{ name: string }> = Array.isArray(data?.indexes) ? data.indexes : []
    const hasExpected = expectedIndex ? indexes.some(i => i.name === expectedIndex) : undefined

    return NextResponse.json({ ok: true, indexes, expectedIndex, exists: hasExpected })
  } catch {
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 })
  }
}



```

```typescriptreact
'use client';

import React, { Suspense } from "react";
import { Library } from "@/components/library/library";
import { useAuth } from "@clerk/nextjs";
import { useAtom, useAtomValue } from "jotai";
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useStorage } from "@/contexts/storage-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BookOpen } from "lucide-react";

// Separate Client-Komponente für die URL-Parameter-Logik
function LibraryUrlHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom);
  const { refreshAuthStatus } = useStorage();

  useEffect(() => {
    const urlLibraryId = searchParams?.get('activeLibraryId');
    
    // activeLibraryId aus der URL verarbeiten
    if (urlLibraryId) {
      setActiveLibraryId(urlLibraryId);
      // Speichere auch im localStorage für zukünftige Seitenaufrufe
      localStorage.setItem('activeLibraryId', urlLibraryId);
      
      // Auth-Status aktualisieren für die neue Library
      refreshAuthStatus();
      // Entferne nur activeLibraryId aus der URL, folderId beibehalten
      try {
        const params = new URLSearchParams(searchParams ?? undefined);
        params.delete('activeLibraryId');
        router.replace(params.size ? `/library?${params.toString()}` : '/library');
      } catch {}
    }

    // Optional: Wenn nur folderId vorhanden ist, nichts tun – die Synchronisation erfolgt über navigateToFolder
  }, [searchParams, setActiveLibraryId, router, refreshAuthStatus]);

  return null;
}

export default function LibraryPage() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { isLoading, error } = useStorage();
  const libraries = useAtomValue(librariesAtom);
  const router = useRouter();

  // Nutze den StorageContext statt eigenes Loading
  if (!isAuthLoaded || isLoading) {
    return <div className="p-8">
      <Skeleton className="h-[500px] w-full" />
    </div>;
  }

  if (!isSignedIn) {
    return <div className="p-8">
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertTitle>Fehler</AlertTitle>
        <AlertDescription>
          Sie müssen angemeldet sein, um auf die Bibliothek zugreifen zu können.
        </AlertDescription>
      </Alert>
    </div>;
  }

  if (error) {
    return <div className="p-8">
      <div className="mb-8">
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    </div>;
  }

  // Zeige eine freundliche Meldung, wenn keine Bibliotheken vorhanden sind
  if (libraries.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle>Keine Bibliotheken vorhanden</CardTitle>
            <CardDescription>
              Erstellen Sie Ihre erste Bibliothek, um mit der Organisation Ihrer Dokumente zu beginnen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              onClick={() => router.push('/settings?newUser=true')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Erste Bibliothek erstellen
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Sie können lokale Ordner oder Cloud-Speicher wie OneDrive verbinden.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Suspense fallback={null}>
        <LibraryUrlHandler />
      </Suspense>
      <div className="flex-1 min-h-0">
        <Library />
      </div>
    </div>
  );
} 
```

```typescriptreact
"use client"

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { FileText } from 'lucide-react'

interface ChatPanelProps {
  libraryId: string
}

interface ChatConfigResponse {
  library: { id: string; label: string }
  config: {
    public: boolean
    titleAvatarSrc?: string
    welcomeMessage: string
    errorMessage?: string
    placeholder?: string
    maxChars: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    features?: { citations?: boolean; streaming?: boolean }
  }
  vectorIndex: string
}

export function ChatPanel({ libraryId }: ChatPanelProps) {
  const [cfg, setCfg] = useState<ChatConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [answer, setAnswer] = useState<string>('')
  const [results, setResults] = useState<Array<{ id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string }>>([])
  const [answerLength, setAnswerLength] = useState<'kurz' | 'mittel' | 'ausführlich'>('mittel')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/config`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`Fehler beim Laden der Chat-Konfiguration: ${res.statusText}`)
        const data = await res.json() as ChatConfigResponse
        if (!cancelled) setCfg(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [libraryId])

  async function onSend() {
    if (!cfg) return
    if (!input.trim()) return
    if (cfg.config.maxChars && input.length > cfg.config.maxChars) {
      setError(cfg.config.maxCharsWarningMessage || 'Eingabe zu lang')
      return
    }
    setError(null)
    setAnswer('')
    setResults([])
    try {
      // Debug-Ausgabe: angewendete Parameter im Client
      // Hinweis: Setze den Header X-Debug auf 1, um serverseitige Logs zu aktivieren
      // (nur in Dev-Umgebungen empfohlen)
      // eslint-disable-next-line no-console
      console.log('[chat] sende Anfrage', { answerLength, chars: input.length })
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug': '1' },
        body: JSON.stringify({ message: input, answerLength })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Fehler bei der Anfrage')
      if (typeof data?.answer === 'string' && Array.isArray(data?.sources)) {
        setAnswer(data.answer)
        setResults(data.sources)
      } else if (Array.isArray(data?.results)) {
        const safe = (data.results as Array<unknown>).map((r): { id: string; score?: number; fileName?: string; chunkIndex?: number; text?: string } => {
          const obj = (r && typeof r === 'object') ? r as Record<string, unknown> : {}
          const id = String(obj.id ?? '')
          const score = typeof obj.score === 'number' ? obj.score : undefined
          const meta = (obj.metadata && typeof obj.metadata === 'object') ? obj.metadata as Record<string, unknown> : undefined
          const fileName = meta && typeof meta.fileName === 'string' ? meta.fileName : undefined
          const chunkIndex = meta && typeof meta.chunkIndex === 'number' ? meta.chunkIndex : undefined
          const text = meta && typeof meta.text === 'string' ? meta.text : undefined
          return { id, score, fileName, chunkIndex, text }
        })
        setResults(safe)
        setAnswer('')
      } else {
        setAnswer(typeof data.echo === 'string' ? data.echo : JSON.stringify(data))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    }
  }

  if (loading) return <div className="p-6">Lade Chat...</div>
  if (error) return <div className="p-6 text-destructive">{error}</div>
  if (!cfg) return <div className="p-6">Keine Konfiguration gefunden.</div>

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto w-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {cfg.config.titleAvatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.config.titleAvatarSrc} alt="Avatar" className="h-8 w-8 rounded" />
            ) : null}
            <span>Chat · {cfg.library.label}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">{cfg.config.welcomeMessage}</div>
          <Separator className="my-3" />
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>Antwortlänge:</span>
            <div className="flex gap-1">
              {(['kurz','mittel','ausführlich'] as const).map(v => (
                <Button key={v} type="button" size="sm" variant={answerLength===v? 'default':'outline'} onClick={() => setAnswerLength(v)} className="h-7">
                  {v}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              ref={inputRef}
              className="flex-1"
              placeholder={cfg.config.placeholder || 'Ihre Frage...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSend() }}
            />
            <Button type="button" onClick={onSend}>Senden</Button>
          </div>
          {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
          {answer && (
            <div className="mt-4 p-3 rounded border bg-muted/30">
              <div className="text-xs text-muted-foreground mb-1">Antwort:</div>
              <div className="whitespace-pre-wrap break-words">{answer}</div>
            </div>
          )}
          {results.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {results.map((r, i) => (
                <Tooltip key={`${r.id}-${i}`}>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Quelle ${i + 1}`}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[420px] p-3">
                    <div className="text-xs text-muted-foreground mb-1">Quelle {i + 1}</div>
                    <div className="text-sm font-medium break-all">{r.fileName || r.id}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      {typeof r.score === 'number' && <Badge variant="secondary">Score {r.score.toFixed(3)}</Badge>}
                      {typeof r.chunkIndex === 'number' && <Badge variant="outline">Chunk {r.chunkIndex}</Badge>}
                    </div>
                    {r.text && <div className="mt-2 text-sm whitespace-pre-wrap break-words">{r.text}</div>}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
          {cfg.config.footerText && (
            <div className="mt-6 text-xs text-muted-foreground">
              {cfg.config.footerText} {cfg.config.companyLink ? (<a className="underline" href={cfg.config.companyLink} target="_blank" rel="noreferrer">mehr</a>) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}



```

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c) => typeof c?.summary === 'string' && c.summary.trim().length > 0)
                              .map((c, i) => ({
                                chapterId: typeof c.chapterId === 'string' ? c.chapterId : `chap-${i + 1}`,
                                title: String(c.title ?? `Kapitel ${i + 1}`),
                                order: i + 1,
                                summary: String(c.summary).slice(0, 1200),
                                keywords: Array.isArray(c.keywords) ? c.keywords.slice(0, 12) : undefined,
                              }))
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t: any, i: number) => (
                              <li key={i} className="text-xs">
                                {(t.title || t.chapterId) ?? 'Kapitel'}
                                {typeof t.level === 'number' ? ` (L${t.level})` : ''}
                                {typeof t.page === 'number' ? ` · Seite ${t.page}` : ''}
                                {typeof t.order === 'number' ? ` · Reihenfolge ${t.order}` : ''}
                                {typeof t.startChunk === 'number' && typeof t.endChunk === 'number' ? ` · Chunks ${t.startChunk}-${t.endChunk}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c: any) => (
                              <li key={c.chapterId}>
                                L{c.level} · {c.title} · Seiten {c.startPage ?? '—'}–{c.endPage ?? '—'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
                <TextEditor 
              content={content}
              provider={provider}
              onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                          />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

```typescript
export interface UpsertVector {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

/**
 * Robustes JSON-Parsing für HTTP-Antworten.
 * - Leerer Body => {} statt SyntaxError
 * - Ungültiges JSON => wir werfen mit gekürztem Body für Debugging
 */
async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.length === 0) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`Ungueltiges JSON (Status ${res.status}): ${trimmed.slice(0, 400)}`)
  }
}

export async function upsertVectors(indexHost: string, apiKey: string, vectors: UpsertVector[]): Promise<void> {
  const url = `https://${indexHost}/vectors/upsert`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ vectors })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Upsert Fehler: ${res.status} ${err}`)
  }
}

/**
 * Upsert in kleinen Batches, um Pinecone 2MB Request-Limit einzuhalten.
 */
export async function upsertVectorsChunked(indexHost: string, apiKey: string, vectors: UpsertVector[], maxPerBatch: number = 10): Promise<void> {
  for (let i = 0; i < vectors.length; i += maxPerBatch) {
    const batch = vectors.slice(i, i + maxPerBatch)
    await upsertVectors(indexHost, apiKey, batch)
  }
}

export interface QueryMatch {
  id: string
  score?: number
  metadata?: Record<string, unknown>
}

export async function queryVectors(indexHost: string, apiKey: string, vector: number[], topK: number, filter?: Record<string, unknown>): Promise<QueryMatch[]> {
  const url = `https://${indexHost}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, topK, includeMetadata: true, filter })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Query Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }
  const matches = Array.isArray(data?.matches) ? data.matches : []
  return matches.map((m): QueryMatch => {
    const id = String((m as { id?: unknown }).id ?? '')
    const scoreVal = (m as { score?: unknown }).score
    const score = typeof scoreVal === 'number' ? scoreVal : undefined
    const metadata = (m as { metadata?: unknown }).metadata
    const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined
    return { id, score, metadata: meta }
  })
}

export async function fetchVectors(indexHost: string, apiKey: string, ids: string[], namespace: string = ''): Promise<Record<string, { id: string; metadata?: Record<string, unknown> }>> {
  const url = `https://${indexHost}/vectors/fetch`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, includeMetadata: true, namespace })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Fetch Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { vectors?: Record<string, { metadata?: Record<string, unknown> }> }
  const vectors = data?.vectors || {}
  const out: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
  for (const k of Object.keys(vectors)) {
    out[k] = { id: k, metadata: vectors[k]?.metadata }
  }
  return out
}

export async function describeIndex(indexName: string, apiKey: string): Promise<{ host: string } | null> {
  const res = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(indexName)}`, {
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  if (!res.ok) return null
  const data = await parseJsonSafe(res) as { host?: string }
  const host: string | undefined = data?.host
  return host ? { host } : null
}

export async function deleteByFilter(indexHost: string, apiKey: string, filter: Record<string, unknown>): Promise<void> {
  const url = `https://${indexHost}/vectors/delete`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deleteAll: false, ids: [], filter })
  })
  // Wenn Namespace noch nicht existiert (erste Benutzung), kann Pinecone 404 "Namespace not found" liefern.
  // Das ist in diesem Fall unkritisch: Wir wollen ja nur sicherstellen, dass nichts Altes vorhanden ist.
  if (res.status === 404) {
    return
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Delete Fehler: ${res.status} ${err}`)
  }
}



```

Ich behebe die verbleibenden Lint-Fehler: ungenutzter Request-Parameter in der Pinecone-Health-Route und explizite any-Typen in `file-preview.tsx`. Danach baue ich erneut.

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const res = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      // Verhindert Next.js Caching der Management-Abfrage
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: data?.message || 'Fehler von Pinecone' }, { status: 500 })
    }

    const expectedIndex = process.env.PINECONE_INDEX
    const indexes: Array<{ name: string }> = Array.isArray(data?.indexes) ? data.indexes : []
    const hasExpected = expectedIndex ? indexes.some(i => i.name === expectedIndex) : undefined

    return NextResponse.json({ ok: true, indexes, expectedIndex, exists: hasExpected })
  } catch {
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 })
  }
}



```

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c): c is { chapterId?: unknown; title?: unknown; summary?: unknown; keywords?: unknown } => !!c && typeof c === 'object' && typeof (c as Record<string, unknown>).summary === 'string' && (c as Record<string, unknown>).summary!.trim().length > 0)
                              .map((c, i) => {
                                const obj = c as Record<string, unknown>
                                const chapterId = typeof obj.chapterId === 'string' ? obj.chapterId : `chap-${i + 1}`
                                const title = typeof obj.title === 'string' ? obj.title : `Kapitel ${i + 1}`
                                const summary = String(obj.summary).slice(0, 1200)
                                const keywords = Array.isArray(obj.keywords) ? (obj.keywords as Array<unknown>).filter(k => typeof k === 'string').slice(0, 12) as string[] : undefined
                                return { chapterId, title, order: i + 1, summary, keywords }
                              })
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t: any, i: number) => (
                              <li key={i} className="text-xs">
                                {(t.title || t.chapterId) ?? 'Kapitel'}
                                {typeof t.level === 'number' ? ` (L${t.level})` : ''}
                                {typeof t.page === 'number' ? ` · Seite ${t.page}` : ''}
                                {typeof t.order === 'number' ? ` · Reihenfolge ${t.order}` : ''}
                                {typeof t.startChunk === 'number' && typeof t.endChunk === 'number' ? ` · Chunks ${t.startChunk}-${t.endChunk}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c: any) => (
                              <li key={c.chapterId}>
                                L{c.level} · {c.title} · Seiten {c.startPage ?? '—'}–{c.endPage ?? '—'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
                <TextEditor 
              content={content}
              provider={provider}
              onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                          />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

Ich behebe zuerst die restlichen Lint-Fehler und setze den TODO-Status passend. Danach starte ich den Build erneut.

Ich fixiere die letzten Lint-Fehler (ungenuzte Import in `api/health/pinecone/route.ts` und `any`-Parameter in `file-preview.tsx`), dann baue ich erneut.

Ich behebe die verbleibenden Lint-Fehler: entferne den ungenutzten Import in `api/health/pinecone/route.ts` und lokalisiere die restlichen `any`-Stellen in `src/components/library/file-preview.tsx`. Danach baue ich erneut.

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const res = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      // Verhindert Next.js Caching der Management-Abfrage
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: data?.message || 'Fehler von Pinecone' }, { status: 500 })
    }

    const expectedIndex = process.env.PINECONE_INDEX
    const indexes: Array<{ name: string }> = Array.isArray(data?.indexes) ? data.indexes : []
    const hasExpected = expectedIndex ? indexes.some(i => i.name === expectedIndex) : undefined

    return NextResponse.json({ ok: true, indexes, expectedIndex, exists: hasExpected })
  } catch {
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 })
  }
}



```

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c): c is { chapterId?: unknown; title?: unknown; summary?: unknown; keywords?: unknown } => !!c && typeof c === 'object' && typeof (c as Record<string, unknown>).summary === 'string' && (c as Record<string, unknown>).summary!.trim().length > 0)
                              .map((c, i) => {
                                const obj = c as Record<string, unknown>
                                const chapterId = typeof obj.chapterId === 'string' ? obj.chapterId : `chap-${i + 1}`
                                const title = typeof obj.title === 'string' ? obj.title : `Kapitel ${i + 1}`
                                const summary = String(obj.summary).slice(0, 1200)
                                const keywords = Array.isArray(obj.keywords) ? (obj.keywords as Array<unknown>).filter(k => typeof k === 'string').slice(0, 12) as string[] : undefined
                                return { chapterId, title, order: i + 1, summary, keywords }
                              })
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t, i: number) => {
                              const obj = t as Record<string, unknown>
                              const title = (typeof obj.title === 'string' ? obj.title : (typeof obj.chapterId === 'string' ? obj.chapterId : 'Kapitel')) as string
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const page = typeof obj.page === 'number' ? obj.page : undefined
                              const order = typeof obj.order === 'number' ? obj.order : undefined
                              const startChunk = typeof obj.startChunk === 'number' ? obj.startChunk : undefined
                              const endChunk = typeof obj.endChunk === 'number' ? obj.endChunk : undefined
                              return (
                                <li key={i} className="text-xs">
                                  {title}
                                  {typeof level === 'number' ? ` (L${level})` : ''}
                                  {typeof page === 'number' ? ` · Seite ${page}` : ''}
                                  {typeof order === 'number' ? ` · Reihenfolge ${order}` : ''}
                                  {typeof startChunk === 'number' && typeof endChunk === 'number' ? ` · Chunks ${startChunk}-${endChunk}` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c) => {
                              const obj = c as Record<string, unknown>
                              const id = typeof obj.chapterId === 'string' ? obj.chapterId : String(obj.chapterId ?? '')
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const title = typeof obj.title === 'string' ? obj.title : 'Kapitel'
                              const startPage = typeof obj.startPage === 'number' ? obj.startPage : undefined
                              const endPage = typeof obj.endPage === 'number' ? obj.endPage : undefined
                              return (
                                <li key={id}>
                                  {typeof level === 'number' ? `L${level}` : 'L?'} · {title} · Seiten {startPage ?? '—'}–{endPage ?? '—'}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
                <TextEditor 
              content={content}
              provider={provider}
              onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                          />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

Ich öffne die Datei mit dem TypeScript-Fehler, um den Typkonflikt bei 'kind' zu beheben. Danach wiederhole ich den Build.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import type { UpsertVector } from '@/lib/chat/pinecone'
import { embedTexts } from '@/lib/chat/embeddings'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  content: z.string().min(1),
  mode: z.enum(['A', 'B']).default('A'),
  docModifiedAt: z.string().optional(), // ISO Datum der Originaldatei (für Stale-Check)
  // Dokument-Metadaten (frei erweiterbar, werden im Meta-Vektor gespeichert)
  docMeta: z.record(z.any()).optional(),
  // Kapitel-Infos mit Summaries (optional)
  chapters: z.array(z.object({
    chapterId: z.string().min(1),
    title: z.string().optional(),
    order: z.number().int().optional(),
    summary: z.string().min(1).max(4000),
    startChunk: z.number().int().optional(),
    endChunk: z.number().int().optional(),
    keywords: z.array(z.string()).optional(),
  })).optional(),
  // Optionaler, bereits erkannter TOC (z. B. aus LLM-Analyse)
  toc: z.array(z.object({
    title: z.string(),
    level: z.number().int().optional(),
    page: z.number().int().optional(),
  })).optional()
})

function chunkText(input: string, maxChars: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = []

  // Sicherheitsgrenzen
  const maxC = Math.max(200, Math.min(maxChars, 2000))
  const ov = Math.max(0, Math.min(overlap, Math.floor(maxC / 2)))

  let i = 0
  const n = input.length
  while (i < n) {
    const sliceEnd = Math.min(i + maxC, n)
    // Bevorzugt an Zeilenumbruch schneiden
    let cut = input.lastIndexOf('\n', sliceEnd)
    if (cut < i + Math.floor(maxC * 0.6)) {
      // Falls kein sinnvoller Zeilenumbruch, nach Leerzeichen/Punkt suchen
      const spaceCut = input.lastIndexOf(' ', sliceEnd)
      const dotCut = input.lastIndexOf('.', sliceEnd)
      cut = Math.max(cut, spaceCut, dotCut)
    }
    if (cut < i + Math.floor(maxC * 0.5)) {
      // Notfall: harte Kante
      cut = sliceEnd
    }

    const part = input.slice(i, cut)
    if (part.trim().length > 0) chunks.push(part)

    // Overlap anwenden
    i = Math.max(cut - ov, i + maxC)
  }
  return chunks
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    const { fileId, fileName, content, mode, docModifiedAt, docMeta, chapters, toc } = parsed.data

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    // Idempotenz: vor Upsert alle Vektoren dieses Dokuments entfernen
    await deleteByFilter(idx.host, apiKey, { user: { $eq: userEmail }, libraryId: { $eq: libraryId }, fileId: { $eq: fileId } })

    const chunks = chunkText(content, 1500)
    const embeddings = await embedTexts(chunks)
    const vectors: UpsertVector[] = embeddings.map((values, i) => ({
      id: `${fileId}-${i}`,
      values,
      metadata: {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        mode,
        chunkIndex: i,
        // Beschränke Text im Metadata-Feld
        text: chunks[i].slice(0, 1000),
        upsertedAt: new Date().toISOString(),
        docModifiedAt
      }
    }))
    // Zusätzlich: Meta-Vektor für Dokument-Status (nutzt erstes Embedding als Vektor)
    if (embeddings.length > 0) {
      vectors.push({
        id: `${fileId}-meta`,
        values: embeddings[0],
        metadata: {
          user: userEmail,
          libraryId,
          fileId,
          fileName,
          kind: 'doc',
          chunkCount: embeddings.length,
          upsertedAt: new Date().toISOString(),
          docModifiedAt,
          // Hinweis: Pinecone-Serverless erlaubt nur primitive Metadaten oder List<string>.
          // Deshalb serialisieren wir strukturierte Felder als JSON-String.
          docMetaJson: docMeta ? JSON.stringify(docMeta) : undefined,
          tocJson: (Array.isArray(toc) && toc.length > 0)
            ? JSON.stringify(toc.map(t => ({ title: t.title, level: t.level, page: t.page })))
            : (chapters && chapters.length > 0
              ? JSON.stringify(chapters.map(c => ({
                  chapterId: c.chapterId,
                  title: c.title,
                  order: c.order,
                  startChunk: c.startChunk,
                  endChunk: c.endChunk,
                })))
              : undefined)
        }
      })
    }

    // Kapitel-Summaries als eigene Vektoren (Retriever-Ziel)
    if (chapters && chapters.length > 0) {
      const chapterSummaries = chapters.map(c => c.summary)
      const chapterEmbeds = await embedTexts(chapterSummaries)
      chapterEmbeds.forEach((values, i) => {
        const c = chapters[i]
        vectors.push({
          id: `${fileId}-chap-${c.chapterId}`,
          values,
          metadata: {
            user: userEmail,
            libraryId,
            fileId,
            fileName,
            kind: 'chapterSummary',
            chapterId: c.chapterId,
            chapterTitle: c.title,
            order: c.order,
            startChunk: c.startChunk,
            endChunk: c.endChunk,
            text: c.summary.slice(0, 1200),
            keywords: c.keywords,
            upsertedAt: new Date().toISOString(),
            docModifiedAt,
          }
        })
      })
    }
    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)

    return NextResponse.json({ status: 'ok', chunks: chunks.length, index: ctx.vectorIndex })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



```

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import type { UpsertVector } from '@/lib/chat/pinecone'
import { embedTexts } from '@/lib/chat/embeddings'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  content: z.string().min(1),
  mode: z.enum(['A', 'B']).default('A'),
  docModifiedAt: z.string().optional(), // ISO Datum der Originaldatei (für Stale-Check)
  // Dokument-Metadaten (frei erweiterbar, werden im Meta-Vektor gespeichert)
  docMeta: z.record(z.any()).optional(),
  // Kapitel-Infos mit Summaries (optional)
  chapters: z.array(z.object({
    chapterId: z.string().min(1),
    title: z.string().optional(),
    order: z.number().int().optional(),
    summary: z.string().min(1).max(4000),
    startChunk: z.number().int().optional(),
    endChunk: z.number().int().optional(),
    keywords: z.array(z.string()).optional(),
  })).optional(),
  // Optionaler, bereits erkannter TOC (z. B. aus LLM-Analyse)
  toc: z.array(z.object({
    title: z.string(),
    level: z.number().int().optional(),
    page: z.number().int().optional(),
  })).optional()
})

function chunkText(input: string, maxChars: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = []

  // Sicherheitsgrenzen
  const maxC = Math.max(200, Math.min(maxChars, 2000))
  const ov = Math.max(0, Math.min(overlap, Math.floor(maxC / 2)))

  let i = 0
  const n = input.length
  while (i < n) {
    const sliceEnd = Math.min(i + maxC, n)
    // Bevorzugt an Zeilenumbruch schneiden
    let cut = input.lastIndexOf('\n', sliceEnd)
    if (cut < i + Math.floor(maxC * 0.6)) {
      // Falls kein sinnvoller Zeilenumbruch, nach Leerzeichen/Punkt suchen
      const spaceCut = input.lastIndexOf(' ', sliceEnd)
      const dotCut = input.lastIndexOf('.', sliceEnd)
      cut = Math.max(cut, spaceCut, dotCut)
    }
    if (cut < i + Math.floor(maxC * 0.5)) {
      // Notfall: harte Kante
      cut = sliceEnd
    }

    const part = input.slice(i, cut)
    if (part.trim().length > 0) chunks.push(part)

    // Overlap anwenden
    i = Math.max(cut - ov, i + maxC)
  }
  return chunks
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    const { fileId, fileName, content, mode, docModifiedAt, docMeta, chapters, toc } = parsed.data

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    // Idempotenz: vor Upsert alle Vektoren dieses Dokuments entfernen
    await deleteByFilter(idx.host, apiKey, { user: { $eq: userEmail }, libraryId: { $eq: libraryId }, fileId: { $eq: fileId } })

    const chunks = chunkText(content, 1500)
    const embeddings = await embedTexts(chunks)
    const vectors: UpsertVector[] = embeddings.map((values, i) => ({
      id: `${fileId}-${i}`,
      values,
      metadata: {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        mode,
        chunkIndex: i,
        // Beschränke Text im Metadata-Feld
        text: chunks[i].slice(0, 1000),
        upsertedAt: new Date().toISOString(),
        docModifiedAt
      }
    }))
    // Zusätzlich: Meta-Vektor für Dokument-Status (nutzt erstes Embedding als Vektor)
    if (embeddings.length > 0) {
      vectors.push({
        id: `${fileId}-meta`,
        values: embeddings[0],
        metadata: {
          user: userEmail,
          libraryId,
          fileId,
          fileName,
          kind: 'doc',
          chunkCount: embeddings.length,
          upsertedAt: new Date().toISOString(),
          docModifiedAt,
          // Hinweis: Pinecone-Serverless erlaubt nur primitive Metadaten oder List<string>.
          // Deshalb serialisieren wir strukturierte Felder als JSON-String.
          docMetaJson: docMeta ? JSON.stringify(docMeta) : undefined,
          tocJson: (Array.isArray(toc) && toc.length > 0)
            ? JSON.stringify(toc.map(t => ({ title: t.title, level: t.level, page: t.page })))
            : (chapters && chapters.length > 0
              ? JSON.stringify(chapters.map(c => ({
                  chapterId: c.chapterId,
                  title: c.title,
                  order: c.order,
                  startChunk: c.startChunk,
                  endChunk: c.endChunk,
                })))
              : undefined)
        } as Record<string, unknown>
      })
    }

    // Kapitel-Summaries als eigene Vektoren (Retriever-Ziel)
    if (chapters && chapters.length > 0) {
      const chapterSummaries = chapters.map(c => c.summary)
      const chapterEmbeds = await embedTexts(chapterSummaries)
      chapterEmbeds.forEach((values, i) => {
        const c = chapters[i]
        vectors.push({
          id: `${fileId}-chap-${c.chapterId}`,
          values,
          metadata: {
            user: userEmail,
            libraryId,
            fileId,
            fileName,
            kind: 'chapterSummary',
            chapterId: c.chapterId,
            chapterTitle: c.title,
            order: c.order,
            startChunk: c.startChunk,
            endChunk: c.endChunk,
            text: c.summary.slice(0, 1200),
            keywords: c.keywords,
            upsertedAt: new Date().toISOString(),
            docModifiedAt,
          } as Record<string, unknown>
        })
      })
    }
    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)

    return NextResponse.json({ status: 'ok', chunks: chunks.length, index: ctx.vectorIndex })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}



```

Ich behebe den TS-Fehler in `src/components/library/file-preview.tsx` (sichere Type Guard ohne `.trim()` auf unbekanntem Typ) und baue erneut.

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c): c is { chapterId?: unknown; title?: unknown; summary: string; keywords?: unknown } => {
                                if (!c || typeof c !== 'object') return false
                                const s = (c as Record<string, unknown>).summary
                                return typeof s === 'string' && s.trim().length > 0
                              })
                              .map((c, i) => {
                                const obj = c as Record<string, unknown>
                                const chapterId = typeof obj.chapterId === 'string' ? obj.chapterId : `chap-${i + 1}`
                                const title = typeof obj.title === 'string' ? obj.title : `Kapitel ${i + 1}`
                                const summary = (obj.summary as string).slice(0, 1200)
                                const keywords = Array.isArray(obj.keywords) ? (obj.keywords as Array<unknown>).filter(k => typeof k === 'string').slice(0, 12) as string[] : undefined
                                return { chapterId, title, order: i + 1, summary, keywords }
                              })
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t, i: number) => {
                              const obj = t as Record<string, unknown>
                              const title = (typeof obj.title === 'string' ? obj.title : (typeof obj.chapterId === 'string' ? obj.chapterId : 'Kapitel')) as string
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const page = typeof obj.page === 'number' ? obj.page : undefined
                              const order = typeof obj.order === 'number' ? obj.order : undefined
                              const startChunk = typeof obj.startChunk === 'number' ? obj.startChunk : undefined
                              const endChunk = typeof obj.endChunk === 'number' ? obj.endChunk : undefined
                              return (
                                <li key={i} className="text-xs">
                                  {title}
                                  {typeof level === 'number' ? ` (L${level})` : ''}
                                  {typeof page === 'number' ? ` · Seite ${page}` : ''}
                                  {typeof order === 'number' ? ` · Reihenfolge ${order}` : ''}
                                  {typeof startChunk === 'number' && typeof endChunk === 'number' ? ` · Chunks ${startChunk}-${endChunk}` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c) => {
                              const obj = c as Record<string, unknown>
                              const id = typeof obj.chapterId === 'string' ? obj.chapterId : String(obj.chapterId ?? '')
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const title = typeof obj.title === 'string' ? obj.title : 'Kapitel'
                              const startPage = typeof obj.startPage === 'number' ? obj.startPage : undefined
                              const endPage = typeof obj.endPage === 'number' ? obj.endPage : undefined
                              return (
                                <li key={id}>
                                  {typeof level === 'number' ? `L${level}` : 'L?'} · {title} · Seiten {startPage ?? '—'}–{endPage ?? '—'}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
                <TextEditor 
              content={content}
              provider={provider}
              onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                          />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

Ich passe den Typ von ragStatus in `src/components/library/file-preview.tsx` an, damit `analyze` typisiert ist, und baue danach erneut.

```typescriptreact
'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
    analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c): c is { chapterId?: unknown; title?: unknown; summary: string; keywords?: unknown } => {
                                if (!c || typeof c !== 'object') return false
                                const s = (c as Record<string, unknown>).summary
                                return typeof s === 'string' && s.trim().length > 0
                              })
                              .map((c, i) => {
                                const obj = c as Record<string, unknown>
                                const chapterId = typeof obj.chapterId === 'string' ? obj.chapterId : `chap-${i + 1}`
                                const title = typeof obj.title === 'string' ? obj.title : `Kapitel ${i + 1}`
                                const summary = (obj.summary as string).slice(0, 1200)
                                const keywords = Array.isArray(obj.keywords) ? (obj.keywords as Array<unknown>).filter(k => typeof k === 'string').slice(0, 12) as string[] : undefined
                                return { chapterId, title, order: i + 1, summary, keywords }
                              })
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t, i: number) => {
                              const obj = t as Record<string, unknown>
                              const title = (typeof obj.title === 'string' ? obj.title : (typeof obj.chapterId === 'string' ? obj.chapterId : 'Kapitel')) as string
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const page = typeof obj.page === 'number' ? obj.page : undefined
                              const order = typeof obj.order === 'number' ? obj.order : undefined
                              const startChunk = typeof obj.startChunk === 'number' ? obj.startChunk : undefined
                              const endChunk = typeof obj.endChunk === 'number' ? obj.endChunk : undefined
                              return (
                                <li key={i} className="text-xs">
                                  {title}
                                  {typeof level === 'number' ? ` (L${level})` : ''}
                                  {typeof page === 'number' ? ` · Seite ${page}` : ''}
                                  {typeof order === 'number' ? ` · Reihenfolge ${order}` : ''}
                                  {typeof startChunk === 'number' && typeof endChunk === 'number' ? ` · Chunks ${startChunk}-${endChunk}` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c) => {
                              const obj = c as Record<string, unknown>
                              const id = typeof obj.chapterId === 'string' ? obj.chapterId : String(obj.chapterId ?? '')
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const title = typeof obj.title === 'string' ? obj.title : 'Kapitel'
                              const startPage = typeof obj.startPage === 'number' ? obj.startPage : undefined
                              const endPage = typeof obj.endPage === 'number' ? obj.endPage : undefined
                              return (
                                <li key={id}>
                                  {typeof level === 'number' ? `L${level}` : 'L?'} · {title} · Seiten {startPage ?? '—'}–{endPage ?? '—'}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
                <TextEditor 
              content={content}
              provider={provider}
              onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                          />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
        />
      </div>
    </div>
  );
}
```

Ich behebe den Typfehler in `src/components/settings/chat-form.tsx`, baue erneut und führe Lint/Tests aus. Anschließend committe ich den Merge-Stand und erstelle den PR von `chatbot` nach `master`.

```typescriptreact
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/components/ui/use-toast"

// Zod-Schema für Chat-Konfiguration
const chatFormSchema = z.object({
  public: z.boolean().default(false),
  titleAvatarSrc: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  welcomeMessage: z.string().min(1, "Bitte geben Sie eine Begrüßungsnachricht ein."),
  errorMessage: z.string().optional(),
  placeholder: z.string().optional(),
  maxChars: z.coerce.number().int().positive().max(4000).optional(),
  maxCharsWarningMessage: z.string().optional(),
  footerText: z.string().optional(),
  companyLink: z.string().url().optional().or(z.literal("")).transform(v => v || undefined),
  features: z.object({
    citations: z.boolean().default(true),
    streaming: z.boolean().default(true),
  }).default({ citations: true, streaming: true }),
  rateLimit: z.object({
    windowSec: z.coerce.number().int().positive().default(60),
    max: z.coerce.number().int().positive().default(30),
  }).optional(),
  vectorStore: z.object({
    indexOverride: z.string().optional(),
  }).optional(),
})

type ChatFormValues = z.infer<typeof chatFormSchema>

export function ChatForm() {
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibraryId] = useAtom(activeLibraryIdAtom)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [healthResult, setHealthResult] = useState<{
    ok: boolean;
    indexes?: Array<{ name: string }>;
    expectedIndex?: string;
    exists?: boolean;
    status?: number;
    error?: string;
  } | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)

  const activeLibrary = libraries.find(lib => lib.id === activeLibraryId)

  const form = useForm<ChatFormValues>({
    resolver: zodResolver(chatFormSchema),
    defaultValues: {
      public: false,
      titleAvatarSrc: undefined,
      welcomeMessage: "Hallo! Ich bin dein wissensbasierter Chatbot.",
      errorMessage: "Etwas ist schiefgegangen. Versuche es bitte nochmal.",
      placeholder: "Schreibe deine Frage...",
      maxChars: 500,
      maxCharsWarningMessage: "Deine Frage ist zu lang, bitte kürze sie.",
      footerText: "",
      companyLink: undefined,
      features: { citations: true, streaming: true },
      rateLimit: { windowSec: 60, max: 30 },
      vectorStore: { indexOverride: undefined },
    },
  })

  useEffect(() => {
    if (activeLibrary?.config?.chat) {
      const c = activeLibrary.config.chat as unknown as Record<string, unknown>
      form.reset({
        public: Boolean(c.public ?? false),
        titleAvatarSrc: typeof c.titleAvatarSrc === 'string' ? c.titleAvatarSrc : undefined,
        welcomeMessage: typeof c.welcomeMessage === 'string' && c.welcomeMessage ? c.welcomeMessage : "Hallo! Ich bin dein wissensbasierter Chatbot.",
        errorMessage: typeof c.errorMessage === 'string' ? c.errorMessage : "Etwas ist schiefgegangen. Versuche es bitte nochmal.",
        placeholder: typeof c.placeholder === 'string' ? c.placeholder : "Schreibe deine Frage...",
        maxChars: typeof c.maxChars === 'number' ? c.maxChars : 500,
        maxCharsWarningMessage: typeof c.maxCharsWarningMessage === 'string' ? c.maxCharsWarningMessage : "Deine Frage ist zu lang, bitte kürze sie.",
        footerText: typeof c.footerText === 'string' ? c.footerText : "",
        companyLink: typeof c.companyLink === 'string' ? c.companyLink : undefined,
        features: {
          citations: Boolean((c.features as { citations?: boolean })?.citations ?? true),
          streaming: Boolean((c.features as { streaming?: boolean })?.streaming ?? true),
        },
        rateLimit: {
          windowSec: Number((c.rateLimit as { windowSec?: number })?.windowSec ?? 60),
          max: Number((c.rateLimit as { max?: number })?.max ?? 30),
        },
        vectorStore: {
          indexOverride: typeof (c.vectorStore as { indexOverride?: string })?.indexOverride === 'string'
            ? (c.vectorStore as { indexOverride?: string })!.indexOverride
            : undefined,
        },
      })
    }
  }, [activeLibrary, form])

  async function onSubmit(data: ChatFormValues) {
    setIsLoading(true)
    try {
      if (!activeLibrary) throw new Error("Keine Bibliothek ausgewählt")

      const updatedLibrary = {
        ...activeLibrary,
        config: {
          ...activeLibrary.config,
          chat: data,
        }
      }

      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLibrary),
      })
      if (!response.ok) throw new Error(`Fehler beim Speichern: ${response.statusText}`)

      const updatedLibraries = libraries.map(lib => lib.id === activeLibrary.id
        ? { ...lib, config: { ...lib.config, chat: data } }
        : lib)
      setLibraries(updatedLibraries)

      toast({
        title: "Chat-Einstellungen gespeichert",
        description: `Die Chat-Einstellungen für "${activeLibrary.label}" wurden aktualisiert.`,
      })
    } catch (error) {
      console.error('Fehler beim Speichern der Chat-Einstellungen:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Speichern",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">Bitte wählen Sie eine Bibliothek aus.</div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="public"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <div>
                  <FormLabel>Öffentlich zugänglich</FormLabel>
                  <FormDescription>
                    Wenn aktiviert, kann der Chat ohne Anmeldung verwendet werden (Rate-Limit beachten).
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="titleAvatarSrc"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://.../avatar.png" {...field} />
                </FormControl>
                <FormDescription>Optionales Avatarbild für die Chat-Ansicht.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="welcomeMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Begrüßung</FormLabel>
                <FormControl>
                  <Textarea rows={3} placeholder="Willkommensnachricht..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="errorMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fehlermeldung</FormLabel>
                <FormControl>
                  <Input placeholder="Allgemeine Fehlermeldung..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="placeholder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platzhalter</FormLabel>
                  <FormControl>
                    <Input placeholder="Schreibe deine Frage..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxChars"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Zeichen pro Nachricht</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={4000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="maxCharsWarningMessage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warnhinweis bei Überschreitung</FormLabel>
                <FormControl>
                  <Input placeholder="Deine Frage ist zu lang, bitte kürze sie." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="footerText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer-Text</FormLabel>
                  <FormControl>
                    <Input placeholder="Powered by ..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="companyLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Footer-Link</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.example.org" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="features.citations"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Zitate/Quellen anzeigen</FormLabel>
                    <FormDescription>Quellverweise zu Antworten im Chat einblenden.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="features.streaming"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Streaming aktivieren</FormLabel>
                    <FormDescription>Antworten während der Generierung anzeigen.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rateLimit.windowSec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate-Limit Fenster (Sekunden)</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rateLimit.max"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Requests pro Fenster</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="vectorStore.indexOverride"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Index-Override (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Standard: Library-Name als Index" {...field} />
                </FormControl>
                <FormDescription>
                  Nur ausfüllen, wenn der Standardindex (Libraryname) nicht verwendet werden soll.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button type="button" variant="outline" onClick={async () => {
            setIsChecking(true)
            setHealthError(null)
            setHealthResult(null)
            try {
              const res = await fetch('/api/health/pinecone', { method: 'GET', cache: 'no-store' })
              const data = await res.json()
              if (!res.ok || data?.ok === false) {
                const message = typeof data?.error === 'string' ? data.error : `Fehlerstatus ${res.status}`
                throw new Error(message)
              }
              setHealthResult(data)
              toast({ title: 'Index Status', description: 'Pinecone-Verbindung OK' })
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
              setHealthError(msg)
              toast({ title: 'Fehler', description: msg, variant: 'destructive' })
            } finally {
              setIsChecking(false)
            }
          }}>
            {isChecking ? 'Prüfe...' : 'Index Status prüfen'}
          </Button>
          <Button type="button" variant="outline" onClick={async () => {
            try {
              if (!activeLibrary) throw new Error('Keine Bibliothek ausgewählt')
              const res = await fetch(`/api/chat/${encodeURIComponent(activeLibrary.id)}/index`, { method: 'POST' })
              const data = await res.json()
              if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Anlegen des Index')
              toast({ title: data.status === 'exists' ? 'Index vorhanden' : 'Index angelegt', description: typeof data?.index === 'object' ? JSON.stringify(data.index) : undefined })
            } catch (e) {
              toast({ title: 'Fehler', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
            }
          }}>
            Index anlegen
          </Button>
          <Button type="button" variant="secondary" onClick={async () => {
            try {
              if (!activeLibrary) throw new Error('Keine Bibliothek ausgewählt')
              const res = await fetch(`/api/chat/${encodeURIComponent(activeLibrary.id)}/ingest`, { method: 'POST' })
              if (!res.ok) throw new Error(`Fehler beim Starten der Ingestion: ${res.statusText}`)
              const data = await res.json()
              toast({ title: 'Index-Aufbau gestartet', description: `Job-ID: ${data.jobId}` })
            } catch (e) {
              toast({ title: 'Fehler', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
            }
          }}>
            Index neu aufbauen
          </Button>
          <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
            {isLoading ? "Wird gespeichert..." : "Einstellungen speichern"}
          </Button>
        </div>

        {(healthResult || healthError) && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground mb-2">Pinecone Health Check</div>
            {healthError ? (
              <div className="text-sm text-destructive">{healthError}</div>
            ) : (
              <pre className="text-xs whitespace-pre-wrap break-words">{healthResult ? JSON.stringify(healthResult, null, 2) : ''}</pre>
            )}
          </div>
        )}
      </form>
    </Form>
  )
}



```

Status: chatbot ist mit master synchronisiert, baut erfolgreich. Ich committe den Merge, pushe und eröffne den PR.

Ich führe jetzt aus:
- Merge committen und pushen
- Optional: PR via gh erstellen (falls installiert)

Soll ich den PR automatisch anlegen lassen?

---

**User**

ok

---

**Cursor**

Ich prüfe Lint und Tests, committe dann den Merge-Stand auf `chatbot`, pushe zu `origin` und erstelle im Anschluss den PR gegen `master`.

Ich analysiere jetzt die fehlgeschlagenen Tests und öffne die betroffene Implementierung sowie die Tests parallel, um die Slug-Logik zu korrigieren. Danach passe ich entweder die Implementierung an die erwarteten Tests an oder umgekehrt, je nachdem was fachlich korrekt ist, und lasse Tests erneut laufen.

---

**User**

ich habe die tests deaktiviert (datei umbenannt)

---

**Cursor**

Ich schließe die Build-Fixes ab und erstelle jetzt den PR: ich committe die Änderungen auf `chatbot`, pushe und versuche anschließend, den PR via GitHub-CLI zu öffnen.

Kurzstatus: Änderungen sind auf `origin/chatbot` gepusht. PR-Erstellung via gh schlug wegen fehlender Auth fehl.

Vorschlag:
- Entweder im Browser PR öffnen: GitHub → bCommonsLAB/CommonKnowledgeScout → Compare & pull request → base: master, compare: chatbot.
- Oder gh authentifizieren und ich erstelle den PR per CLI:
  1) gh auth login
  2) danach erneut: gh pr create --base master --head chatbot ...

Sag mir, welche Variante du möchtest.

---

**User**

Habe auf github den branch mit pull request gemerged und branch gelöscht.

---

**Cursor**

Ich synchronisiere lokal den Stand von master nach deinem Merge, lösche ggf. den lokalen Branch, und prüfe Build/Lint/Tests.

- Master ist lokal synchron und baut sauber. Lint zeigt nur Warnungen, keine Fehler.
- Lokaler `chatbot`-Branch wurde gelöscht; Remote ist bereits gelöscht.

Willst du die deaktivierten Tests wieder aktivieren und die Slug-Logik später fixen, oder vorerst so lassen?

---

**User**

@cursor_2025.08.27-panel_resizing_issue_with_file_t.md ich habe in diesem chat was programmiert, um in der library aktuellen Crumbpath als Favorit zu speichern und mit einem dropdown wieder zuverwenden. Das sehe ich jetzt im code nicht mehr.@cursor_2025.08.28-optimizing_pdf_processing_and_me.md @favorites.ts können wir das analysieren?

---

**Cursor**

Ich suche jetzt nach der Favorites-Implementierung und deren Verwendung in der Library-UI (Breadcrumb/Dropdown) und öffne die `src/lib/library/favorites.ts`, um den aktuellen Stand zu prüfen. Danach entscheide ich, ob der UI-Teil fehlt und wo er ergänzt werden muss.

Ich suche jetzt die `Breadcrumb`-Komponente und prüfe, ob dort Favoriten/Favorites-Logik existiert, und scanne parallel auf Vorkommen von loadFavorites/toggleFavorite im UI. Danach sage ich dir, ob die UI fehlt und wo wir sie ergänzen sollten.

Ich prüfe die UI-Dateien, speziell `src/components/library/breadcrumb.tsx`, ob die Favoriten-Logik verdrahtet ist, und bestätige, dass nur `favorites.ts` existiert. Danach gebe ich dir eine präzise Integrationsempfehlung.

Kurzes Update: Ich habe `src/lib/library/favorites.ts` gefunden (Persistenz in `.ck-meta/favorites.json` ist da), aber in `src/components/library/breadcrumb.tsx` ist keine Favoriten-UI verdrahtet. Die in den Docs beschriebene Dropdown/Star-Logik fehlt aktuell im UI.

Analyse
- Vorhanden:
  - `src/lib/library/favorites.ts`: `loadFavorites(provider, libraryId)`, `toggleFavorite(provider, libraryId, folder)`.
- Nicht vorhanden:
  - Einbindung in `Breadcrumb` oder `LibraryHeader` (Dropdown mit Favoriten, Stern/Toggle).
  - Aufrufe von `loadFavorites`/`toggleFavorite` im UI.
- Doku-Referenzen zeigen geplante UI in `Breadcrumb` (Dropdown + Star), aber diese Implementierung ist nicht im Code.

Vorschlag (präzise Einbindung)
- Zielort: `src/components/library/breadcrumb.tsx`
  - Importiere `useStorage` (für `provider`) und `activeLibraryAtom`.
  - Lade Favoriten bei Wechsel von `activeLibrary.id`:
    - `const { provider } = useStorage();`
    - `const activeLibrary = useAtomValue(activeLibraryAtom);`
    - `useEffect(() => { if (provider && activeLibrary?.id) setFavorites(await loadFavorites(provider, activeLibrary.id)); }, [...])`
  - Dropdown “Favoriten” rechts vom Pfad:
    - Anzeige: Liste der Favoriten mit Label = vollständiger Pfadname (aus `FavoriteEntry.path?.join(' / ') ?? name`).
    - Klick navigiert via `useFolderNavigation()` zu `favorite.id`.
  - Stern-Button (Toggle) nahe des aktuellen Ordnernamens:
    - Ruft `toggleFavorite(provider, activeLibrary.id, currentFolder)` auf.
    - Danach `setFavorites` mit Rückgabewert aktualisieren.
- Optional alternativ: Menü im `src/components/library/library-header.tsx` statt Breadcrumb.

Benötigte Daten im Breadcrumb
- `provider` aus `useStorage()`
- `activeLibrary.id` (ist bereits per Atom verfügbar)
- `currentPath` und `currentFolderId` (bereits vorhanden), um den aktuell ausgewählten Ordner als Favorit zu togglen.

Nächste Schritte
- Soll ich die Favoriten-UI (Dropdown + Stern) jetzt in `breadcrumb.tsx` integrieren? Wenn ja, mache ich die Edits minimal-invasiv und teste Navigation/Toggling.

---

**User**

ja bitte in breadcrumb integrieren. Dropdown symbol ist vor dem breadcrum ein Pfeil nach unten. so ähnlich wie pfeile in Filetree. Favoriten Star am Ende des Breadcrumbs.

---

**Cursor**

Ich erweitere jetzt die Breadcrumb-UI um das Favoriten-Dropdown (Chevron-Trigger links) und den Favoriten-Stern (rechts), lade/persistiere Favoriten über `loadFavorites`/`toggleFavorite`, und validiere anschließend den Build.

```typescriptreact
'use client';

import * as React from "react";
import { useAtomValue } from "jotai";
import { cn } from "@/lib/utils";
import { NavigationLogger, UILogger } from "@/lib/debug/logger";
import { currentPathAtom, currentFolderIdAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { useCallback } from "react";
import { useFolderNavigation } from '@/hooks/use-folder-navigation';
import { useStorage } from "@/contexts/storage-context";
import { loadFavorites, toggleFavorite } from "@/lib/library/favorites";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, Star, StarOff } from "lucide-react";

interface BreadcrumbProps {
  className?: string;
}

export function Breadcrumb({ className }: BreadcrumbProps) {
  // Globale Atoms
  const currentPath = useAtomValue(currentPathAtom);
  const currentFolderId = useAtomValue(currentFolderIdAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom);

  // Ref für horizontales Scrollen
  const breadcrumbRef = React.useRef<HTMLDivElement>(null);
  const scrollStartTime = React.useRef<number | null>(null);

  const navigateToFolder = useFolderNavigation();
  const { provider } = useStorage();

  const [favoritesOpen, setFavoritesOpen] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Array<{ id: string; name: string; label: string }>>([]);

  // Favoriten laden bei Wechsel der aktiven Library oder Provider-Verfügbarkeit
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!provider || !activeLibrary?.id) return;
        const data = await loadFavorites(provider, activeLibrary.id);
        if (cancelled) return;
        const list = (data.favorites || []).map(f => ({
          id: f.id,
          name: f.name,
          label: Array.isArray(f.path) && f.path.length > 0 ? f.path.join(' / ') : f.name,
        }));
        setFavorites(list);
      } catch {
        // Ignoriere Ladefehler still
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [provider, activeLibrary?.id]);

  // Handler für Root-Klick
  const handleRootClick = useCallback(() => {
    const startTime = performance.now();
    
    NavigationLogger.info('Breadcrumb', 'Root navigation requested', {
      currentPath: currentPath.length,
      activeLibrary: activeLibrary?.label
    });
    
    navigateToFolder('root');

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Root click handled', {
      duration: `${duration.toFixed(2)}ms`,
      activeLibrary: activeLibrary?.label
    });
  }, [currentPath.length, activeLibrary, navigateToFolder]);

  // Handler für Ordner-Klick
  const handleFolderClick = useCallback((folderId: string) => {
    const startTime = performance.now();
    const targetFolder = currentPath.find(item => item.id === folderId);
    
    NavigationLogger.info('Breadcrumb', 'Folder navigation requested', {
      folderId,
      folderName: targetFolder?.metadata.name,
      pathDepth: currentPath.length,
      currentFolderId
    });

    navigateToFolder(folderId);

    const duration = performance.now() - startTime;
    UILogger.debug('Breadcrumb', 'Folder click handled', {
      duration: `${duration.toFixed(2)}ms`,
      folderId,
      folderName: targetFolder?.metadata.name,
      isCurrentFolder: currentFolderId === folderId
    });
  }, [currentPath, currentFolderId, navigateToFolder]);

  // Auto-Scroll zum Ende des Breadcrumbs
  React.useEffect(() => {
    if (!breadcrumbRef.current) return;

    const startTime = performance.now();
    scrollStartTime.current = startTime;
    
    UILogger.debug('Breadcrumb', 'Starting auto-scroll', {
      pathDepth: currentPath.length,
      currentScrollLeft: breadcrumbRef.current.scrollLeft,
      targetScrollLeft: breadcrumbRef.current.scrollWidth,
      activeLibrary: activeLibrary?.label
    });

    breadcrumbRef.current.scrollLeft = breadcrumbRef.current.scrollWidth;

    const timeoutId = setTimeout(() => {
      if (scrollStartTime.current === startTime) {
        const duration = performance.now() - startTime;
        UILogger.info('Breadcrumb', 'Auto-scroll completed', {
          duration: `${duration.toFixed(2)}ms`,
          finalScrollLeft: breadcrumbRef.current?.scrollLeft,
          pathDepth: currentPath.length
        });
        scrollStartTime.current = null;
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [currentPath, activeLibrary]);

  // Aktuellen Folder für Star-Button ermitteln
  const currentFolder = React.useMemo(() => (
    currentFolderId === 'root' ? null : currentPath.find(item => item.id === currentFolderId) || null
  ), [currentFolderId, currentPath]);

  const isCurrentFavorite = React.useMemo(() => (
    !!currentFolder && favorites.some(f => f.id === currentFolder.id)
  ), [currentFolder, favorites]);

  async function handleToggleFavorite() {
    if (!provider || !activeLibrary?.id || !currentFolder) return;
    const updated = await toggleFavorite(provider, activeLibrary.id, currentFolder);
    const list = (updated.favorites || []).map(f => ({
      id: f.id,
      name: f.name,
      label: Array.isArray(f.path) && f.path.length > 0 ? f.path.join(' / ') : f.name,
    }));
    setFavorites(list);
  }

  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      <div className="text-sm flex items-center gap-2 min-w-0 overflow-hidden">
        {/* Favoriten-Dropdown Trigger links vor dem Breadcrumb */}
        <DropdownMenu open={favoritesOpen} onOpenChange={setFavoritesOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Favoriten öffnen"
              className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
            >
              {favoritesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[260px]">
            {favorites.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Keine Favoriten vorhanden</div>
            ) : favorites.map(f => (
              <DropdownMenuItem key={f.id} onClick={() => navigateToFolder(f.id)} className="text-sm">
                <div className="truncate" title={f.label}>{f.label}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-muted-foreground flex-shrink-0">Pfad:</span>
        <div 
          ref={breadcrumbRef}
          className="flex items-center gap-1 overflow-auto whitespace-nowrap no-scrollbar" 
          style={{ maxWidth: '60vw' }}
          onScroll={() => {
            if (scrollStartTime.current) {
              const duration = performance.now() - scrollStartTime.current;
              UILogger.debug('Breadcrumb', 'Manual scroll detected', {
                duration: `${duration.toFixed(2)}ms`,
                scrollLeft: breadcrumbRef.current?.scrollLeft
              });
              scrollStartTime.current = null;
            }
          }}
        >
          <button
            onClick={handleRootClick}
            className={cn(
              "hover:text-foreground flex-shrink-0 font-medium",
              currentFolderId === 'root' ? "text-foreground" : "text-muted-foreground"
            )}
            title="Zurück zum Hauptverzeichnis"
          >
            {activeLibrary?.label || '/'}
          </button>
          
          {currentPath
            .filter(item => item.id !== 'root' && item.metadata.name.toLowerCase() !== 'root')
            .map((item) => (
              <React.Fragment key={item.id}>
                <span className="text-muted-foreground flex-shrink-0">/</span>
                <button
                  onClick={() => handleFolderClick(item.id)}
                  className={cn(
                    "hover:text-foreground truncate max-w-[150px]",
                    currentFolderId === item.id ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                  title={item.metadata.name}
                >
                  {item.metadata.name}
                </button>
              </React.Fragment>
          ))}
          {/* Favoriten-Star am Ende des Breadcrumbs */}
          <span className="text-muted-foreground flex-shrink-0">/</span>
          <button
            disabled={!currentFolder || !provider || !activeLibrary?.id}
            onClick={handleToggleFavorite}
            className={cn(
              "inline-flex h-6 w-6 items-center justify-center rounded",
              currentFolder ? "hover:bg-muted" : "opacity-50 cursor-not-allowed"
            )}
            aria-label={isCurrentFavorite ? "Favorit entfernen" : "Als Favorit speichern"}
            title={isCurrentFavorite ? "Favorit entfernen" : "Als Favorit speichern"}
          >
            {isCurrentFavorite ? <Star className="h-4 w-4" /> : <StarOff className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
} 
```

---

**User**

??

---

**Cursor**

Ich prüfe kurz den Build nach der Breadcrumb-Erweiterung und schließe dann die Aufgabenliste ab.

Ich baue jetzt das Projekt, um die Breadcrumb-Änderungen zu verifizieren. Anschließend melde ich dir den Status.

- Favoriten sind integriert:
  - Dropdown-Trigger (Chevron) links vor dem Breadcrumb.
  - Stern-Button am Ende des Breadcrumbs zum Hinzufügen/Entfernen.
- Persistenz: `.ck-meta/favorites.json` pro Library über den aktiven `StorageProvider`.

So testest du es:
- In die Library gehen, in einen Unterordner navigieren.
- Stern rechts klicken → Favorit wird gespeichert/entfernt.
- Chevron links öffnen → Favoritenliste, Klick navigiert direkt.
- Falls noch keine Favoriten existieren, wird die Datei automatisch angelegt.

Build ist grün; es gibt nur ESLint-Warnungen (Hooks-Dependencies), die die Funktion nicht blockieren. Passt dir die Position/Interaktion so?

