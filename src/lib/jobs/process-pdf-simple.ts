import { SimpleJob, SimpleQueueRepository } from '@/lib/simple-queue-repository'
import { FileLogger } from '@/lib/debug/logger'
import { withApmSpan } from '@/lib/observability/apm'

export async function processPdfSimple(job: SimpleJob, repo: SimpleQueueRepository): Promise<void> {
  // Schritt 1: extract_pdf
  await repo.appendLog(job.id, { phase: 'initializing', message: 'Job gestartet' })
  // eslint-disable-next-line no-console
  console.info('simple-processor: initializing %s', job.id)
  await repo.updateStep(job.id, 'extract_pdf', { status: 'running', startedAt: new Date() })
  try {
    await withApmSpan('step.extract_pdf', async () => {
      await withApmSpan('gate.extract', async () => {})
      // Simulierter Workload, damit APM/Logs sichtbar sind
      await sleep(200)
      await withApmSpan('secretary.request', async () => { await sleep(150) })
      await withApmSpan('save.shadow_twin', async () => { await sleep(100) })
    })
    console.info('simple-processor: extract done %s', job.id)
    await repo.appendLog(job.id, { phase: 'extract_gate_plan', message: 'Gate erlaubt Extract' })
    await repo.appendLog(job.id, { phase: 'request_sent', message: 'Secretary Request (placeholder)' })
    await repo.appendLog(job.id, { phase: 'request_ack', message: 'Secretary ACK (placeholder)' })
    await repo.updateStep(job.id, 'extract_pdf', { status: 'completed', endedAt: new Date() })
  } catch (e) {
    await repo.updateStep(job.id, 'extract_pdf', { status: 'failed', endedAt: new Date(), error: { message: e instanceof Error ? e.message : String(e) } })
    await repo.fail(job.id, { message: e instanceof Error ? e.message : String(e), code: 'extract_failed' })
    FileLogger.error('simple-processor', 'Extract fehlgeschlagen', e)
    return
  }

  // Schritt 2: transform_template
  await repo.updateStep(job.id, 'transform_template', { status: 'running', startedAt: new Date() })
  try {
    await withApmSpan('step.transform_template', async () => {
      await withApmSpan('gate.template', async () => {})
      await sleep(120)
      await withApmSpan('template.request', async () => { await sleep(120) })
      await withApmSpan('save.shadow_twin', async () => { await sleep(80) })
    })
    console.info('simple-processor: transform done %s', job.id)
    await repo.appendLog(job.id, { phase: 'transform_gate_plan', message: 'Gate erlaubt Template' })
    await repo.appendLog(job.id, { phase: 'template_request_sent', message: 'Template Request (placeholder)' })
    await repo.appendLog(job.id, { phase: 'template_request_ack', message: 'Template ACK (placeholder)' })
    await repo.updateStep(job.id, 'transform_template', { status: 'completed', endedAt: new Date() })
  } catch (e) {
    await repo.updateStep(job.id, 'transform_template', { status: 'failed', endedAt: new Date(), error: { message: e instanceof Error ? e.message : String(e) } })
    await repo.fail(job.id, { message: e instanceof Error ? e.message : String(e), code: 'template_failed' })
    FileLogger.error('simple-processor', 'Template fehlgeschlagen', e)
    return
  }

  // Schritt 3: ingest_rag
  await repo.updateStep(job.id, 'ingest_rag', { status: 'running', startedAt: new Date() })
  try {
    await withApmSpan('step.ingest_rag', async () => {
      await withApmSpan('gate.ingest', async () => {})
      await withApmSpan('ingest.chunk', async () => { await sleep(120) })
      await withApmSpan('ingest.embed', async () => { await sleep(120) })
      await withApmSpan('ingest.pinecone', async () => { await sleep(80) })
    })
    console.info('simple-processor: ingest done %s', job.id)
    await repo.appendLog(job.id, { phase: 'ingest_gate_plan', message: 'Gate erlaubt Ingestion' })
    await repo.appendLog(job.id, { phase: 'ingest_chunking_done', message: 'Chunking (placeholder)' })
    await repo.appendLog(job.id, { phase: 'ingest_pinecone_upserted', message: 'Pinecone Upsert (placeholder)' })
    await repo.updateStep(job.id, 'ingest_rag', { status: 'completed', endedAt: new Date() })
  } catch (e) {
    await repo.updateStep(job.id, 'ingest_rag', { status: 'failed', endedAt: new Date(), error: { message: e instanceof Error ? e.message : String(e) } })
    await repo.fail(job.id, { message: e instanceof Error ? e.message : String(e), code: 'ingest_failed' })
    FileLogger.error('simple-processor', 'Ingestion fehlgeschlagen', e)
    return
  }

  await repo.appendLog(job.id, { phase: 'completed', message: 'Job abgeschlossen' })
  await repo.complete(job.id)
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }


