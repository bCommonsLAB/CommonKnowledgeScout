import { Collection } from 'mongodb';
import type { UpdateOptions } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { ExternalJob, ExternalJobStatus, ExternalJobStep, ExternalJobIngestionInfo } from '@/types/external-job';

export class ExternalJobsRepository {
  private collectionName = 'external_jobs';

  private async getCollection(): Promise<Collection<ExternalJob>> {
    const col = await getCollection<ExternalJob>(this.collectionName);
    // PERFORMANCE: Stelle sicher, dass Indizes vorhanden sind (nur beim ersten Aufruf)
    try {
      await Promise.all([
        // Index auf jobId für Lookups
        col.createIndex({ jobId: 1 }, { unique: true, name: 'jobId_unique' }),
        // Index auf userEmail für User-Queries
        col.createIndex({ userEmail: 1 }, { name: 'userEmail' }),
        // Index auf status für Status-Filterung
        col.createIndex({ status: 1 }, { name: 'status' }),
        // Verbund-Indizes für häufig verwendete Query-Patterns
        // userEmail + libraryId + correlation.source.itemId (für findLatestBySourceItem)
        col.createIndex({ userEmail: 1, libraryId: 1, 'correlation.source.itemId': 1 }, { name: 'user_library_sourceItem' }),
        // userEmail + libraryId + correlation.source.name (für findLatestBySourceName)
        col.createIndex({ userEmail: 1, libraryId: 1, 'correlation.source.name': 1 }, { name: 'user_library_sourceName' }),
        // userEmail + result.savedItemId (für findLatestByResultItem)
        col.createIndex({ userEmail: 1, 'result.savedItemId': 1 }, { name: 'user_resultItem' }),
        // Status + updatedAt für Worker-Queries (claimNextQueuedJob)
        col.createIndex({ status: 1, updatedAt: 1 }, { name: 'status_updatedAt' }),
        // userEmail + updatedAt für Sortierung
        col.createIndex({ userEmail: 1, updatedAt: -1 }, { name: 'user_updatedAt_desc' }),
      ]);
    } catch {
      // Fehler ignorieren (Indizes könnten bereits existieren)
    }
    return col;
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
    // Job-Root-Span automatisch beenden
    if (status === 'completed' || status === 'failed') {
      try {
        const now = new Date();
        await col.updateOne(
          { jobId },
          { $set: { 'trace.spans.$[s].endedAt': now, 'trace.spans.$[s].status': status } },
          { arrayFilters: [ { 's.spanId': 'job', 's.endedAt': { $exists: false } } ] } as unknown as UpdateOptions
        );
      } catch {}
    }
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
          const parentSpanId = 'job';
          await this.traceStartSpan(jobId, { spanId, parentSpanId, name });
          await this.traceAddEvent(jobId, { spanId, name: 'step_running', attributes: { step: name } });
        } else if (patch.status === 'completed') {
          await this.traceEndSpan(jobId, spanId, 'completed', {});
          const sourceAttr = (() => {
            try {
              const src = (patch as { details?: { source?: unknown } })?.details?.source
              return typeof src === 'string' ? src : undefined
            } catch { return undefined }
          })()
          await this.traceAddEvent(jobId, { spanId, name: 'step_completed', attributes: { step: name, ...(sourceAttr ? { source: sourceAttr } : {}) } });
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

  async delete(jobId: string): Promise<boolean> {
    const col = await this.getCollection();
    const res = await col.deleteOne({ jobId });
    return res.deletedCount === 1;
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
    // Ruhiger: keine lauten Info-Logs hier
    // Phase 1: Kandidaten lesen (stabilste Reihenfolge via updatedAt)
    const candidate = await col.find({ status: 'queued' }).sort({ updatedAt: 1 }).limit(1).next();
    if (!candidate) {
      return null;
    }
    // Phase 2: Guarded Update auf genau diesen Job
    const upd = await col.updateOne(
      { jobId: candidate.jobId, status: 'queued' },
      { $set: { status: 'running', updatedAt: now } }
    );
    if (upd.modifiedCount === 1) {
      const doc = await col.findOne({ jobId: candidate.jobId });
      return doc as ExternalJob | null;
    }
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

  async traceStartSpan(jobId: string, span: { spanId: string; parentSpanId?: string; name: string; phase?: number; attributes?: Record<string, unknown>; startedAt?: Date }): Promise<void> {
    const col = await this.getCollection();
    const now = new Date();
    const startedAt = span.startedAt instanceof Date ? span.startedAt : now;
    await col.updateOne(
      { jobId },
      { $push: { 'trace.spans': { spanId: span.spanId, parentSpanId: span.parentSpanId, name: span.name, phase: span.phase, status: 'running', startedAt, attributes: span.attributes || {} } }, $set: { updatedAt: now } }
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

  async traceAddEvent(jobId: string, evt: { spanId?: string; name: string; level?: 'info' | 'warn' | 'error'; message?: string; attributes?: Record<string, unknown>; eventId?: string }): Promise<void> {
    const col = await this.getCollection();
    let spanId = evt.spanId;
    if (!spanId) {
      const doc = await col.findOne({ jobId }, { projection: { 'trace.currentSpanId': 1 } });
      const cur = ((doc as unknown as { trace?: { currentSpanId?: string } })?.trace?.currentSpanId) || undefined;
      if (cur) spanId = cur;
    }
    const now = new Date();
    // eindeutige, nicht-deterministische ID je Auftreten (keine De-Dupe!)
    const eventId = (evt.eventId && String(evt.eventId)) || `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
    await col.updateOne(
      { jobId },
      { $push: { 'trace.events': { eventId, ts: now, spanId, name: evt.name, level: evt.level || 'info', message: evt.message, attributes: evt.attributes || {} } }, $set: { updatedAt: now, ...(spanId ? { 'trace.currentSpanId': spanId } : {}) } }
    );
  }

  // DEPRECATED: Alte Logs in trace.events umlenken (Single-Source)
  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    try {
      // Replays aus dem Log-Puffer enthalten ein eigenes timestamp-Feld → nicht erneut in trace schreiben
      if (typeof (entry as { timestamp?: unknown }).timestamp === 'string') return;
      const name = typeof (entry as { phase?: unknown }).phase === 'string' ? String((entry as { phase: unknown }).phase) : (typeof (entry as { message?: unknown }).message === 'string' ? String((entry as { message: unknown }).message) : 'log');
      const msg = typeof (entry as { message?: unknown }).message === 'string' ? String((entry as { message: unknown }).message) : undefined;
      const attrs = entry;
      // Versuche, anhand der Phase den korrekten Span zu bestimmen
      const phase = typeof (entry as { phase?: unknown }).phase === 'string' ? String((entry as { phase?: unknown }).phase) : undefined;
      const spanId = mapPhaseToSpanId(phase);
      await this.traceAddEvent(jobId, { spanId, name, message: msg, attributes: attrs });
    } catch {
      // fallback: nichts
    }
  }
}

function mapStepToSpanId(name: string): 'extract' | 'template' | 'ingest' | undefined {
  if (name === 'extract_pdf') return 'extract';
  if (name === 'transform_template') return 'template';
  if (name === 'ingest_rag') return 'ingest';
  return undefined;
}

function mapPhaseToSpanId(phase?: string): 'extract' | 'template' | 'ingest' | undefined {
  if (!phase) return undefined;
  const p = phase.toLowerCase();
  // Extract callbacks
  if (['callback_received', 'progress', 'request_ack', 'secretary_request_start', 'secretary_request_ack', 'secretary_request_accepted', 'postprocessing', 'initializing', 'running'].includes(p)) return 'extract';
  // Template
  if (p.startsWith('template') || p.startsWith('transform_') || ['transform_gate_plan', 'transform_meta', 'transform_meta_completed', 'transform_meta_failed', 'template_request_sent', 'template_request_ack', 'postprocessing_save', 'stored_local', 'stored_path'].includes(p)) return 'template';
  // Ingest
  if (p.startsWith('ingest') || p.startsWith('chapters') || p.startsWith('doc_meta') || p === 'indextidy') return 'ingest';
  return undefined;
}


