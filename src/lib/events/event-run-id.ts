/**
 * @fileoverview Event runId helper
 *
 * @description
 * Creates stable, sortable run IDs for versioned finalization outputs.
 */

export function toEventRunId(now: Date): string {
  // YYYYMMDD-HHmmss
  const iso = now.toISOString().replace(/[:.]/g, '-')
  return iso.slice(0, 19).replace('T', '-')
}

