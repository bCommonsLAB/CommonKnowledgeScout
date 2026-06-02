/**
 * @fileoverview Capture -> Submission: reine Parser-/Mapper-Logik (ADR-0004, W2).
 *
 * @description
 * Wandelt den rohen Capture-Request (Wizard-/Analyse-Ergebnis) in einen
 * validierten `CreateSubmissionInput` um. Reine Funktionen ohne Seiteneffekte,
 * damit die `POST /api/submissions`-Route duenn und gut testbar bleibt.
 *
 * Capture erzeugt IMMER Status `pending` (ADR-0004): die Erfassung schreibt nie
 * ins Ziel; die spaetere Freigabe/Publikation ist ein eigener Schritt (W5).
 * `binaryRefs` werden ueber den W1-Helfer `buildInboxBinaryRef` validiert -
 * keine Binaerdaten, nur Azure-Blob-Referenzen.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module lib/submissions
 */

import { buildInboxBinaryRef } from '@/lib/submissions/inbox-blob';
import type { LibraryRole } from '@/types/library-members';
import type {
  CreateSubmissionInput,
  SubmissionBinaryRef,
  SubmissionCreatorRole,
  SubmissionTarget,
} from '@/types/wizard-submission';

/**
 * Leitet die Erfasser-Rolle aus Library-Besitz + aktiver Mitglieds-Rolle ab.
 * Erfassen duerfen nur Owner, Co-Creator und Contributor (ADR-0004); Moderator,
 * Reader oder Nicht-Mitglieder erhalten `null` (kein Recht). Explizit, kein
 * stiller Fallback - neue Rollen muessen hier bewusst eingeordnet werden.
 */
export function resolveCreatorRole(
  isOwner: boolean,
  memberRole: LibraryRole | null,
): SubmissionCreatorRole | null {
  if (isOwner) return 'owner';
  if (memberRole === 'co-creator') return 'co-creator';
  if (memberRole === 'contributor') return 'contributor';
  return null;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`parseCaptureBody: ${field} muss ein nicht-leerer String sein`);
  }
  return value;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`parseCaptureBody: ${field} muss ein Objekt sein`);
  }
  return value as Record<string, unknown>;
}

function asConfidence(value: unknown): Record<string, number> {
  const rec = asRecord(value, 'confidence');
  for (const [key, val] of Object.entries(rec)) {
    if (typeof val !== 'number' || Number.isNaN(val) || val < 0 || val > 1) {
      throw new Error(`parseCaptureBody: confidence["${key}"] muss eine Zahl 0..1 sein`);
    }
  }
  return rec as Record<string, number>;
}

function asBinaryRefs(value: unknown): SubmissionBinaryRef[] {
  if (!Array.isArray(value)) {
    throw new Error('parseCaptureBody: binaryRefs muss ein Array sein');
  }
  return value.map((raw) => {
    const r = asRecord(raw, 'binaryRefs[]');
    return buildInboxBinaryRef({
      hash: asNonEmptyString(r.hash, 'binaryRefs[].hash'),
      url: asNonEmptyString(r.url, 'binaryRefs[].url'),
      fileName: asNonEmptyString(r.fileName, 'binaryRefs[].fileName'),
      contentType: asNonEmptyString(r.contentType, 'binaryRefs[].contentType'),
      size: typeof r.size === 'number' ? r.size : undefined,
    });
  });
}

function asTarget(value: unknown): SubmissionTarget {
  const r = asRecord(value, 'target');
  const target: SubmissionTarget = {};
  if (r.folderId !== undefined) target.folderId = asNonEmptyString(r.folderId, 'target.folderId');
  if (r.slug !== undefined) target.slug = asNonEmptyString(r.slug, 'target.slug');
  return target;
}

/** Validierter Capture-Request (Inhalt; Identitaet kommt aus dem Auth-Kontext). */
export interface CaptureBody {
  libraryId: string;
  wizardId: string;
  docType: string;
  detailViewType: string;
  markdownBody: string;
  metadata: Record<string, unknown>;
  confidence?: Record<string, number>;
  binaryRefs?: SubmissionBinaryRef[];
  target?: SubmissionTarget;
}

/**
 * Parst + validiert den Request-Body. Wirft bei ungueltiger Eingabe (kein
 * stiller Fallback) - der Route-Handler mappt das auf HTTP 400.
 */
export function parseCaptureBody(body: unknown): CaptureBody {
  const b = asRecord(body, 'body');
  if (typeof b.markdownBody !== 'string') {
    throw new Error('parseCaptureBody: markdownBody muss ein String sein');
  }
  const result: CaptureBody = {
    libraryId: asNonEmptyString(b.libraryId, 'libraryId'),
    wizardId: asNonEmptyString(b.wizardId, 'wizardId'),
    docType: asNonEmptyString(b.docType, 'docType'),
    detailViewType: asNonEmptyString(b.detailViewType, 'detailViewType'),
    markdownBody: b.markdownBody,
    metadata: asRecord(b.metadata, 'metadata'),
  };
  if (b.confidence !== undefined) result.confidence = asConfidence(b.confidence);
  if (b.binaryRefs !== undefined) result.binaryRefs = asBinaryRefs(b.binaryRefs);
  if (b.target !== undefined) result.target = asTarget(b.target);
  return result;
}

/** Identitaet des Erfassers (aus Auth + Membership abgeleitet, nicht aus dem Body). */
export interface CaptureContext {
  createdBy: string;
  createdByRole: SubmissionCreatorRole;
  writeKey?: string;
}

/**
 * Baut den `CreateSubmissionInput` (reine Funktion). Status ist immer `pending`
 * (Capture-Invariante ADR-0004).
 */
export function buildCaptureSubmissionInput(
  body: CaptureBody,
  ctx: CaptureContext,
): CreateSubmissionInput {
  const input: CreateSubmissionInput = {
    libraryId: body.libraryId,
    createdBy: ctx.createdBy,
    createdByRole: ctx.createdByRole,
    wizardId: body.wizardId,
    docType: body.docType,
    detailViewType: body.detailViewType,
    status: 'pending',
    markdownBody: body.markdownBody,
    metadata: body.metadata,
  };
  if (body.confidence !== undefined) input.confidence = body.confidence;
  if (body.binaryRefs !== undefined) input.binaryRefs = body.binaryRefs;
  if (body.target !== undefined) input.target = body.target;
  if (ctx.writeKey !== undefined) input.writeKey = ctx.writeKey;
  return input;
}
