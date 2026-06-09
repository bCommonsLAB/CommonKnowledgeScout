/**
 * @fileoverview Inbox-Binaer-Helfer: Endung + SubmissionBinaryRef (ADR-0004).
 *
 * @description
 * Reine Helfer rund um Submission-Binaerquellen: Datei-Endung normalisieren und
 * eine `SubmissionBinaryRef` aufbauen. Die Adressierung (WO ein Blob liegt) ist
 * seit Welle II-A KEIN separater Helfer mehr — sie gehoert ausschliesslich dem
 * `InboxBlobProvider` (`src/lib/storage/inbox/`), damit Capture- und
 * Provider-Pfad konvergieren (single source of truth fuer Pfade). Der Upload
 * laeuft ueber `uploadInboxBinary` (`inbox-upload.ts`).
 *
 * Invariante (ADR-0004): KEINE Binaerdaten in MongoDB - nur diese Referenz.
 *
 * @see src/lib/submissions/inbox-upload.ts
 * @see src/lib/storage/inbox/inbox-path.ts
 * @module lib/submissions
 */

import type { SubmissionBinaryRef } from '@/types/wizard-submission';

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
