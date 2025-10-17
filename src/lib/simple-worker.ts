import apm from '@/lib/observability/apm2'
import { FileLogger } from '@/lib/debug/logger'
import { SimpleQueueRepository, SimpleJob } from '@/lib/simple-queue-repository'
import { processPdfSimple } from '@/lib/jobs/process-pdf-simple'

// Globaler Zustand, um Mehrfach-Module (Dev/HMR) zu entkoppeln
declare const global: typeof globalThis & { __simpleWorkerState?: { started: boolean; stopping: boolean } }
if (!global.__simpleWorkerState) global.__simpleWorkerState = { started: false, stopping: false }

let __timer: NodeJS.Timeout | null = null

export function getSimpleWorkerStatus(): { state: 'stopped' | 'running' } {
  const s = global.__simpleWorkerState!
  return { state: s.started && !s.stopping ? 'running' : 'stopped' }
}

export function startSimpleWorker(): void {
  const s = global.__simpleWorkerState!
  if (s.started && !s.stopping) return
  s.started = true
  s.stopping = false
  if (!__timer) __timer = setInterval(() => { void tick() }, 1000)
  FileLogger.info('simple-worker', 'Worker gestartet')
  // eslint-disable-next-line no-console
  console.info('simple-worker: started (pid=%s)', process.pid)
  // Nach Start: APM-Testlog als schnelle Funktionsprobe
  void (async () => {
    try {
      const tx = apm.startTransaction('simple.worker.start', 'message')
      const sp = apm.startSpan( 'simple.worker.start.span')
      sp?.end?.();
      tx?.end?.();
    } catch (error) {
      console.error('simple-worker: error', error)
    }
  })()
}

export function ensureSimpleWorkerStarted(): void {
  try { startSimpleWorker() } catch {}
}

function getRepo(): { new(): any } {
  // Laufzeit‑Require, um Node‑only Abhängigkeiten erst im Serverkontext zu laden
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const req = (0, eval)('require') as NodeRequire
  const mod = req('@/lib/simple-queue-repository') as { SimpleQueueRepository: { new(): any } }
  return mod.SimpleQueueRepository
}

async function tick(): Promise<void> {
  const repo = new SimpleQueueRepository()
  try {
    const job = await repo.claimNext()
    if (!job) {
      // eslint-disable-next-line no-console
      console.debug('simple-worker: idle tick (pid=%s)', process.pid)
      return
    }
    FileLogger.info('simple-worker', 'Job geclaimed', { id: job.id, userEmail: job.payload.userEmail })
    // eslint-disable-next-line no-console
    console.info('simple-worker: claimed %s', job.id)
    // Isolierter Async-Scope, damit APM eine eigenständige Root-Transaktion erzeugt (nicht unter HTTP-Request)
    let runInScope: (<T>(fn: () => T) => T) | null = null
    try {
      const mod = await import('node:async_hooks')
      const res = new mod.AsyncResource('simple-worker-root')
      runInScope = <T>(fn: () => T) => res.runInAsyncScope(fn)
    } catch {
      runInScope = null
    }
    const executeJob = async (): Promise<void> => {
      //const jobTx = Logger.startJob('simple.job.pdf', 'message', { jobId: job.id, libraryId: job.payload.libraryId })
      try {
        await processJob(job)
        await repo.complete(job.id)
        FileLogger.info('simple-worker', 'Job verarbeitet', { id: job.id })
        console.info('simple-worker: processed %s', job.id)
      } catch (e) {
        try { await repo.appendLog(job.id, { phase: 'worker_error', message: e instanceof Error ? e.message : String(e) }) } catch {}
        try { await repo.fail(job.id, { message: e instanceof Error ? e.message : String(e), code: 'worker_exception' }) } catch {}
        console.error('simple-worker: job error', e)
      } finally {
        //jobTx.end()
      }
    }
    if (runInScope) await runInScope(async () => { await executeJob() })
    else await executeJob()
  } catch (err) {
    FileLogger.error('simple-worker', 'Tick Fehler', err instanceof Error ? { error: err.message } : { error: String(err) })
    console.error('simple-worker: tick error', err)
  }
}

async function processJob(job: SimpleJob): Promise<void> {
  try { FileLogger.debug('simple-worker', 'APM Trace-IDs') } catch {}
  await processPdfSimple(job, new SimpleQueueRepository())
}

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }


