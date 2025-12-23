/**
 * @fileoverview External Jobs Chapters Analysis - Chapter Detection and Merging
 * 
 * @description
 * Analyzes document content to detect and normalize chapters using heuristic algorithms.
 * Merges detected chapters with existing chapters and updates frontmatter metadata.
 * Handles chapter matching by order and title, page number extraction, and TOC generation.
 * 
 * @module external-jobs
 * 
 * @exports
 * - analyzeAndMergeChapters: Analyzes and merges chapters into frontmatter
 * 
 * @usedIn
 * - src/app/api/external/jobs/[jobId]/route.ts: Job callback uses chapter analysis
 * 
 * @dependencies
 * - @/lib/external-jobs-repository: Job repository for logging
 * - @/lib/markdown/frontmatter: Frontmatter stripping utilities
 * - @/lib/processing/phase-policy: Policy checking
 * - @/lib/events/job-event-bus: Job event bus
 * - @/types/external-jobs: Chapters types
 */

import type { ChaptersArgs, ChaptersResult, Frontmatter } from '@/types/external-jobs'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'

// Frontmatter-Stripper zentralisiert in markdown/frontmatter

/**
 * Heuristik-basierte Kapitelanalyse auf Markdown-Basis.
 * Stabiler, deterministischer Output ohne externe Abhängigkeiten.
 */

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

/**
 * Erzeugt einen stabilen Hash aus einem String (FNV-1a)
 */
function hashStable(input: string): string {
  let h = 2166136261 >>> 0 // FNV-1a
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `h${(h >>> 0).toString(36)}`
}

