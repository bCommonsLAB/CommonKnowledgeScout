/**
 * @fileoverview Azure-Blob-Inbox-Bereich fuer Submission-Binaerquellen (ADR-0004).
 *
 * @description
 * Reine Helfer, die definieren, WO Submission-Binaerdaten im Azure-Blob liegen
 * (content-addressed, library-scoped) und wie eine `SubmissionBinaryRef`
 * aufgebaut wird. Der eigentliche Upload (Buffer -> Blob) gehoert in die
 * Erfassungs-Welle (W2) und nutzt `AzureStorageService`; W1 definiert nur die
 * Adressierung + Referenz-Form.
 *
 * Invariante (ADR-0004): KEINE Binaerdaten in MongoDB - nur diese Referenz.
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @see src/lib/services/azure-storage-service.ts (sanitizeLibraryId)
 * @module lib/submissions
 */

import { sanitizeLibraryId } from '@/lib/services/azure-storage-service';
import type { SubmissionBinaryRef } from '@/types/wizard-submission';

/** Pfad-Segment des Inbox-Bereichs (getrennt von `books`/`sessions`). */
export const INBOX_SCOPE = 'inbox';

/**
 * Normalisiert die Dateiendung (lowercase, ohne fuehrenden Punkt).
 * Ohne erkennbare Endung: leerer String (kein stiller Fehler - es gibt
 * legitime Dateien ohne Endung).
 */
export function extractFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || dot === fileName.length - 1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * Content-addressed Blob-Pfad im Inbox-Bereich:
 *   {sanitizedLibraryId}/inbox/{hash}[.{extension}]
 * Dedup je Library ueber den Hash (analog Bild-Upload).
 */
export function getInboxBlobPath(
  libraryId: string,
  hash: string,
  extension: string,
): string {
  if (!libraryId) throw new Error('getInboxBlobPath: libraryId ist erforderlich');
  if (!hash) throw new Error('getInboxBlobPath: hash ist erforderlich');
  const lib = sanitizeLibraryId(libraryId);
  const ext = extension.replace(/^\.+/, '').toLowerCase();
  const file = ext ? `${hash}.${ext}` : hash;
  return `${lib}/${INBOX_SCOPE}/${file}`;
}

/** Eingabe fuer `buildInboxBinaryRef`. */
export interface InboxBinaryRefInput {
  hash: string;
  url: string;
  fileName: string;
  contentType: string;
  size?: number;
}

/**
 * Baut eine `SubmissionBinaryRef` (reine Funktion). Wirft bei fehlenden
 * Pflichtangaben (kein stiller Fallback).
 */
export function buildInboxBinaryRef(
  input: InboxBinaryRefInput,
): SubmissionBinaryRef {
  const { hash, url, fileName, contentType, size } = input;
  if (!hash) throw new Error('buildInboxBinaryRef: hash ist erforderlich');
  if (!url) throw new Error('buildInboxBinaryRef: url ist erforderlich');
  if (!fileName) throw new Error('buildInboxBinaryRef: fileName ist erforderlich');
  if (!contentType) {
    throw new Error('buildInboxBinaryRef: contentType ist erforderlich');
  }
  const ref: SubmissionBinaryRef = { hash, url, fileName, contentType };
  if (size !== undefined) ref.size = size;
  return ref;
}
