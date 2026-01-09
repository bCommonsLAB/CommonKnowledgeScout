/**
 * Formatiert ein ISO-Datum (`upsertedAt`) für die Anzeige in Tabellen.
 *
 * Design-Ziele:
 * - Robust: fehlende oder ungültige Werte ergeben ein klares Fallback.
 * - Testbar: optionale `timeZone` macht Ausgabe deterministisch in Unit-Tests.
 * - Minimal: keine externen Dependencies, reine Funktion.
 */

export interface FormatUpsertedAtOptions {
  /** Locale für Intl-Formatierung, z.B. 'de' oder 'en' */
  locale?: string
  /** Optional: Zeitzone für deterministische Tests, z.B. 'UTC' */
  timeZone?: string
  /** Platzhalter, wenn Wert fehlt/ungültig ist */
  emptyLabel?: string
}

export function formatUpsertedAt(
  upsertedAt: string | undefined,
  options: FormatUpsertedAtOptions = {}
): string {
  const emptyLabel = typeof options.emptyLabel === 'string' ? options.emptyLabel : '-'
  if (!upsertedAt) return emptyLabel

  const parsedDate = new Date(upsertedAt)
  if (Number.isNaN(parsedDate.getTime())) return emptyLabel

  const locale = typeof options.locale === 'string' ? options.locale : 'de'

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: options.timeZone,
    }).format(parsedDate)
  } catch {
    // Fallback: ISO-String ist für Debugging besser als ein leerer Wert.
    return parsedDate.toISOString()
  }
}






