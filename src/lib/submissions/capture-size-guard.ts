/**
 * @fileoverview Groessen-Guard fuer die Multipart-Erfassung (ADR-0004, Crash-Haertung 1b).
 *
 * @description
 * Reine Pruef-Funktionen, die verhindern, dass `POST /api/submissions` bei der
 * Datei-/Ordner-Erfassung den gesamten Upload in den RAM puffert und dabei den
 * (Dev-)Server per OOM toetet (Symptom: ERR_EMPTY_RESPONSE -> ERR_CONNECTION_REFUSED).
 *
 * Zwei Ebenen, beide ohne stillen Fallback:
 * 1. `checkDeclaredTotalSize` — prueft den `Content-Length`-Header VOR dem
 *    Puffern (`request.formData()`); lehnt zu grosse Requests frueh ab.
 * 2. `checkParsedFileSizes` — autoritative Pruefung der tatsaechlichen Datei-
 *    Groessen pro Datei + Summe NACH dem Parsen.
 * Eine Verletzung mappt der Route-Handler auf HTTP 413 (Payload Too Large).
 *
 * Limits sind dokumentierte Defaults, per ENV ueberschreibbar — strikt geparst,
 * d.h. ungueltige ENV-Werte werfen, statt still auf den Default zu fallen.
 *
 * @see src/app/api/submissions/route.ts
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 * @module lib/submissions
 */

/** Obergrenzen fuer die Erfassung (pro Datei + Summe), in Bytes. */
export interface CaptureSizeLimits {
  maxFileBytes: number;
  maxTotalBytes: number;
}

/** Dokumentierter Default pro Datei: 100 MiB. */
export const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024;
/** Dokumentierter Default fuer die Summe aller Dateien: 250 MiB. */
export const DEFAULT_MAX_TOTAL_BYTES = 250 * 1024 * 1024;

const ENV_MAX_FILE = 'SUBMISSION_MAX_FILE_BYTES';
const ENV_MAX_TOTAL = 'SUBMISSION_MAX_TOTAL_BYTES';

/** Parst einen positiven Ganzzahl-ENV-Wert; wirft bei Unsinn (kein stiller Fallback). */
function parsePositiveIntEnv(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`capture-size-guard: ${name} muss eine positive Ganzzahl (Bytes) sein, war: "${raw}"`);
  }
  return value;
}

/** Liest die Limits aus der Umgebung (dokumentierte Defaults, wenn nicht gesetzt). */
export function resolveCaptureSizeLimits(
  env: Record<string, string | undefined> = process.env,
): CaptureSizeLimits {
  return {
    maxFileBytes: parsePositiveIntEnv(env[ENV_MAX_FILE], DEFAULT_MAX_FILE_BYTES, ENV_MAX_FILE),
    maxTotalBytes: parsePositiveIntEnv(env[ENV_MAX_TOTAL], DEFAULT_MAX_TOTAL_BYTES, ENV_MAX_TOTAL),
  };
}

/** Grund + Kontext einer Groessen-Verletzung (fuer die 413-Antwort). */
export interface CaptureSizeViolation {
  reason: 'declared-total-too-large' | 'file-too-large' | 'total-too-large';
  message: string;
  limitBytes: number;
  actualBytes: number;
}

/**
 * Prueft die deklarierte Gesamtgroesse (`Content-Length`) VOR dem Puffern.
 * Fehlt der Header oder ist er unbrauchbar, greift bewusst der autoritative
 * Post-Parse-Guard (`checkParsedFileSizes`) — das ist KEIN stiller Fallback,
 * sondern die zweite, verlaesslichere Pruef-Ebene.
 */
export function checkDeclaredTotalSize(
  contentLength: string | null,
  limits: CaptureSizeLimits,
): CaptureSizeViolation | null {
  if (contentLength === null) return null;
  const total = Number(contentLength);
  if (!Number.isFinite(total) || total < 0) return null;
  if (total > limits.maxTotalBytes) {
    return {
      reason: 'declared-total-too-large',
      message:
        `Die Gesamtgroesse der Erfassung (${total} Bytes) ueberschreitet das Limit ` +
        `von ${limits.maxTotalBytes} Bytes. Bitte weniger oder kleinere Dateien erfassen.`,
      limitBytes: limits.maxTotalBytes,
      actualBytes: total,
    };
  }
  return null;
}

/** Eine Datei mit Anzeigename + Groesse (Bytes) — passt strukturell auf `File`. */
export interface SizedFile {
  name: string;
  size: number;
}

/**
 * Autoritative Pruefung der tatsaechlichen Datei-Groessen: jede Datei gegen
 * `maxFileBytes`, die Summe gegen `maxTotalBytes`. Liefert die erste Verletzung
 * oder `null`.
 */
export function checkParsedFileSizes(
  files: ReadonlyArray<SizedFile>,
  limits: CaptureSizeLimits,
): CaptureSizeViolation | null {
  let total = 0;
  for (const file of files) {
    if (file.size > limits.maxFileBytes) {
      return {
        reason: 'file-too-large',
        message:
          `Datei "${file.name}" (${file.size} Bytes) ueberschreitet das Limit von ` +
          `${limits.maxFileBytes} Bytes pro Datei.`,
        limitBytes: limits.maxFileBytes,
        actualBytes: file.size,
      };
    }
    total += file.size;
  }
  if (total > limits.maxTotalBytes) {
    return {
      reason: 'total-too-large',
      message:
        `Die Gesamtgroesse aller Dateien (${total} Bytes) ueberschreitet das Limit ` +
        `von ${limits.maxTotalBytes} Bytes.`,
      limitBytes: limits.maxTotalBytes,
      actualBytes: total,
    };
  }
  return null;
}
