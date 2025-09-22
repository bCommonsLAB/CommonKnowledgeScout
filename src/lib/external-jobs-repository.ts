import { Collection } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
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

  async appendLog(jobId: string, entry: Record<string, unknown>): Promise<void> {
    const col = await this.getCollection();
    await col.updateOne(
      { jobId },
      { $push: { logs: { timestamp: new Date(), ...entry } } }
    );
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
    await col.updateOne(
      { jobId, 'steps.name': name },
      { $set: { ...setObj, updatedAt: now } }
    );
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
    const res = await col.findOneAndUpdate(
      { status: 'queued' },
      { $set: { status: 'running', updatedAt: now } },
      { sort: { updatedAt: 1 }, returnDocument: 'after' }
    );
    return (res && (res as { value?: ExternalJob }).value) || null;
  }

  async listQueued(limit: number = 50): Promise<ExternalJob[]> {
    const col = await this.getCollection();
    return col.find({ status: 'queued' }).sort({ updatedAt: 1 }).limit(Math.max(1, Math.min(500, limit)) ).toArray();
  }
}


