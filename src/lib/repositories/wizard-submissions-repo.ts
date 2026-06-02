/**
 * @fileoverview Wizard-Submissions Repository (MongoDB) - Inbox-Modell (ADR-0004).
 *
 * @description
 * CRUD + Status-Uebergaenge fuer die Inbox-Submissions der Capture->Publish-
 * Entkopplung. Globale Collection `wizard_submissions` mit `libraryId`-Feld
 * (Inbox je Library ueber Index gefiltert). Status-Uebergaenge laufen ueber die
 * reine Status-Maschine in `submission-status.ts`; Infrastruktur (Collection,
 * Indizes, Mapping, Fehler) liegt im Store-Modul - das Repo persistiert nur.
 *
 * Invariante (ADR-0004): KEINE Provider-Schreibzugriffe hier - nur MongoDB.
 * Binaerdaten liegen als Referenz (Azure-Blob) im Dokument, nie als Binaer.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module repositories
 */

import { ObjectId, type UpdateFilter } from 'mongodb';
import { normalizeEmail } from '@/lib/auth/user-email';
import { isInitialStatus, transitionSubmission } from '@/lib/submissions/submission-status';
import {
  EDITABLE_STATUSES,
  SubmissionNotEditableError,
  SubmissionNotFoundError,
  buildInitialSubmissionDoc,
  ensureSubmissionIndexes,
  getSubmissionsCollection,
  requireSubmissionDoc,
  toPublicSubmission,
  type WizardSubmissionDoc,
} from '@/lib/repositories/wizard-submissions-store';
import type {
  CreateSubmissionInput,
  SubmissionBinaryRef,
  SubmissionStatus,
  SubmissionTransitionInput,
  UpdateSubmissionMetadataInput,
  WizardSubmission,
} from '@/types/wizard-submission';

export {
  WIZARD_SUBMISSIONS_COLLECTION,
  SubmissionNotFoundError,
  SubmissionNotEditableError,
} from '@/lib/repositories/wizard-submissions-store';

/**
 * Legt eine neue Submission an. Initial-Status muss `draft` oder `pending` sein
 * (Capture darf die Status-Maschine nicht ueberspringen - ADR-0004-Invariante).
 */
export async function createSubmission(
  input: CreateSubmissionInput,
): Promise<WizardSubmission> {
  const required = ['libraryId', 'createdBy', 'wizardId', 'docType', 'detailViewType'] as const;
  for (const key of required) {
    if (!input[key]) throw new Error(`createSubmission: ${key} ist erforderlich`);
  }
  if (!isInitialStatus(input.status)) {
    throw new Error(
      `createSubmission: Initial-Status muss draft oder pending sein, war "${input.status}"`,
    );
  }

  await ensureSubmissionIndexes();
  const col = await getSubmissionsCollection();
  const doc = buildInitialSubmissionDoc(input, new Date().toISOString());
  const res = await col.insertOne(doc);
  return toPublicSubmission({ ...doc, _id: res.insertedId });
}

/** Liefert eine Submission oder `null` (ungueltige/unbekannte ID -> null). */
export async function getSubmissionById(
  id: string,
): Promise<WizardSubmission | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await getSubmissionsCollection();
  const doc = await col.findOne({ _id: new ObjectId(id) });
  return doc ? toPublicSubmission(doc) : null;
}

/** Filter-Optionen fuer die Inbox-Liste. */
export interface ListSubmissionsOptions {
  status?: SubmissionStatus;
  createdBy?: string;
}

/** Inbox-Liste je Library (neueste zuerst), optional nach Status/Erfasser. */
export async function listSubmissions(
  libraryId: string,
  opts: ListSubmissionsOptions = {},
): Promise<WizardSubmission[]> {
  if (!libraryId) throw new Error('listSubmissions: libraryId ist erforderlich');
  const col = await getSubmissionsCollection();
  const filter: Record<string, unknown> = { libraryId };
  if (opts.status) filter.status = opts.status;
  if (opts.createdBy) filter.createdBy = normalizeEmail(opts.createdBy);
  const docs = await col.find(filter).sort({ updatedAt: -1 }).toArray();
  return docs.map(toPublicSubmission);
}

/** Redaktionelle Korrektur (nur im editierbaren Status). Bumpt `version`. */
export async function updateSubmissionMetadata(
  id: string,
  input: UpdateSubmissionMetadataInput,
): Promise<WizardSubmission> {
  const col = await getSubmissionsCollection();
  const existing = await requireSubmissionDoc(col, id);
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new SubmissionNotEditableError(existing.status);
  }
  const set: Partial<WizardSubmissionDoc> = {
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  if (input.metadata !== undefined) set.metadata = input.metadata;
  if (input.markdownBody !== undefined) set.markdownBody = input.markdownBody;
  if (input.confidence !== undefined) set.confidence = input.confidence;
  if (input.target !== undefined) set.target = input.target;

  const updated = await col.findOneAndUpdate(
    { _id: existing._id },
    { $set: set },
    { returnDocument: 'after' },
  );
  if (!updated) throw new SubmissionNotFoundError(id);
  return toPublicSubmission(updated);
}

/**
 * Fuehrt einen Status-Uebergang aus (reine Maschine validiert + wirft
 * `InvalidSubmissionTransitionError`) und persistiert Status, Event, `review`.
 */
export async function changeSubmissionStatus(
  id: string,
  input: SubmissionTransitionInput,
): Promise<WizardSubmission> {
  const col = await getSubmissionsCollection();
  const existing = await requireSubmissionDoc(col, id);
  const next = transitionSubmission(toPublicSubmission(existing), {
    ...input,
    actor: normalizeEmail(input.actor),
  });
  const newEvent = next.events[next.events.length - 1];
  const update: UpdateFilter<WizardSubmissionDoc> = {
    $set: {
      status: next.status,
      updatedAt: next.updatedAt,
      version: next.version,
      review: next.review,
    },
    $push: { events: newEvent },
  };
  const updated = await col.findOneAndUpdate({ _id: existing._id }, update, {
    returnDocument: 'after',
  });
  if (!updated) throw new SubmissionNotFoundError(id);
  return toPublicSubmission(updated);
}

/**
 * Haengt eine Azure-Blob-Inbox-Referenz an (Dedup ueber `hash`). Nur im
 * editierbaren Status. Idempotent: bereits referenzierter Hash -> No-Op.
 */
export async function addSubmissionBinaryRef(
  id: string,
  ref: SubmissionBinaryRef,
): Promise<WizardSubmission> {
  const col = await getSubmissionsCollection();
  const existing = await requireSubmissionDoc(col, id);
  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new SubmissionNotEditableError(existing.status);
  }
  if (existing.binaryRefs.some((r) => r.hash === ref.hash)) {
    return toPublicSubmission(existing);
  }
  const update: UpdateFilter<WizardSubmissionDoc> = {
    $set: { updatedAt: new Date().toISOString(), version: existing.version + 1 },
    $push: { binaryRefs: ref },
  };
  const updated = await col.findOneAndUpdate({ _id: existing._id }, update, {
    returnDocument: 'after',
  });
  if (!updated) throw new SubmissionNotFoundError(id);
  return toPublicSubmission(updated);
}
