import { NextRequest, NextResponse } from 'next/server'
import { getAuth, currentUser } from '@clerk/nextjs/server'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getPublicAppUrl, getSecretaryConfig } from '@/lib/env'
import { getJobEventBus } from '@/lib/events/job-event-bus'
import { startWatchdog } from '@/lib/external-jobs-watchdog'
import { preprocess } from '@/lib/external-jobs/preprocess'
import type { RequestContext } from '@/types/external-jobs'
import type { PreprocessResult } from '@/lib/external-jobs/preprocess'
import { runIngestion } from '@/lib/external-jobs/ingest'
import { setJobCompleted } from '@/lib/external-jobs/complete'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { isInternalAuthorized } from '@/lib/external-jobs/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Interner Worker darf ohne Clerk durch, wenn Token korrekt
    const internal = isInternalAuthorized(request)
    let userEmail = ''
    if (!internal.isInternal) {
      const { userId } = getAuth(request)
      if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
      const user = await currentUser()
      userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
      if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 })
    }
    const { jobId } = await params
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 })

    const repo = new ExternalJobsRepository()
    const job = await repo.get(jobId)
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 })
    if (!internal.isInternal) {
      if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const alreadyRequested = (() => {
      try {
        const evts = ((job as unknown as { trace?: { events?: Array<{ name?: unknown }> } }).trace?.events) || []
        return Array.isArray(evts) && evts.some(e => typeof e?.name === 'string' && (
          e.name === 'request_ack' || e.name === 'secretary_request_ack' || e.name === 'secretary_request_accepted'
        ))
      } catch { return false }
    })()
    if (alreadyRequested) {
      try { await repo.traceAddEvent(jobId, { spanId: 'job', name: 'start_already_started' }) } catch {}
      return NextResponse.json({ ok: true, status: 'already_started' }, { status: 202 })
    }

    // Secretary-Aufruf vorbereiten (aus alter Retry-Startlogik entnommen, minimal)
    const provider = await getServerProvider(job.userEmail, job.libraryId)
    const src = job.correlation?.source
    if (!src?.itemId || !src?.parentId) return NextResponse.json({ error: 'Quelle unvollständig' }, { status: 400 })
    const bin = await provider.getBinary(src.itemId)
    const filename = src.name || 'document.pdf'
    const file = new File([bin.blob], filename, { type: src.mimeType || bin.mimeType || 'application/pdf' })

    // Initialisiere Trace früh, damit Preprocess-Span nicht überschrieben wird
    try { await repo.initializeTrace(jobId) } catch {}

    // PreProcess vor dem Extract: Sichtbarkeit im Trace sicherstellen
    let pre: PreprocessResult | null = null
    const ctxPre: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
    try {
      await repo.traceStartSpan(jobId, { spanId: 'preprocess', parentSpanId: 'job', name: 'preprocess' })
      pre = await preprocess(ctxPre)
      await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'preprocess_summary', attributes: { hasMarkdown: pre.hasMarkdown, hasFrontmatter: pre.hasFrontmatter, frontmatterValid: pre.frontmatterValid } })
      await repo.traceEndSpan(jobId, 'preprocess', 'completed', {})
    } catch {}

    const form = new FormData()
    form.append('file', file)
    const opts = (job.correlation?.options || {}) as Record<string, unknown>
    form.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de')
    form.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native')
    form.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true))
    form.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false))

    const appUrl = getPublicAppUrl()
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 })
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters)
    await repo.setStatus(jobId, 'running')
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'process_pdf_submit', attributes: {
      libraryId: job.libraryId,
      fileName: filename,
      extractionMethod: opts['extractionMethod'] ?? job.correlation?.options?.extractionMethod ?? undefined,
      targetLanguage: opts['targetLanguage'] ?? job.correlation?.options?.targetLanguage ?? undefined,
      includeImages: opts['includeImages'] ?? job.correlation?.options?.includeImages ?? undefined,
      useCache: opts['useCache'] ?? job.correlation?.options?.useCache ?? undefined,
      template: (job.parameters as Record<string, unknown> | undefined)?.['template'] ?? undefined,
      phases: (job.parameters as Record<string, unknown> | undefined)?.['phases'] ?? undefined,
    } })

    form.append('callback_url', callbackUrl)

    // Entscheidungslogik: Ingest-only, wenn Shadow‑Twin + gültiges FM vorhanden und Phasen es erlauben
    const phases = (job.parameters && typeof job.parameters === 'object') ? (job.parameters as { phases?: { extract?: boolean; template?: boolean; ingest?: boolean } }).phases : undefined
    const extractEnabled = phases?.extract !== false
    const templateEnabled = phases?.template !== false
    const ingestEnabled = phases?.ingest !== false
    const needExtract = !(pre && pre.hasMarkdown)
    const needTemplate = !(pre && pre.hasFrontmatter && pre.frontmatterValid)
    const runExtract = extractEnabled && needExtract
    const runTemplate = templateEnabled && needTemplate
    const runIngestOnly = ingestEnabled && !runExtract && !runTemplate

    if (runIngestOnly) {
      try { await repo.updateStep(jobId, 'extract_pdf', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_has_markdown' } }) } catch {}
      try { await repo.updateStep(jobId, 'transform_template', { status: 'completed', endedAt: new Date(), details: { skipped: true, reason: 'preprocess_frontmatter_valid' } }) } catch {}
      try { await repo.updateStep(jobId, 'ingest_rag', { status: 'running', startedAt: new Date() }) } catch {}
      try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_start', attributes: { libraryId: job.libraryId } }) } catch {}

      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const twinName = `${baseName}.${lang}.md`
      const parentId = job.correlation?.source?.parentId || 'root'
      const siblings = await provider.listItemsById(parentId)
      const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === twinName) as { id: string } | undefined
      if (!twin) {
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: 'Shadow‑Twin nicht gefunden' } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'shadow_twin_missing', message: 'Shadow‑Twin nicht gefunden' } })
        return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      }
      const bin2 = await provider.getBinary(twin.id)
      const markdownText = await bin2.blob.text()
      const parsed = parseSecretaryMarkdownStrict(markdownText)
      const meta = (parsed?.meta && typeof parsed.meta === 'object') ? (parsed.meta as Record<string, unknown>) : {}
      const ctx2: RequestContext = { request, jobId, job, body: {}, callbackToken: undefined, internalBypass: true }
      try {
        const res = await runIngestion({ ctx: ctx2, savedItemId: twin.id, fileName: twinName, markdown: markdownText, meta: meta as unknown as import('@/types/external-jobs').Frontmatter })
        const total = res.chunksUpserted + (res.docUpserted ? 1 : 0)
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_pinecone_upserted', attributes: { chunks: res.chunksUpserted, doc: res.docUpserted, total, vectorFileId: twin.id } }) } catch {}
        try { await repo.traceAddEvent(jobId, { spanId: 'ingest', name: 'ingest_doc_id', attributes: { vectorFileId: twin.id, fileName: twinName } }) } catch {}
        await repo.updateStep(jobId, 'ingest_rag', { status: 'completed', endedAt: new Date() })
        const completed = await setJobCompleted({ ctx: ctx2, result: { savedItemId: twin.id } })
        getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'completed', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
        return NextResponse.json({ ok: true, jobId: completed.jobId, kind: 'ingest_only' })
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        await repo.updateStep(jobId, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: reason } })
        await repo.setStatus(jobId, 'failed', { error: { code: 'ingestion_failed', message: reason } })
        return NextResponse.json({ error: reason }, { status: 500 })
      }
    }

    // Template-only: vorhandenes Markdown nutzen, Frontmatter reparieren lassen
    if (!runExtract && runTemplate) {
      const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
      const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
      const twinName = `${baseName}.${lang}.md`
      const parentId = job.correlation?.source?.parentId || 'root'
      const siblings = await provider.listItemsById(parentId)
      const twin = siblings.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name === twinName) as { id: string } | undefined
      if (!twin) return NextResponse.json({ error: 'Shadow‑Twin nicht gefunden' }, { status: 404 })
      const bin2 = await provider.getBinary(twin.id)
      const markdownText = await bin2.blob.text()
      const parsed = parseSecretaryMarkdownStrict(markdownText) as unknown as { body?: string }
      const bodyOnly = typeof parsed?.body === 'string' ? parsed.body as string : markdownText

      // interner Callback mit extracted_text → Orchestrator führt Template/Save/Ingest aus
      const internalToken = process.env.INTERNAL_TEST_TOKEN || ''
      const cbRes = await fetch(`${getPublicAppUrl().replace(/\/$/, '')}/api/external/jobs/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(internalToken ? { 'X-Internal-Token': internalToken } : {}) },
        body: JSON.stringify({ data: { extracted_text: bodyOnly } })
      })
      if (!cbRes.ok) return NextResponse.json({ error: 'Template-Only Callback fehlgeschlagen', status: cbRes.status }, { status: 502 })
      return NextResponse.json({ ok: true, jobId, kind: 'template_only' })
    }

    // Secretary-Flow (Extract/Template)
    const secret = (await import('crypto')).randomBytes(24).toString('base64url')
    const secretHash = repo.hashSecret(secret)
    await repo.setStatus(jobId, 'running', { jobSecretHash: secretHash })
    form.append('callback_token', secret)

    const { baseUrl, apiKey } = getSecretaryConfig()
    if (!apiKey) return NextResponse.json({ error: 'SECRETARY_SERVICE_API_KEY fehlt' }, { status: 500 })
    const url = `${baseUrl}/pdf/process`
    const headers: Record<string, string> = { 'x-worker': 'true', 'Authorization': `Bearer ${apiKey}`, 'X-Service-Token': apiKey }
    const resp = await fetch(url, { method: 'POST', body: form, headers })
    await repo.traceAddEvent(jobId, { spanId: 'preprocess', name: 'request_ack', attributes: { status: resp.status, statusText: resp.statusText } })
    if (!resp.ok) {
      await repo.setStatus(jobId, 'failed')
      return NextResponse.json({ error: 'Secretary Fehler', status: resp.status }, { status: 502 })
    }
    const data = await resp.json().catch(() => ({}))
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'running', progress: 0, updatedAt: new Date().toISOString(), message: 'enqueued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId })
    startWatchdog({ jobId, userEmail: job.userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000)
    return NextResponse.json({ ok: true, jobId, data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 })
  }
}


