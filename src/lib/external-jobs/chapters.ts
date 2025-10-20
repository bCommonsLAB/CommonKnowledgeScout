import type { ChaptersArgs, ChaptersResult, Frontmatter } from '@/types/external-jobs'
import { bufferLog } from '@/lib/external-jobs-log-buffer'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getPolicies } from '@/lib/processing/phase-policy'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'

// Frontmatter-Stripper zentralisiert in markdown/frontmatter

export async function analyzeAndMergeChapters(args: ChaptersArgs): Promise<ChaptersResult> {
  const { ctx, baseMeta, textForAnalysis, existingChapters } = args
  const repo = new ExternalJobsRepository()
  const jobId = ctx.jobId

  const internalToken = process.env.INTERNAL_TEST_TOKEN || ''
  const selfBase = (() => {
    const explicit = (process.env.INTERNAL_SELF_BASE_URL || '').replace(/\/$/, '')
    if (explicit) return explicit
    try { return new URL(ctx.request.url).origin } catch {}
    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
    if (base) return base
    const port = String(process.env.PORT || '3000')
    return `http://127.0.0.1:${port}`
  })()

  const content = stripAllFrontmatter(textForAnalysis)
  const hadFrontmatterBefore = textForAnalysis.trimStart().startsWith('---')
  try { await repo.appendLog(jobId, { phase: 'chapters_analyze_call', details: { base: selfBase, libraryId: ctx.job.libraryId, textLen: content.length, stripped: hadFrontmatterBefore } } as unknown as Record<string, unknown>) } catch {}

  const chapterInForApi: Array<Record<string, unknown>> | undefined = Array.isArray(existingChapters) ? existingChapters as Array<Record<string, unknown>> : undefined
  const port = String(process.env.PORT || '3000')
  const analyzeTimeoutMs = Number(process.env.ANALYZE_REQUEST_TIMEOUT_MS || 120000)
  const reqBody = JSON.stringify({ fileId: ctx.job.correlation?.source?.itemId || ctx.job.jobId, content, mode: 'heuristic', chaptersIn: chapterInForApi })
  const candidates = Array.from(new Set([
    selfBase.replace(/\/$/, ''),
    (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, ''),
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`
  ])).filter(Boolean)
  let res: Response | null = null
  let lastErr: string | undefined
  for (const base of candidates) {
    try {
      try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'chapters_analyze_attempt', attributes: { base, timeoutMs: analyzeTimeoutMs } }) } catch {}
      res = await fetchWithTimeout(`${base}/api/chat/${encodeURIComponent(ctx.job.libraryId)}/analyze-chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-External-Job': ctx.jobId, ...(internalToken ? { 'X-Internal-Token': internalToken } : {}) },
        body: reqBody,
        timeoutMs: analyzeTimeoutMs
      })
      if (res.ok || res.status >= 400) break
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
      try { bufferLog(jobId, { phase: 'chapters_analyze_attempt_failed', details: { base, error: lastErr } }) } catch {}
    }
  }
  if (!res) throw new Error(lastErr || 'Analyze-Endpoint unerreichbar')
  if (!res.ok) {
    const ingestPlanned = (() => { try { const p = getPolicies({ parameters: ctx.job.parameters || {} }); return p.ingest !== 'ignore' } catch { return true } })()
    if (ingestPlanned) throw Object.assign(new Error('Kapitel-Normalisierung fehlgeschlagen'), { code: 'chapters_failed' })
    return { mergedMeta: baseMeta }
  }

  const data = await res.json().catch(() => ({})) as { result?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>>; stats?: { chapterCount?: number; pages?: number } } }
  const chap = Array.isArray(data?.result?.chapters) ? data!.result!.chapters! : []
  const toc = Array.isArray(data?.result?.toc) ? data!.result!.toc! : []
  const pages = typeof data?.result?.stats?.pages === 'number' ? data!.result!.stats!.pages : undefined
  try { await repo.appendLog(jobId, { phase: 'chapters_analyze_result', details: { chapters: chap.length, pages: typeof pages === 'number' ? pages : null } } as unknown as Record<string, unknown>) } catch {}

  let mergedMeta: Frontmatter = { ...(baseMeta || {}) }
  if (chap.length > 0) {
  const existingChapters: Array<Record<string, unknown>> = Array.isArray(mergedMeta.chapters) ? (mergedMeta.chapters as Array<Record<string, unknown>>) : []
    const norm = chap as Array<Record<string, unknown>>
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


