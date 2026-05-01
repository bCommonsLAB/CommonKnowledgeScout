/**
 * job-report-tab/helpers.ts
 *
 * Pure-Helper-Funktionen + Types fuer JobReportTab.
 *
 * Aus `job-report-tab.tsx` ausgegliedert (Welle 3-II-c, Schritt 2/5).
 */

/**
 * Robuste Konvertierung eines Frontmatter-Werts in ein String-Array.
 * Behandelt: echte Arrays, JSON-Strings (z.B. '["a","b"]'), und undefined.
 * Notwendig, weil parseSecretaryMarkdownStrict Array-Felder unter Umstaenden
 * als String belaesst (z.B. wenn extractBalancedJsonAfterKey fehlschlaegt).
 */
export function safeParseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter((s): s is string => typeof s === 'string')
  }
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === 'string')
      }
    } catch {
      // Wert ist kein gueltiges JSON — Original-Verhalten:
      // bewusster Fallback auf undefined (siehe no-silent-fallbacks.mdc:
      // dokumentierter Fallback in Test-Char-Vertrag fixiert).
    }
  }
  return undefined
}

/**
 * Job-Status-DTO, wie es von der External-Jobs-API geliefert wird.
 *
 * Hinweis: Dieses Interface ist die UI-seitige Sicht, nicht die
 * kanonische DB-Form. Felder wie `result.savedItemId` sind optional,
 * weil sie erst nach erfolgreichem Job-Lauf gesetzt werden.
 */
export interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{
    name: string
    status: string
    startedAt?: string
    endedAt?: string
    error?: { message: string }
    details?: { skipped?: boolean }
  }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{
    timestamp: string
    phase?: string
    message?: string
    progress?: number
    details?: Record<string, unknown>
  }>
  cumulativeMeta?: Record<string, unknown>
}
