/**
 * @fileoverview Postfach-Frische (Welle A7b): wie weit ist die
 * E-Mail-Auswertung eines Vorhabens zurueck? — pur.
 *
 * @description
 * Die Korrespondenz-Methode des Archivs (`Organisation/Aufraeumen/
 * Korrespondenz-Methode.md`) wertet E-Mails NICHT vom Postfach aus, sondern
 * vom Vorhaben: Gegenstellen aus `korrespondenz:`, Zeitfenster aus dem
 * Frontmatter. Wie weit dieses Fenster reicht, sagt der Bericht selbst:
 *
 * ```yaml
 * postfach_ab:  2026-KW29
 * postfach_bis: 2026-KW35
 * ```
 *
 * Bis A7b stand das in genau EINEM Bericht und wurde von niemandem gelesen —
 * ein Rueckstand konnte beliebig wachsen, ohne dass es auffiel. Dieses Modul
 * rechnet ihn aus, damit die Aktuell-Sicht ihn zeigt und der Scan daraus
 * einen Befund machen kann.
 *
 * Jeder Zustand ist BENANNT: kein Feld, unlesbarer Wert, gelesener Wert
 * (`no-silent-fallbacks.mdc`). Ein unlesbares `postfach_bis` still wie ein
 * fehlendes zu behandeln waere genau der Fehler, den der Contract verbietet.
 *
 * Reine Funktionen, kein I/O — die Gegenwart wird hereingereicht.
 *
 * @module agent-view
 */

/** `JJJJ-KWnn` — das Format der Konvention (`2026-KW35`). */
const KW_MUSTER = /^(\d{4})-KW(\d{1,2})$/

const MS_PRO_TAG = 86_400_000

/** Zustand der Postfach-Auswertung eines Vorhabens — nie stilles null. */
export type PostfachStand =
  /** Der Bericht sagt nichts ueber sein Postfach-Fenster. */
  | { art: 'ohne_angabe' }
  /** Feld vorhanden, aber nicht `JJJJ-KWnn` — sichtbar, nicht verschluckt. */
  | { art: 'unlesbar'; roh: string }
  /**
   * Gelesen. `rueckstandWochen` zaehlt volle Wochen zwischen der gemeldeten
   * Woche und der laufenden: 0 = diese Woche, 1 = eine Woche offen. Negativ
   * heisst, der Bericht meldet eine Woche in der Zukunft (Datenfehler).
   */
  | { art: 'gelesen'; jahr: number; woche: number; rueckstandWochen: number }

/** ISO-8601-Kalenderwoche eines Datums (Woche mit dem ersten Donnerstag). */
export function isoKalenderwoche(datum: Date): { jahr: number; woche: number } {
  const tagUtc = Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate())
  const donnerstag = new Date(tagUtc)
  // Mo=1 … So=7; auf den Donnerstag derselben Woche schieben — er entscheidet
  // ueber Wochennummer UND Wochenjahr (Jahreswechsel-Faelle).
  const wochentag = donnerstag.getUTCDay() === 0 ? 7 : donnerstag.getUTCDay()
  donnerstag.setUTCDate(donnerstag.getUTCDate() + 4 - wochentag)
  const jahresanfang = Date.UTC(donnerstag.getUTCFullYear(), 0, 1)
  const woche = Math.ceil(((donnerstag.getTime() - jahresanfang) / MS_PRO_TAG + 1) / 7)
  return { jahr: donnerstag.getUTCFullYear(), woche }
}

/**
 * Montag einer ISO-Woche als UTC-Zeitstempel. Anker ist der 4. Januar — er
 * liegt per ISO-Definition immer in Woche 1, in jedem Jahr.
 */
function montagDerWoche(jahr: number, woche: number): number {
  const vierter = new Date(Date.UTC(jahr, 0, 4))
  const wochentag = vierter.getUTCDay() === 0 ? 7 : vierter.getUTCDay()
  const montagWoche1 = vierter.getTime() - (wochentag - 1) * MS_PRO_TAG
  return montagWoche1 + (woche - 1) * 7 * MS_PRO_TAG
}

/**
 * Liest `postfach_bis` und misst den Rueckstand gegen `jetzt`.
 *
 * @param roh Frontmatter-Wert; null/leer ⇒ `ohne_angabe`.
 * @param jetzt Gegenwart — vom Aufrufer, damit die Funktion rein bleibt.
 */
export function lesePostfachStand(roh: string | null | undefined, jetzt: Date): PostfachStand {
  if (roh === null || roh === undefined || roh.trim() === '') return { art: 'ohne_angabe' }
  const wert = roh.trim()
  const treffer = KW_MUSTER.exec(wert)
  if (treffer === null) return { art: 'unlesbar', roh: wert }
  const jahr = Number(treffer[1])
  const woche = Number(treffer[2])
  // ISO kennt Woche 1 bis 52 oder 53 — alles andere ist ein Tippfehler und
  // wird als solcher gezeigt, nicht auf einen Nachbarwert gebogen.
  if (woche < 1 || woche > 53) return { art: 'unlesbar', roh: wert }
  const heute = isoKalenderwoche(jetzt)
  const rueckstandWochen = Math.round(
    (montagDerWoche(heute.jahr, heute.woche) - montagDerWoche(jahr, woche)) / (7 * MS_PRO_TAG),
  )
  return { art: 'gelesen', jahr, woche, rueckstandWochen }
}

/** Anzeigeform der gemeldeten Woche (`2026-KW35` → „KW 35/2026"). */
export function kalenderwocheLabel(jahr: number, woche: number): string {
  return `KW ${String(woche)}/${String(jahr)}`
}

/**
 * Ein Satz zum Stand — EINE Formulierung fuer Sicht und Befund, damit
 * Werkbank und Auftragstext nicht unterschiedlich reden.
 */
export function postfachStandLabel(stand: PostfachStand): string {
  if (stand.art === 'ohne_angabe') return 'Postfach-Fenster nicht angegeben'
  if (stand.art === 'unlesbar') return `Postfach-Fenster unlesbar („${stand.roh}", erwartet JJJJ-KWnn)`
  const woche = kalenderwocheLabel(stand.jahr, stand.woche)
  if (stand.rueckstandWochen < 0) return `Postfach bis ${woche} — liegt in der Zukunft`
  if (stand.rueckstandWochen === 0) return `Postfach bis ${woche} — aktuell`
  if (stand.rueckstandWochen === 1) return `Postfach bis ${woche} — 1 Woche offen`
  return `Postfach bis ${woche} — ${String(stand.rueckstandWochen)} Wochen offen`
}

/**
 * Ist der Rueckstand ueber der Schwelle? `null` als Schwelle heisst: Die
 * Library fuehrt keine Postfach-Auswertung — dann gibt es auch keinen
 * Rueckstand zu melden (Regel inaktiv, wie `indexRequiredMaxDepth`).
 */
export function istPostfachImRueckstand(
  stand: PostfachStand,
  maxRueckstandWochen: number | null,
): boolean {
  if (maxRueckstandWochen === null) return false
  if (stand.art !== 'gelesen') return false
  return stand.rueckstandWochen > maxRueckstandWochen
}
