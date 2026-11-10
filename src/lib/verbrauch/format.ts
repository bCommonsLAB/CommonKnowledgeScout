/**
 * Darstellung der Verbrauchsseite: Euro, Energie, Monatswechsel, Alltagsvergleich.
 * Reine Funktionen (ohne React), damit sie pruefbar sind.
 */

import { KWH_PRO_100_KM, LED_WATT } from './rechnen'

/** Unter einem Euro drei Nachkommastellen — eine Frage kostet Bruchteile eines Cents. */
export function euro(betrag: number, locale: string): string {
  const stellen = Math.abs(betrag) >= 1 ? 2 : 3
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: stellen, maximumFractionDigits: stellen }).format(betrag)
}

/** „≈ 32 Wh" bzw. „≈ 30 kWh" ab 1.000 Wh. */
export function energie(wh: number, locale: string): string {
  if (wh >= 1000) return `≈ ${new Intl.NumberFormat(locale, { maximumFractionDigits: wh >= 10000 ? 0 : 1 }).format(wh / 1000)} kWh`
  return `≈ ${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(wh)} Wh`
}

export function zahl(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n)
}

/** Vergleich fuer die Energie-Kachel: ab 1 kWh Kilometer im Elektroauto, darunter Stunden einer LED-Lampe. */
export function energieVergleich(wh: number): { art: 'auto'; km: number } | { art: 'lampe'; stunden: number } | null {
  if (wh <= 0) return null
  if (wh >= 1000) return { art: 'auto', km: Math.max(1, Math.round(((wh / 1000) / KWH_PRO_100_KM) * 100)) }
  return { art: 'lampe', stunden: Math.max(1, Math.round(wh / LED_WATT)) }
}

/** Monat `JJJJ-MM` um `schritt` Monate verschieben. */
export function monatVerschieben(monat: string, schritt: number): string {
  const [jahr, mon] = monat.split('-').map(Number)
  const d = new Date(Date.UTC(jahr, mon - 1 + schritt, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** „November 2026" in der Sprache der Oberflaeche. */
export function monatsName(monat: string, locale: string): string {
  const [jahr, mon] = monat.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(jahr, mon - 1, 1)))
}

export function zeitpunkt(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
