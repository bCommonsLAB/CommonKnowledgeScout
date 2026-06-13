/**
 * @fileoverview Wizard-Submissions Collection-Infrastruktur (MongoDB).
 *
 * @description
 * Geteilte Basis des Wizard-Submissions-Repos (ADR-0004): Collection-Zugriff mit
 * Caches, Index-Setup, Persistenz-Typ, Public-Mapping, Lookup-Helfer und
 * Domaenen-Fehler. Aus Groessengruenden vom Operations-Modul
 * (`wizard-submissions-repo.ts`) getrennt.
 *
 * @see docs/architecture/mongodb-repository-pattern.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module repositories
 */

import { ObjectId, type Collection, type WithId } from 'mongodb';
import { getCollection } from '@/lib/mongodb-service';
import { normalizeEmail } from '@/lib/auth/user-email';
import type {
  CreateSubmissionInput,
  SubmissionEvent,
  SubmissionStatus,
  WizardSubmission,
} from '@/types/wizard-submission';

const COLLECTION_NAME = 'wizard_submissions';

/** Externer Name der Collection (z.B. fuer $lookup-Stages). */
export const WIZARD_SUBMISSIONS_COLLECTION = COLLECTION_NAME;

/** Status, in denen redaktionelle Korrekturen erlaubt sind (vor Publikation). */
export const EDITABLE_STATUSES: ReadonlySet<SubmissionStatus> = new Set([
  'draft',
  'pending',
  'ready',
]);

/** Persistenz-Form: wie WizardSubmission, aber ohne String-`id` (Mongo `_id`). */
export type WizardSubmissionDoc = Omit<WizardSubmission, 'id'>;

const collectionCache = new Map<string, Collection<WizardSubmissionDoc>>();
const indexCache = new Set<string>();

/** Gecachter Collection-Zugriff (einziger Einstiegspunkt fuer das Repo). */
export async function getSubmissionsCollection(): Promise<Collection<WizardSubmissionDoc>> {
  const cached = collectionCache.get(COLLECTION_NAME);
  if (cached) return cached;
  const col = await getCollection<WizardSubmissionDoc>(COLLECTION_NAME);
  collectionCache.set(COLLECTION_NAME, col);
  return col;
}

/** Legt Indizes lazy + idempotent an (einmal pro Prozess via `indexCache`). */
export async function ensureSubmissionIndexes(): Promise<void> {
  if (indexCache.has(COLLECTION_NAME)) return;
  const col = await getSubmissionsCollection();
  await Promise.all([
    col.createIndex(
      { libraryId: 1, status: 1, updatedAt: -1 },
      { name: 'library_status_updated' },
    ),
    col.createIndex(
      { libraryId: 1, createdBy: 1, createdAt: -1 },
      { name: 'library_creator_created' },
    ),
  ]);
  indexCache.add(COLLECTION_NAME);
}

/** Domaenen-Fehler: Submission nicht gefunden (Routes -> 404). */
export class SubmissionNotFoundError extends Error {
  constructor(id: string) {
    super(`Submission ${id} nicht gefunden`);
    this.name = 'SubmissionNotFoundError';
  }
}

/** Domaenen-Fehler: Submission im aktuellen Status nicht editierbar (Routes -> 409). */
export class SubmissionNotEditableError extends Error {
  constructor(status: SubmissionStatus) {
    super(`Submission im Status "${status}" ist nicht editierbar`);
    this.name = 'SubmissionNotEditableError';
  }
}

/** Mappt die Persistenz-Form in die Public-/Domaenen-Form (String-`id`). */
export function toPublicSubmission(
  doc: WithId<WizardSubmissionDoc>,
): WizardSubmission {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}

/**
 * Baut das initiale Persistenz-Dokument einer neuen Submission (reine Funktion):
 * normalisiert `createdBy`, setzt Default-Leerwerte, `version=1` und den
 * `created`-Audit-Event. Validierung der Pflichtfelder erfolgt im Repo.
 */
export function buildInitialSubmissionDoc(
  input: CreateSubmissionInput,
  now: string,
): WizardSubmissionDoc {
  const createdBy = normalizeEmail(input.createdBy);
  const createdEvent: SubmissionEvent = {
    type: 'created',
    toStatus: input.status,
    actor: createdBy,
    at: now,
  };
  const doc: WizardSubmissionDoc = {
    libraryId: input.libraryId,
    status: input.status,
    createdBy,
    createdByRole: input.createdByRole,
    wizardId: input.wizardId,
    docType: input.docType,
    detailViewType: input.detailViewType,
    metadata: input.metadata ?? {},
    markdownBody: input.markdownBody ?? '',
    binaryRefs: input.binaryRefs ?? [],
    confidence: input.confidence ?? {},
    target: input.target ?? {},
    review: {},
    events: [createdEvent],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  if (input.writeKey !== undefined) doc.writeKey = input.writeKey;
  return doc;
}

/** Laedt ein Dokument oder wirft `SubmissionNotFoundError`. */
export async function requireSubmissionDoc(
  col: Collection<WizardSubmissionDoc>,
  id: string,
): Promise<WithId<WizardSubmissionDoc>> {
  if (!ObjectId.isValid(id)) throw new SubmissionNotFoundError(id);
  const doc = await col.findOne({ _id: new ObjectId(id) });
  if (!doc) throw new SubmissionNotFoundError(id);
  return doc;
}
