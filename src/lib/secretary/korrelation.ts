/**
 * @fileoverview Korrelations-Header fuer Aufrufe an den Secretary (10.11.2026).
 *
 * Der Secretary speichert diese Kennungen am Eintrag in `request_metrics`
 * (`correlation.query_id`, `.library_id`, `.chat_id`). Damit lassen sich eine
 * Frage im Query-Log und ihre Kosten im Secretary verbinden. Dasselbe Muster
 * wie die Header der Bildanalyse (`X-Job-Id`, `X-Worker-Id`, …).
 *
 * Nur Kennungen, nie Inhalt: Der Secretary nimmt 1–128 Zeichen aus
 * `A-Za-z0-9._:-` an und verwirft alles andere. Was hier nicht passt, wird
 * nicht gesendet und mit dem Header-NAMEN gemeldet (ohne Wert).
 */

export interface SecretaryKorrelation {
  queryId?: string | null
  libraryId?: string | null
  chatId?: string | null
}

const KENNUNG = /^[A-Za-z0-9._:-]{1,128}$/

const HEADER: ReadonlyArray<[keyof SecretaryKorrelation, string]> = [
  ['queryId', 'X-Query-Id'],
  ['libraryId', 'X-Library-Id'],
  ['chatId', 'X-Chat-Id'],
]

export function korrelationsHeader(k: SecretaryKorrelation | undefined): Record<string, string> {
  const headers: Record<string, string> = {}
  if (!k) return headers
  for (const [feld, name] of HEADER) {
    const wert = k[feld]
    if (wert === undefined || wert === null || wert === '') continue
    if (!KENNUNG.test(wert)) {
      console.warn(`[secretary/korrelation] ${name} nicht gesendet: Wert ist keine gültige Kennung`)
      continue
    }
    headers[name] = wert
  }
  return headers
}
