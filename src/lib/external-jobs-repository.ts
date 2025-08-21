import { Collection } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/mongodb-service';
import { ExternalJob, ExternalJobStatus } from '@/types/external-job';

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

  async get(jobId: string): Promise<ExternalJob | null> {
    const col = await this.getCollection();
    return col.findOne({ jobId });
  }
}


