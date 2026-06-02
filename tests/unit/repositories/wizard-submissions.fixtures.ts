/**
 * Geteilte Test-Helfer fuer die Wizard-Submissions-Repo-Tests (ADR-0004, W1).
 * Keine `.test.ts`-Endung -> wird von Vitest nicht als Suite ausgefuehrt, nur
 * importiert. Mockt `getCollection`, damit ohne echte MongoDB getestet wird.
 */

import { vi } from 'vitest';
import { ObjectId } from 'mongodb';
import type { CreateSubmissionInput } from '@/types/wizard-submission';

export interface MockCollection {
  createIndex: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
}

export function buildMockCollection(): MockCollection {
  return {
    createIndex: vi.fn().mockResolvedValue(undefined),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId(), acknowledged: true }),
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn(),
    findOneAndUpdate: vi.fn().mockResolvedValue(null),
  };
}

export function buildFindResult(docs: unknown[]) {
  return { sort: vi.fn().mockReturnThis(), toArray: vi.fn().mockResolvedValue(docs) };
}

/** Baut ein Persistenz-Dokument (WithId-Form) fuer findOne/findOneAndUpdate-Mocks. */
export function makeDoc(
  overrides: Record<string, unknown> = {},
): { _id: ObjectId } & Record<string, unknown> {
  return {
    _id: new ObjectId(),
    libraryId: 'lib-1',
    status: 'pending',
    createdBy: 'anna@example.com',
    createdByRole: 'contributor',
    wizardId: 'w1',
    docType: 'testimonial',
    detailViewType: 'testimonial',
    metadata: {},
    markdownBody: '',
    binaryRefs: [],
    confidence: {},
    target: {},
    review: {},
    events: [],
    createdAt: 'T0',
    updatedAt: 'T0',
    version: 1,
    ...overrides,
  };
}

export const VALID_CREATE: CreateSubmissionInput = {
  libraryId: 'lib-1',
  createdBy: 'Anna@Example.com',
  createdByRole: 'contributor',
  wizardId: 'w1',
  docType: 'testimonial',
  detailViewType: 'testimonial',
  status: 'pending',
};

/** Mockt `getCollection` mit `col` und laedt das Repo-Modul frisch. */
export async function loadRepo(col: MockCollection) {
  vi.doMock('@/lib/mongodb-service', () => ({
    getCollection: vi.fn().mockResolvedValue(col),
  }));
  return import('@/lib/repositories/wizard-submissions-repo');
}

/** Mockt `getCollection` mit `col` und laedt das Store-Modul frisch. */
export async function loadStore(col: MockCollection) {
  vi.doMock('@/lib/mongodb-service', () => ({
    getCollection: vi.fn().mockResolvedValue(col),
  }));
  return import('@/lib/repositories/wizard-submissions-store');
}
