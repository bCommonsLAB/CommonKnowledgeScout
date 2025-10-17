import { Collection } from 'mongodb';
import type { UpdateOptions } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { FileLogger } from '@/lib/debug/logger';
import { ExternalJob, ExternalJobStatus, ExternalJobStep, ExternalJobIngestionInfo } from '@/types/external-job';

export class ExternalJobsRepository {
  private collectionName = 'external_jobs';

  private async getCollection(): Promise<Collection<ExternalJob>> {
    return getCollection<ExternalJob>(this.collectionName);
  }

  hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  async create(job: Omit<ExternalJob, 'createdAt' | 'updatedAt'>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.insertOne({ ...job, createdAt: now, updatedAt: now });
  }

  async setStatus(jobId: string, status: ExternalJobStatus, extra: Partial<ExternalJob> = {}): Promise<boolean> {
    const col = await this.getCollection();
    const res = await col.updateOne(
      { jobId },
      { $set: { status, updatedAt: new Date(), ...extra } }
    );
    return res.modifiedCount > 0;
  }

  async setProcess(jobId: string, processId: string): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne({ jobId }, { $set: { processId, updatedAt: new Date() } });
  }

  async setResult(jobId: string, payload: ExternalJob['payload'], result: ExternalJob['result']): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { payload, result, updatedAt: new Date() } }
    );
  }

  async mergeParameters(jobId: string, params: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            parameters: { $mergeObjects: [ '$parameters', params ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async initializeSteps(jobId: string, steps: ExternalJobStep[], parameters?: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { steps, updatedAt: new Date(), ...(parameters ? { parameters } : {}) } }
    );
  }

  async updateStep(jobId: string, name: string, patch: Partial<ExternalJobStep>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    const setObj = Object.fromEntries(Object.entries(patch).map(([k, v]) => ([`steps.$.${k}`, v])));
    const spanId = mapStepToSpanId(name);
    const setBase: Record<string, unknown> = { ...setObj, updatedAt: now };
    if (patch.status === 'running' && spanId) setBase['trace.currentSpanId'] = spanId;
    await col.updateOne(
      { jobId, 'steps.name': name },
      { $set: setBase }
    );
    // Trace: Spans/Events automatisch synchronisieren
    try {
      const spanId = mapStepToSpanId(name);
      if (spanId && patch.status) {
        if (patch.status === 'running') {
          await this.traceStartSpan(jobId, { spanId, parentSpanId: 'job', name });
          await this.traceAddEvent(jobId, { spanId, name: 'step_running', attributes: { step: name } });
        } else if (patch.status === 'completed') {
          await this.traceEndSpan(jobId, spanId, 'completed', {});
          await this.traceAddEvent(jobId, { spanId, name: 'step_completed', attributes: { step: name } });
        } else if (patch.status === 'failed') {
          await this.traceEndSpan(jobId, spanId, 'failed', { reason: (patch as { error?: unknown })?.error });
          await this.traceAddEvent(jobId, { spanId, name: 'step_failed', attributes: { step: name, error: (patch as { error?: unknown })?.error } });
        }
      }
    } catch {}
  }

  async appendMeta(jobId: string, meta: Record<string, unknown>, source: string): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      {
        $set: { updatedAt: now },
        $push: { metaHistory: { at: now, meta, source } },
      }
    );
    // Merge cumulativeMeta (shallow)
    await col.updateOne(
      { jobId },
      [
        {
          $set: {
            cumulativeMeta: { $mergeObjects: [ '$cumulativeMeta', meta ] },
            updatedAt: now
          }
        }
      ] as unknown as Record<string, unknown>
    );
  }

  async setIngestion(jobId: string, info: ExternalJobIngestionInfo): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $set: { ingestion: info, updatedAt: new Date() } }
    );
  }

  async get(jobId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.findOne({ jobId });
  }

  async listByUserEmail(
    userEmail: string,
    options: { page?: number; limit?: number }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));
    const cursor = col
      .find({ userEmail })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments({ userEmail })
    ]);
    return { items, total, page, limit };
  }

  async listByUserWithFilters(
    userEmail: string,
    options: {
      page?: number;
      limit?: number;
      status?: ExternalJobStatus | ExternalJobStatus[];
      batchName?: string;
      batchId?: string;
      libraryId?: string;
      q?: string;
    }
  ): Promise<{ items: ExternalJob[]; total: number; page: number; limit: number }>
  {
    const col = await this.getCollection();
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(100, options.limit ?? 20));

    const filter: Record<string, unknown> = { userEmail };
    if (options.libraryId) filter['libraryId'] = options.libraryId;
    if (options.batchId) filter['correlation.batchId'] = options.batchId;
    if (options.batchName) filter['correlation.batchName'] = options.batchName;
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filter['status'] = { $in: statuses };
    }
    if (options.q) {
      const rx = new RegExp(options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [
        { 'correlation.source.name': rx },
        { 'correlation.source.itemId': rx },
        { jobId: rx },
      ];
    }

    const cursor = col
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const [items, total] = await Promise.all([
      cursor.toArray(),
      col.countDocuments(filter)
    ]);
    return { items, total, page, limit };
  }

  async findLatestBySourceItem(userEmail: string, libraryId: string, sourceItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.itemId': sourceItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByResultItem(userEmail: string, resultItemId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, 'result.savedItemId': resultItemId }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestByFileIdAuto(userEmail: string, libraryId: string, fileId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({
      userEmail,
      libraryId,
      $or: [
        { 'correlation.source.itemId': fileId },
        { 'result.savedItemId': fileId }
      ]
    }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async findLatestBySourceName(userEmail: string, libraryId: string, sourceName: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.find({ userEmail, libraryId, 'correlation.source.name': sourceName }).sort({ updatedAt: -1 }).limit(1).next();
  }

  async listDistinctBatchNames(userEmail: string, libraryId?: string): Promise<string[]> {
    const col = await this.getCollection();
    const match: Record<string, unknown> = {
      userEmail,
      'correlation.batchName': { $type: 'string', $ne: '' }
    };
    if (libraryId) match['libraryId'] = libraryId;
    const rows = await col.aggregate<{ _id: string }>([
      { $match: match },
      { $group: { _id: '$correlation.batchName' } },
      { $sort: { _id: 1 } }
    ]).toArray();
    return rows.map(r => r._id).filter((v): v is string => typeof v === 'string' && v.length > 0);
  }

  async countByStatus(
    userEmail: string,
    filters: { libraryId?: string; batchName?: string; batchId?: string }
  ): Promise<{ queued: number; running: number; completed: number; failed: number; pendingStorage: number; total: number }>
  {
    const col = await this.getCollection();
    const match: Record<string, unknown> = { userEmail };
    if (filters.libraryId) match['libraryId'] = filters.libraryId;
    if (filters.batchId) match['correlation.batchId'] = filters.batchId;
    if (filters.batchName) match['correlation.batchName'] = filters.batchName;

    const rows = await col.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    const by: Record<string, number> = Object.fromEntries(rows.map(r => [r._id, r.count]));
    const queued = by['queued'] || 0;
    const running = by['running'] || 0;
    const completed = by['completed'] || 0;
    const failed = by['failed'] || 0;
    const pendingStorage = by['pending-storage'] || 0;
    const total = queued + running + completed + failed + pendingStorage;
    return { queued, running, completed, failed, pendingStorage, total };
  }

  // ---- Worker-Unterstützung ----
  async claimNextQueuedJob(): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    const now = new Date();
    FileLogger.info('external-jobs-repo', 'claim_attempt_start', {} as unknown as Record<string, unknown>);
    // Phase 1: Kandidaten lesen (stabilste Reihenfolge via updatedAt)
    const candidate = await col.find({ status: 'queued' }).sort({ updatedAt: 1 }).limit(1).next();
    if (!candidate) {
      FileLogger.info('external-jobs-repo', 'claim_none', {} as unknown as Record<string, unknown>);
      return null;
    }
    // Phase 2: Guarded Update auf genau diesen Job
    const upd = await col.updateOne(
      { jobId: candidate.jobId, status: 'queued' },
      { $set: { status: 'running', updatedAt: now } }
    );
    if (upd.modifiedCount === 1) {
      const doc = await col.findOne({ jobId: candidate.jobId });
      if (doc) FileLogger.info('external-jobs-repo', 'claim_success', { jobId: doc.jobId });
      return doc as ExternalJob | null;
    }
    FileLogger.info('external-jobs-repo', 'claim_race_lost', { jobId: candidate.jobId } as unknown as Record<string, unknown>);
    return null;
  }

  async listQueued(limit: number = 50): Promise<ExternalJob[]> {
    const col = await this.getCollection();
    return col.find({ status: 'queued' }).sort({ updatedAt: 1 }).limit(Math.max(1, Math.min(500, limit)) ).toArray();
  }

  async countRunning(): Promise<number> {
    const col = await this.getCollection();
    return col.countDocuments({ status: 'running' });
  }

  // ---- Trace-Unterstützung ----
  async initializeTrace(jobId: string): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      { $set: { 'trace.spans': [ { spanId: 'job', name: 'job', status: 'running', startedAt: now } ], 'trace.events': [] } }
    );
  }

  async traceStartSpan(jobId: string, span: { spanId: string; parentSpanId?: string; name: string; phase?: number; attributes?: Record<string, unknown> }): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      { $push: { 'trace.spans': { spanId: span.spanId, parentSpanId: span.parentSpanId, name: span.name, phase: span.phase, status: 'running', startedAt: now, attributes: span.attributes || {} } }, $set: { updatedAt: now } }
    );
  }

  async traceEndSpan(jobId: string, spanId: string, status: 'completed' | 'failed' | 'skipped', attrs?: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    await col.updateOne(
      { jobId },
      { $set: { 'trace.spans.$[s].endedAt': now, 'trace.spans.$[s].status': status, 'trace.spans.$[s].attributes': attrs || {} } },
      { arrayFilters: [ { 's.spanId': spanId, 's.endedAt': { $exists: false } } ] } as unknown as UpdateOptions
    );
  }

  async traceAddEvent(jobId: string, evt: { spanId?: string; name: string; level?: 'info' | 'warn' | 'error'; message?: string; attributes?: Record<string, unknown> }): Promise<void> {
    const col = await this.getCollection();
    let spanId = evt.spanId;
    if (!spanId) {
      const doc = await col.findOne({ jobId }, { projection: { 'trace.currentSpanId': 1 } });
      const cur = ((doc as unknown as { trace?: { currentSpanId?: string } })?.trace?.currentSpanId) || undefined;
      if (cur) spanId = cur;
    }
    await col.updateOne(
      { jobId },
      { $push: { 'trace.events': { ts: new Date(), spanId, name: evt.name, level: evt.level || 'info', message: evt.message, attributes: evt.attributes || {} } } }
    );
  }

  // DEPRECATED: Alte Logs in trace.events umlenken (Single-Source)
  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    try {
      const name = typeof (entry as { phase?: unknown }).phase === 'string' ? String((entry as { phase: unknown }).phase) : (typeof (entry as { message?: unknown }).message === 'string' ? String((entry as { message: unknown }).message) : 'log');
      const msg = typeof (entry as { message?: unknown }).message === 'string' ? String((entry as { message: unknown }).message) : undefined;
      const attrs = entry;
      await this.traceAddEvent(jobId, { name, message: msg, attributes: attrs });
    } catch {
      // fallback: nichts
    }
  }
}

function mapStepToSpanId(name: string): 'extract' | 'template' | 'store' | 'ingest' | undefined {
  if (name === 'extract_pdf') return 'extract';
  if (name === 'transform_template') return 'template';
  if (name === 'store_shadow_twin') return 'store';
  if (name === 'ingest_rag') return 'ingest';
  return undefined;
}


