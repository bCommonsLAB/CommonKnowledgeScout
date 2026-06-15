/**
 * @fileoverview Fehler-Klassifikation der Publikation (ADR-0004 §E3, W5).
 *
 * @description
 * Reine Klassifikation eines beim Publizieren aufgetretenen Fehlers in
 * Token/Auth- vs. Netz-/Speicher- vs. Konfigurations-Fehler. Sie steuert, ob die
 * Submission zurueck auf `ready` darf (retry-bar) und ob der Owner zum Re-Auth
 * aufgefordert werden muss. KEIN Hard-Fail: Token- und Speicher-Fehler sind
 * wiederholbar - nie ein halb-geschriebener Zustand (ADR-0004 §E3). Die Klasse
 * leitet sich aus `StorageError.code` ab (`AUTH*` = Token/401/403).
 *
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md (§E3)
 * @module lib/submissions
 */

import { StorageError } from '@/lib/storage/types';

/**
 * Fehlt das Publikationsziel (`target.folderId`), ist die Submission
 * unvollstaendig. Kein Silent Fallback - die Publikation bricht klar ab.
 */
export class PromotionTargetMissingError extends Error {
  readonly submissionId: string;
  constructor(submissionId: string) {
    super(`Submission "${submissionId}" hat kein Publikationsziel (target.folderId).`);
    this.name = 'PromotionTargetMissingError';
    this.submissionId = submissionId;
  }
}

/** Klassen eines Publikations-Fehlers. */
export type PromotionFailureKind = 'auth' | 'storage' | 'config' | 'unknown';

/** Ergebnis der Fehler-Klassifikation (rein, ohne Inhalte). */
export interface PromotionFailure {
  kind: PromotionFailureKind;
  /** Darf erneut versucht werden (Submission bleibt/zurueck auf `ready`)? */
  retryable: boolean;
  /** Muss der Owner den Ziel-Provider neu authentifizieren? */
  needsReauth: boolean;
  /** Menschlich lesbare Ursache (ohne Inhalte). */
  message: string;
  /** `StorageError`-Code, falls vorhanden (Diagnose). */
  code?: string;
}

/**
 * `StorageError`-Codes, die einen Token-/Auth-Fehler markieren - die Provider
 * werfen bei 401/403 `AUTH_ERROR`/`AUTH_REQUIRED` (siehe onedrive-provider.ts).
 */
function isAuthCode(code: string): boolean {
  return code.startsWith('AUTH');
}

/**
 * Klassifiziert einen beim Publizieren aufgetretenen Fehler.
 *
 * - `PromotionTargetMissingError` -> `config` (nicht retry-bar: erst Ziel setzen).
 * - `StorageError` mit `AUTH*`-Code -> `auth` (retry-bar nach Re-Auth).
 * - sonstiger `StorageError` (Netz/API/Rate-Limit/...) -> `storage` (Backoff-Retry).
 * - alles andere -> `unknown` (retry-bar; bleibt `ready`, kein Hard-Fail).
 */
export function classifyPromotionError(error: unknown): PromotionFailure {
  if (error instanceof PromotionTargetMissingError) {
    return { kind: 'config', retryable: false, needsReauth: false, message: error.message };
  }
  if (error instanceof StorageError) {
    const auth = isAuthCode(error.code);
    return {
      kind: auth ? 'auth' : 'storage',
      retryable: true,
      needsReauth: auth,
      message: error.message,
      code: error.code,
    };
  }
  const message = error instanceof Error ? error.message : 'Unbekannter Fehler bei der Publikation';
  return { kind: 'unknown', retryable: true, needsReauth: false, message };
}
