/**
 * @fileoverview Event runId helper (Client-seitig)
 *
 * @description
 * Erstellt stabile, sortierbare Run-IDs für versionierte Finalisierungs-Ausgaben.
 * Client-seitige Version von event-run-id.ts.
 */

/**
 * Erstellt eine Run-ID im Format: run-YYYYMMDD-HHmmss
 * 
 * @param now Optional: Datum (Standard: aktuelles Datum)
 * @returns Run-ID String (z.B. "run-20260114-143022")
 */
export function toEventRunId(now: Date = new Date()): string {
  // YYYYMMDD-HHmmss
  const iso = now.toISOString().replace(/[:.]/g, '-')
  const dateTimePart = iso.slice(0, 19).replace('T', '-')
  return `run-${dateTimePart}`
}
