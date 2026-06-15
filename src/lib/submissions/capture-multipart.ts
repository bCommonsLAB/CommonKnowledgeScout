/**
 * @fileoverview Multipart-Erfassung -> CaptureBody (ADR-0004 II, Welle II-A).
 *
 * @description
 * Parser fuer den `multipart/form-data`-Erfassungs-Request (Stufe A: Datei-Upload
 * aus „Inhalte erfassen"). Extrahiert die Binaerquelle (`file`) und die
 * Inhaltsfelder, validiert Letztere ueber den bestehenden `parseCaptureBody`
 * (kein Doppel-Code, identische Fehler-Semantik). Reine Funktion ohne
 * Seiteneffekte — der eigentliche Blob-Upload passiert in der Route ueber den
 * Inbox-Provider.
 *
 * @see src/lib/submissions/submission-capture.ts (parseCaptureBody)
 * @module lib/submissions
 */

import { parseCaptureBody, type CaptureBody } from '@/lib/submissions/submission-capture';

/** Parst ein optionales JSON-Feld aus dem Formular; wirft bei ungueltigem JSON. */
function parseJsonField(value: FormDataEntryValue | null, field: string): unknown {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    // Bewusster, dokumentierter Schluck: nur Re-Throw mit Feldkontext (kein stiller Fallback).
    throw new Error(`submission-input: ${field} ist kein gueltiges JSON`);
  }
}

/** Liest ein String-Feld (oder leeren String, wenn nicht gesetzt). */
function stringField(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === 'string' ? value : '';
}

/**
 * Zerlegt einen Multipart-Erfassungs-Request in den validierten `CaptureBody`
 * (ohne Binaerdaten) und die hochzuladenden `files`. Akzeptiert **mehrere**
 * `file`-Eintraege (Ordner-Erfassung, U5e) — eine einzelne Datei ist der
 * Sonderfall mit Laenge 1. Wirft bei fehlender Datei oder ungueltigen
 * Inhaltsfeldern (kein stiller Fallback) — der Route-Handler mappt das auf HTTP 400.
 */
export function parseMultipartCapture(form: FormData): { body: CaptureBody; files: File[] } {
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    throw new Error('submission-input: Datei (file) fehlt');
  }

  const candidate = {
    libraryId: stringField(form, 'libraryId'),
    wizardId: stringField(form, 'wizardId'),
    docType: stringField(form, 'docType'),
    detailViewType: stringField(form, 'detailViewType'),
    markdownBody: stringField(form, 'markdownBody'),
    metadata: parseJsonField(form.get('metadata'), 'metadata') ?? {},
    confidence: parseJsonField(form.get('confidence'), 'confidence'),
    target: parseJsonField(form.get('target'), 'target'),
  };

  // Validierung + Mapping ueber den bestehenden Parser (gleiche Fehler-Semantik).
  const body = parseCaptureBody(candidate);
  return { body, files };
}
