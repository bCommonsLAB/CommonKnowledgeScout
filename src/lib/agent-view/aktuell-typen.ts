/**
 * @fileoverview Datenmodell der Aktuell-Sicht (Welle A7/A7b) — nur Typen.
 *
 * @description
 * Aus `aktuell-sicht.ts` herausgeloest (200-Zeilen-Regel), als das Modell um
 * die Postfach-Verdichtung und die Trennung „mit Termin / ohne Termin"
 * gewachsen ist. Die Rechenfunktionen bleiben drueben; wer den Typ braucht,
 * bekommt ihn weiterhin von dort (Re-Export).
 *
 * @module agent-view
 */

import type { PostfachStand, PostfachUebersicht } from './postfach-frische'

/** Ein Vorhaben in der Tages-Uebersicht (Termin-Leiste und Tabelle teilen sich das). */
export interface AktuellVorhaben {
  folderId: string
  /** Bericht-H1, sonst Ordnername — nie leer (der Mensch erkennt das Vorhaben daran). */
  titel: string
  name: string
  path: string
  rolle: string | null
  letzteAktivitaet: string | null
  naechsterTermin: string | null
  /** `termin_fixiert: nein` — der Termin ist noch nicht vereinbart. */
  terminFixiert: boolean
  /** Termin liegt vor heute — der Bericht ist nachzuziehen, nicht die Sicht. */
  ueberfaellig: boolean
  /** Storage-Id des `BERICHT.md` (Deep-Link ins Archiv); null = kein Bericht. */
  berichtFileId: string | null
  /** Die ersten offenen Punkte (wie `AKTUELL.md`). */
  offenePunkte: string[]
  /** Offene Punkte ueber die gezeigten hinaus — die Kappung bleibt sichtbar. */
  weiterePunkte: number
  /** Offene Befunde, die auf den Menschen warten (Bruecke zur Werkbank). */
  wartetAufDich: number
  /**
   * A7b: Stand der E-Mail-Auswertung (`postfach_bis`), gemessen gegen HEUTE.
   * Der Rueckstand waechst ohne jede Aenderung im Archiv — deshalb rechnet
   * ihn die Sicht selbst und wartet nicht auf den naechsten Scan.
   */
  postfach: PostfachStand
}

/** Ein ruhendes oder abgeschlossenes Vorhaben — eine Zeile, kein Detail. */
export interface AktuellRuhend {
  folderId: string
  titel: string
  /** Roher `status`-Wert aus dem Bericht (bleibt sichtbar, kein stilles Mapping). */
  status: string
  letzteAktivitaet: string | null
}

export interface AktuellSicht {
  /** Aktive Vorhaben MIT Termin, nach Termin sortiert. */
  termine: AktuellVorhaben[]
  /** Alle aktiven Vorhaben (Termin zuerst, dann letzte Aktivitaet). */
  aktiv: AktuellVorhaben[]
  /**
   * Aktive Vorhaben mit offenen Punkten UND Termin — das, was diese Woche
   * ansteht. Ohne Termin gibt es keinen Anlass, es heute zu lesen.
   */
  schritteMitTermin: AktuellVorhaben[]
  /**
   * Offene Punkte der Vorhaben OHNE Termin. Sie verschwinden nicht, sie
   * stehen nur nicht im Vordergrund (Live-Befund 06.09.2026: 20 Kacheln
   * beantworten „was habe ich mir vorgenommen", nicht „woran arbeite ich
   * gerade").
   */
  schritteOhneTermin: AktuellVorhaben[]
  ruhend: AktuellRuhend[]
  /** Vorhaben mit Bericht, aber ohne `status:` — die Sicht kann sie nicht einordnen. */
  ohneStatus: Array<{ folderId: string; titel: string; path: string }>
  /** Vorhaben ganz ohne `BERICHT.md` — die Abdeckungsluecke dieser Sicht. */
  ohneBericht: number
  /** Vorhaben mit Bericht (der Nenner der Abdeckungszeile). */
  mitBericht: number
  /** Karten aus einem Scan vor A7 — die Felder fehlen, das wird gesagt. */
  altKarten: number
  /**
   * A7b: Aktive Vorhaben, deren E-Mail-Auswertung ueber der konfigurierten
   * Schwelle liegt ODER deren `postfach_bis` unlesbar ist. Leer, wenn die
   * Library keine Postfach-Auswertung fuehrt (Schwelle null). Dasselbe
   * Praedikat wie der Befund `postfach_veraltet` — kein zweites Urteil.
   */
  postfachRueckstaendig: AktuellVorhaben[]
  /**
   * Verdichtung der Postfach-Staende ueber alle aktiven Vorhaben. Ohne sie
   * stand an 16 von 23 Zeilen wortgleich dasselbe (Live-Befund 06.09.2026) —
   * eine Zeile, die ueberall gleich lautet, traegt keine Information mehr.
   */
  postfachUebersicht: PostfachUebersicht
}

export type { PostfachUebersicht }

/** Zusatzangaben, ohne die die Sicht arbeitsfaehig bleibt. */
export interface AktuellSichtOptionen {
  /** Gegenwart als `Date` (Kalenderwoche). Vorgabe: Tagesbeginn von `heute`. */
  jetzt?: Date
  /**
   * Schwelle aus `report.conventions` — null/fehlt heisst: Die Library
   * fuehrt keine Postfach-Auswertung, es gibt nichts zu mahnen.
   */
  postfachMaxRueckstandWochen?: number | null
}