/**
 * Analysiert Markdown-Text heuristisch und erkennt Kapitel
 */
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
      .replace(/["'„""'']/g, '')
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

/**
 * Normalisiert Kapitel-Seiten lückenlos: führende Lücken → "Inhalt", interne Lücken → vorheriges Kapitel verlängern
 */
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

export async function analyzeAndMergeChapters(args: ChaptersArgs): Promise<ChaptersResult> {
  const { ctx, baseMeta, textForAnalysis, existingChapters } = args
  const repo = new ExternalJobsRepository()
  const jobId = ctx.jobId

  const content = stripAllFrontmatter(textForAnalysis)
  const hadFrontmatterBefore = textForAnalysis.trimStart().startsWith('---')
  try { await repo.appendLog(jobId, { phase: 'chapters_analyze_start', details: { libraryId: ctx.job.libraryId, textLen: content.length, stripped: hadFrontmatterBefore } } as unknown as Record<string, unknown>) } catch {}

  // Page-Anker extrahieren
  const anchors: Array<{ idx: number; page: number }> = []
  {
    const re = /(<!--\s*page\s*:\s*(\d+)\s*-->)|^\s*[\u2013\u2014\-\u2212\s]*Seite\s+(\d{1,4})\s*[\u2013\u2014\-\u2212\s]*$/gim
    let m: RegExpExecArray | null
    while ((m = re.exec(content))) anchors.push({ idx: m.index, page: Number(m[2] || m[3]) })
  }

  let chapters: ChapterOut[] = []
  let toc: Array<{ title: string; level: number; page?: number }> = []
  let pages: number | undefined

  // Pfad A: vorhandene Kapitel (Frontmatter) wurden mitgeliefert → als Quelle verwenden und lückenfrei normalisieren
  if (Array.isArray(existingChapters) && existingChapters.length > 0) {
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
    const seedChapters: ChapterOut[] = existingChapters.map(toOut).filter(Boolean) as ChapterOut[]
    const norm = normalizeChaptersByPages(content, seedChapters, anchors)
    chapters = norm.chapters
    pages = norm.totalPages
    // Optional: TOC aus Inhalt heuristisch ermitteln, um UI zu versorgen
    const heuristicResult = analyzeHeuristic(content)
    toc = heuristicResult.toc
  } else {
    // Pfad B: Heuristik-basierte Analyse ohne vorhandene Kapitel
    const heuristicResult = analyzeHeuristic(content)
    const norm = normalizeChaptersByPages(content, heuristicResult.chapters, anchors)
    chapters = norm.chapters
    toc = heuristicResult.toc
    pages = norm.totalPages
  }

  try { await repo.appendLog(jobId, { phase: 'chapters_analyze_result', details: { chapters: chapters.length, pages: typeof pages === 'number' ? pages : null } } as unknown as Record<string, unknown>) } catch {}

  let mergedMeta: Frontmatter = { ...(baseMeta || {}) }
  if (chapters.length > 0) {
    const existingChapters: Array<Record<string, unknown>> = Array.isArray(mergedMeta.chapters) ? (mergedMeta.chapters as Array<Record<string, unknown>>) : []
    const norm = chapters as unknown as Array<Record<string, unknown>>
    const normalizeTitle = (s: string) => s.replace(/[\*`_#>\[\]]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    const findMatch = (ec: Record<string, unknown>): Record<string, unknown> | undefined => {
      const o = typeof ec.order === 'number' ? (ec.order as number) : undefined
      const tRaw = typeof ec.title === 'string' ? (ec.title as string) : ''
      const t = normalizeTitle(tRaw)
      let hit = typeof o === 'number' ? norm.find(nc => typeof (nc as { order?: unknown }).order === 'number' && (nc as { order: number }).order === o) : undefined
      if (!hit && t) {
        hit = norm.find(nc => {
          const nt = typeof (nc as { title?: unknown }).title === 'string' ? normalizeTitle((nc as { title: string }).title) : ''
          return nt === t || nt.startsWith(t) || t.startsWith(nt) || nt.includes(t) || t.includes(nt)
        })
      }
      return hit
    }
    const patched = existingChapters.map(ec => {
      const nc = findMatch(ec)
      if (nc) {
        const sp = typeof (nc as { startPage?: unknown }).startPage === 'number' ? (nc as { startPage: number }).startPage : undefined
        const ep = typeof (nc as { endPage?: unknown }).endPage === 'number' ? (nc as { endPage: number }).endPage : undefined
        const next = { ...ec } as Record<string, unknown>
        const hasStart = typeof (next as { startPage?: unknown }).startPage === 'number'
        if (!hasStart && typeof sp === 'number') next.startPage = sp
        const currentEnd = typeof (next as { endPage?: unknown }).endPage === 'number' ? (next as { endPage: number }).endPage : undefined
        if (typeof ep === 'number' && (currentEnd === undefined || ep > currentEnd)) (next as { endPage: number }).endPage = ep
        const ns = typeof (next as { startPage?: unknown }).startPage === 'number' ? (next as { startPage: number }).startPage : undefined
        const ne = typeof (next as { endPage?: unknown }).endPage === 'number' ? (next as { endPage: number }).endPage : undefined
        if (typeof ns === 'number' && typeof ne === 'number') (next as { pageCount: number }).pageCount = Math.max(1, ne - ns + 1)
        return next
      }
      return ec
    })
    mergedMeta = { ...mergedMeta, chapters: patched, toc }
  }
  if (typeof pages === 'number' && typeof (mergedMeta as { pages?: unknown }).pages !== 'number') (mergedMeta as { pages: number }).pages = pages

  const msg = `Kapitel normalisiert: ${Array.isArray(mergedMeta.chapters) ? mergedMeta.chapters.length : 0}${pages ? ` · Seiten ${pages}` : ''}`
  bufferLog(jobId, { phase: 'chapters_normalized', message: msg })
  try { getJobEventBus().emitUpdate(ctx.job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 45, updatedAt: new Date().toISOString(), message: 'chapters_normalized', jobType: ctx.job.job_type, fileName: ctx.job.correlation?.source?.name, sourceItemId: ctx.job.correlation?.source?.itemId }) } catch {}

  return { mergedMeta }
}


