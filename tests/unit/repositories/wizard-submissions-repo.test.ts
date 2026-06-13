/**
 * Unit-Tests fuer `wizard-submissions-repo.ts`: Erstellung + Lesepfade
 * (ADR-0004, W1). Plus den Pure-Builder `buildInitialSubmissionDoc` aus dem
 * Store. Status-/Mutations-Pfade liegen in `wizard-submissions-status.test.ts`.
 *
 * Fehler werden per Message geprueft (nicht per `instanceof`), weil
 * `vi.resetModules()` pro Test einen frischen Modul-Graphen erzeugt.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  VALID_CREATE,
  buildFindResult,
  buildMockCollection,
  loadRepo,
  loadStore,
  makeDoc,
} from './wizard-submissions.fixtures';

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('createSubmission', () => {
  it('legt das Dokument an: version 1, created-Event, normalisierter createdBy, Indizes', async () => {
    const col = buildMockCollection();
    const insertedId = new ObjectId();
    col.insertOne = vi.fn().mockResolvedValue({ insertedId, acknowledged: true });
    const repo = await loadRepo(col);

    const res = await repo.createSubmission(VALID_CREATE);

    expect(col.createIndex).toHaveBeenCalledTimes(2);
    const doc = col.insertOne.mock.calls[0][0];
    expect(doc.status).toBe('pending');
    expect(doc.createdBy).toBe('anna@example.com');
    expect(doc.version).toBe(1);
    expect(doc.metadata).toEqual({});
    expect(doc.binaryRefs).toEqual([]);
    expect(doc.review).toEqual({});
    expect(doc.events).toEqual([
      { type: 'created', toStatus: 'pending', actor: 'anna@example.com', at: doc.createdAt },
    ]);
    expect(res.id).toBe(insertedId.toHexString());
    expect(res).not.toHaveProperty('_id');
  });

  it('wirft bei fehlenden Pflichtfeldern und ueberspringt insertOne', async () => {
    const col = buildMockCollection();
    const repo = await loadRepo(col);
    await expect(repo.createSubmission({ ...VALID_CREATE, libraryId: '' })).rejects.toThrow(/libraryId/);
    await expect(repo.createSubmission({ ...VALID_CREATE, docType: '' })).rejects.toThrow(/docType/);
    expect(col.insertOne).not.toHaveBeenCalled();
  });

  it('wirft bei Nicht-Initial-Status (ADR-0004: Capture darf Maschine nicht ueberspringen)', async () => {
    const col = buildMockCollection();
    const repo = await loadRepo(col);
    await expect(repo.createSubmission({ ...VALID_CREATE, status: 'ready' })).rejects.toThrow(
      /Initial-Status/,
    );
    expect(col.insertOne).not.toHaveBeenCalled();
  });
});

describe('getSubmissionById', () => {
  it('ungueltige ID -> null ohne DB-Treffer', async () => {
    const col = buildMockCollection();
    const repo = await loadRepo(col);
    expect(await repo.getSubmissionById('keine-objectid')).toBeNull();
    expect(col.findOne).not.toHaveBeenCalled();
  });

  it('Treffer -> Public-Form mit String-id, kein _id', async () => {
    const col = buildMockCollection();
    const doc = makeDoc({ status: 'ready' });
    col.findOne = vi.fn().mockResolvedValue(doc);
    const repo = await loadRepo(col);
    const res = await repo.getSubmissionById(doc._id.toHexString());
    expect(res?.id).toBe(doc._id.toHexString());
    expect(res?.status).toBe('ready');
    expect(res).not.toHaveProperty('_id');
  });
});

describe('listSubmissions', () => {
  it('baut Filter (libraryId + status + normalisierter createdBy) und sortiert neueste zuerst', async () => {
    const col = buildMockCollection();
    col.find = vi.fn().mockReturnValue(buildFindResult([makeDoc(), makeDoc()]));
    const repo = await loadRepo(col);
    const res = await repo.listSubmissions('lib-1', { status: 'pending', createdBy: 'Anna@Example.com' });

    expect(res).toHaveLength(2);
    expect(col.find.mock.calls[0][0]).toEqual({
      libraryId: 'lib-1',
      status: 'pending',
      createdBy: 'anna@example.com',
    });
    expect(col.find.mock.results[0].value.sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it('wirft bei fehlender libraryId', async () => {
    const repo = await loadRepo(buildMockCollection());
    await expect(repo.listSubmissions('')).rejects.toThrow(/libraryId/);
  });
});

describe('buildInitialSubmissionDoc (Pure-Builder im Store)', () => {
  it('setzt Defaults, version 1, created-Event und normalisiert createdBy', async () => {
    const store = await loadStore(buildMockCollection());
    const doc = store.buildInitialSubmissionDoc(
      { ...VALID_CREATE, createdBy: 'Bob@Example.com', status: 'draft', createdByRole: 'owner' },
      'T0',
    );
    expect(doc.version).toBe(1);
    expect(doc.status).toBe('draft');
    expect(doc.createdBy).toBe('bob@example.com');
    expect(doc.metadata).toEqual({});
    expect(doc.review).toEqual({});
    expect(doc.events).toEqual([
      { type: 'created', toStatus: 'draft', actor: 'bob@example.com', at: 'T0' },
    ]);
    expect(doc).not.toHaveProperty('writeKey');
  });

  it('uebernimmt writeKey nur, wenn gesetzt', async () => {
    const store = await loadStore(buildMockCollection());
    const doc = store.buildInitialSubmissionDoc({ ...VALID_CREATE, writeKey: 'wk-1' }, 'T0');
    expect(doc.writeKey).toBe('wk-1');
  });
});
