import { Collection, ObjectId } from 'mongodb'
import { getCollection } from '@/lib/mongodb-service'

export type SimpleJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface SimpleJobStep {
  name: 'extract_pdf' | 'transform_template' | 'ingest_rag'
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: Date
  endedAt?: Date
  skipped?: boolean
  error?: { message: string }
}

export interface SimpleJobLogEntry {
  timestamp: Date
  phase: string
  message?: string
  progress?: number
  [k: string]: unknown
}

export interface SimpleJobPayload {
  userEmail: string
  libraryId: string
  source: { itemId: string; parentId: string; name?: string; mimeType?: string }
  options?: Record<string, unknown>
}

export interface SimpleJob {
  _id?: ObjectId
  id: string
  type: 'pdf'
  status: SimpleJobStatus
  attempts: number
  maxAttempts: number
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  finishedAt?: Date
  processId?: string
  heartbeatAt?: Date
  payload: SimpleJobPayload
  steps: SimpleJobStep[]
  logs: SimpleJobLogEntry[]
  error?: { message: string; code?: string; details?: Record<string, unknown> }
}

function now(): Date { return new Date() }

export class SimpleQueueRepository {
  private collectionName = 'simple_jobs'

  private async col(): Promise<Collection<SimpleJob>> {
    return getCollection<SimpleJob>(this.collectionName)
  }

  async enqueue(job: Omit<SimpleJob, 'createdAt' | 'updatedAt' | 'attempts' | 'status' | 'logs' | 'steps' | 'maxAttempts'> & { steps?: SimpleJobStep[]; maxAttempts?: number }): Promise<string> {
    const col = await this.col()
    const doc: SimpleJob = {
      ...job,
      status: 'queued',
      attempts: 0,
      maxAttempts: typeof (job as { maxAttempts?: number }).maxAttempts === 'number' ? Math.max(1, (job as { maxAttempts?: number }).maxAttempts as number) : 3,
      createdAt: now(),
      updatedAt: now(),
      steps: job.steps ?? [
        { name: 'extract_pdf', status: 'pending' },
        { name: 'transform_template', status: 'pending' },
        { name: 'ingest_rag', status: 'pending' },
      ],
      logs: [],
    }
    await col.insertOne(doc)
    return doc.id
  }

  async get(id: string): Promise<SimpleJob | null> {
    const col = await this.col()
    return col.findOne({ id })
  }

  async appendLog(id: string, entry: Omit<SimpleJobLogEntry, 'timestamp'>): Promise<void> {
    const col = await this.col()
    const log: SimpleJobLogEntry = { timestamp: now(), phase: 'log', ...(entry as Partial<SimpleJobLogEntry>) }
    await col.updateOne({ id }, { $push: { logs: log }, $set: { updatedAt: now() } })
  }

  async updateStep(id: string, name: SimpleJobStep['name'], patch: Partial<SimpleJobStep>): Promise<void> {
    const col = await this.col()
    const setObj = Object.fromEntries(Object.entries(patch).map(([k, v]) => ([`steps.$.${k}`, v])))
    await col.updateOne({ id, 'steps.name': name }, { $set: { ...setObj, updatedAt: now() } })
  }

  async claimNext(): Promise<SimpleJob | null> {
    const col = await this.col()
    const procId = `${process.pid}-${Math.random().toString(16).slice(2)}`
    const staleMs = Math.max(10_000, Number(process.env.SIMPLE_QUEUE_STALE_MS || '60000'))
    const threshold = new Date(Date.now() - staleMs)
    // 1) Bevorzugt queued claimen (stabilste Abfrage)
    const resQueued = await col.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'running', startedAt: now(), heartbeatAt: now(), updatedAt: now(), processId: procId }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: 'after' }
    )
    const docQueued = (resQueued as unknown as { value?: SimpleJob })?.value ?? (resQueued as unknown as SimpleJob | null)
    if (docQueued) return docQueued
    // 2) Fallback: stale running re‑claimen
    const resStale = await col.findOneAndUpdate(
      { status: 'running', heartbeatAt: { $lt: threshold } },
      { $set: { status: 'running', startedAt: now(), heartbeatAt: now(), updatedAt: now(), processId: procId }, $inc: { attempts: 1 } },
      { sort: { updatedAt: 1 }, returnDocument: 'after' }
    )
    const docStale = (resStale as unknown as { value?: SimpleJob })?.value ?? (resStale as unknown as SimpleJob | null)
    return docStale || null
  }

  async heartbeat(id: string, processId?: string): Promise<void> {
    const col = await this.col()
    const filter: Record<string, unknown> = { id }
    if (processId) filter['processId'] = processId
    await col.updateOne(filter, { $set: { heartbeatAt: now(), updatedAt: now() } })
  }

  async complete(id: string): Promise<void> {
    const col = await this.col()
    await col.updateOne({ id }, { $set: { status: 'completed', finishedAt: now(), updatedAt: now() } })
  }

  async fail(id: string, error: { message: string; code?: string; details?: Record<string, unknown> }): Promise<void> {
    const col = await this.col()
    await col.updateOne({ id }, { $set: { status: 'failed', finishedAt: now(), updatedAt: now(), error } })
  }

  async counters(): Promise<{ queued: number; running: number; completed: number; failed: number; total: number }> {
    const col = await this.col()
    const rows = await col.aggregate<{ _id: SimpleJobStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).toArray()
    const by: Record<string, number> = Object.fromEntries(rows.map(r => [r._id, r.count]))
    const queued = by['queued'] || 0
    const running = by['running'] || 0
    const completed = by['completed'] || 0
    const failed = by['failed'] || 0
    const total = queued + running + completed + failed
    return { queued, running, completed, failed, total }
  }

  async list(page: number = 1, limit: number = 20): Promise<{ items: Array<Pick<SimpleJob, 'id' | 'status' | 'steps' | 'logs' | 'payload' | 'updatedAt' | 'createdAt'>>; total: number; page: number; limit: number }> {
    const col = await this.col()
    const p = Math.max(1, page)
    const l = Math.max(1, Math.min(100, limit))
    const cursor = col.find({}, { projection: { _id: 0, id: 1, status: 1, steps: 1, logs: { $slice: -1 }, payload: 1, updatedAt: 1, createdAt: 1 } }).sort({ updatedAt: -1 }).skip((p - 1) * l).limit(l)
    const [items, total] = await Promise.all([cursor.toArray(), col.countDocuments({})])
    return { items, total, page: p, limit: l }
  }
}


