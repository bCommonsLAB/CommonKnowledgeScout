/**
 * Anzeige-Formate der Seite „Sprachmodelle" (reine Funktionen).
 */

const ZAHL = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 })

/** "0,15 / 0,6 $" je 1 Mio. Token; ohne festen Preis ein Gedankenstrich. */
export function formatPreis(ein: number | null, aus: number | null): string {
  if (ein === null || aus === null) return "–"
  return `${ZAHL.format(ein)} / ${ZAHL.format(aus)} $`
}

/** Kontextfenster kurz: 1048576 → "1 Mio.", 163840 → "164 Tsd.". */
export function formatKontext(token: number | null): string {
  if (token === null) return "–"
  if (token >= 1_000_000) return `${ZAHL.format(Math.round(token / 100_000) / 10)} Mio.`
  return `${Math.round(token / 1000)} Tsd.`
}

/** "20.11., 14:05" aus einem ISO-Zeitpunkt. */
export function formatZeitpunkt(iso: string): string {
  const datum = new Date(iso)
  if (Number.isNaN(datum.getTime())) return iso
  return datum.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}
