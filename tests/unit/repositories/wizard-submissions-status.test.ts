/**
 * Unit-Tests fuer die Mutations-/Status-Pfade von `wizard-submissions-repo.ts`
 * (ADR-0004, W1): updateSubmissionMetadata, changeSubmissionStatus,
 * addSubmissionBinaryRef. Erstellung + Lesepfade in
 * `wizard-submissions-repo.test.ts`.
 *
 * Fehler werden per Message geprueft (nicht per `instanceof`), weil
 * `vi.resetModules()` pro Test einen frischen Modul-Graphen erzeugt.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { buildMockCollection, loadRepo, makeDoc } from './wizard-submissions.fixtures';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('updateSubmissionMetadata', () => {
  it('setzt nur uebergebene Felder + version-Bump; opts returnDocument after', async () => {
    const col = buildMockCollection();
    const existing = makeDoc({ status: 'pending', version: 2 });
    col.findOne = vi.fn().mockResolvedValue(existing);
    col.findOneAndUpdate = vi.fn().mockResolvedValue(makeDoc({ markdownBody: 'neu', version: 3 }));
    const repo = await loadRepo(col);

    const res = await repo.updateSubmissionMetadata(existing._id.toHexString(), {
      markdownBody: 'neu',
      metadata: { a: 1 },
    });

    const [filter, update, opts] = col.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: existing._id });
    expect(update.$set).toMatchObject({ markdownBody: 'neu', metadata: { a: 1 }, version: 3 });
    expect(update.$set).toHaveProperty('updatedAt');
    expect(update.$set).not.toHaveProperty('confidence');
    expect(opts).toEqual({ returnDocument: 'after' });
    expect(res.markdownBody).toBe('neu');
  });

  it('terminaler Status -> NotEditable, kein Schreibzugriff', async () => {
    const col = buildMockCollection();
    col.findOne = vi.fn().mockResolvedValue(makeDoc({ status: 'published' }));
    const repo = await loadRepo(col);
    await expect(
      repo.updateSubmissionMetadata(new ObjectId().toHexString(), { markdownBody: 'x' }),
    ).rejects.toThrow(/nicht editierbar/);
    expect(col.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('unbekannte ID -> NotFound', async () => {
    const repo = await loadRepo(buildMockCollection());
    await expect(repo.updateSubmissionMetadata('bad', {})).rejects.toThrow(/nicht gefunden/);
  });
});

describe('changeSubmissionStatus', () => {
  it('Freigabe pending->ready: persistiert $set (status/version/review) + $push event, actor normalisiert', async () => {
    const col = buildMockCollection();
    const existing = makeDoc({ status: 'pending', version: 1 });
    col.findOne = vi.fn().mockResolvedValue(existing);
    col.findOneAndUpdate = vi.fn().mockResolvedValue(makeDoc({ status: 'ready', version: 2 }));
    const repo = await loadRepo(col);

    const res = await repo.changeSubmissionStatus(existing._id.toHexString(), {
      to: 'ready',
      actor: 'Rev@X.de',
      at: 'T1',
    });

    const [filter, update] = col.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: existing._id });
    expect(update.$set).toMatchObject({ status: 'ready', version: 2, updatedAt: 'T1' });
    expect(update.$set.review).toEqual({ reviewedBy: 'rev@x.de', reviewedAt: 'T1' });
    expect(update.$push.events).toMatchObject({
      type: 'status-changed',
      fromStatus: 'pending',
      toStatus: 'ready',
      actor: 'rev@x.de',
      at: 'T1',
    });
    expect(res.status).toBe('ready');
  });

  it('ungueltiger Uebergang -> wirft, kein Schreibzugriff', async () => {
    const col = buildMockCollection();
    col.findOne = vi.fn().mockResolvedValue(makeDoc({ status: 'published' }));
    const repo = await loadRepo(col);
    await expect(
      repo.changeSubmissionStatus(new ObjectId().toHexString(), { to: 'pending', actor: 'x', at: 'T1' }),
    ).rejects.toThrow(/Ungueltiger Status-Uebergang/);
    expect(col.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('unbekannte ID -> NotFound', async () => {
    const repo = await loadRepo(buildMockCollection());
    await expect(
      repo.changeSubmissionStatus('bad', { to: 'ready', actor: 'x', at: 'T1' }),
    ).rejects.toThrow(/nicht gefunden/);
  });
});

describe('addSubmissionBinaryRef', () => {
  const ref = { hash: 'h1', url: 'u', fileName: 'f.pdf', contentType: 'application/pdf' };

  it('neuer Hash -> $push binaryRefs + version-Bump', async () => {
    const col = buildMockCollection();
    const existing = makeDoc({ status: 'pending', version: 1, binaryRefs: [] });
    col.findOne = vi.fn().mockResolvedValue(existing);
    col.findOneAndUpdate = vi.fn().mockResolvedValue(makeDoc({ binaryRefs: [ref], version: 2 }));
    const repo = await loadRepo(col);

    const res = await repo.addSubmissionBinaryRef(existing._id.toHexString(), ref);

    const [, update] = col.findOneAndUpdate.mock.calls[0];
    expect(update.$push.binaryRefs).toEqual(ref);
    expect(update.$set.version).toBe(2);
    expect(res.binaryRefs).toHaveLength(1);
  });

  it('bereits referenzierter Hash -> idempotenter No-Op (kein Schreibzugriff)', async () => {
    const col = buildMockCollection();
    const existing = makeDoc({ status: 'pending', binaryRefs: [ref] });
    col.findOne = vi.fn().mockResolvedValue(existing);
    const repo = await loadRepo(col);

    const res = await repo.addSubmissionBinaryRef(existing._id.toHexString(), ref);
    expect(col.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.binaryRefs).toEqual([ref]);
  });

  it('terminaler Status -> NotEditable', async () => {
    const col = buildMockCollection();
    col.findOne = vi.fn().mockResolvedValue(makeDoc({ status: 'published' }));
    const repo = await loadRepo(col);
    await expect(repo.addSubmissionBinaryRef(new ObjectId().toHexString(), ref)).rejects.toThrow(
      /nicht editierbar/,
    );
  });
});
