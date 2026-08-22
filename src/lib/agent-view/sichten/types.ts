/**
 * @fileoverview Datenmodell + Helfer der erzeugten Sichten (Wunschliste 2, W1).
 *
 * @description
 * Abloesung von `Organisation/Tools/aktuell.py` und `projekte.py`: Die
 * Sichten `AKTUELL.md` („woran arbeite ich gerade") und `PROJEKTE.md`
 * („woran habe ich je gearbeitet") entstehen aus den `BERICHT.md`-Dateien
 * des Archivs. Die Python-Skripte sind das Briefing — Felder, Sortierung und
 * Wortlaut werden 1:1 uebernommen, damit die Dateien fuer Obsidian und die
 * Cowork-Session unveraendert lesbar bleiben.
 *
 * @module agent-view/sichten
 */

/** Ein Vorhaben, gelesen aus seinem `BERICHT.md` (Frontmatter + Body). */
export interface ProjektDatensatz {
  /** Library-relativer Ordnerpfad des Vorhabens. */
  ordner: string
  /** H1 des Berichts; leer, wenn keine vorhanden. */
  titel: string
  projekt: string
  status: string | null
  rolle: string | null
  bereich: string | null
  begonnen: string | null
  letzteAktivitaet: string | null
  naechsterTermin: string | null
  /** `termin_fixiert: nein` → false; fehlt = ja (wie aktuell.py). */
  terminFixiert: boolean
  plattform: string | null
  repo: string[]
  themen: string[]
  /** `quelle: erschlossen` markiert maschinell erzeugte, unbestaetigte Berichte. */
  quelle: string | null
  /** Erster Absatz nach der H1 — die Kurzbeschreibung. */
  beschreibung: string
  /** ALLE offenen Checkboxen aus „## Naechste Schritte" (AKTUELL nimmt die ersten zwei). */
  schritte: string[]
}

const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** `2026-08-22` → „22. August 2026", `2026-08` → „August 2026", sonst unveraendert. */
export function datumLesbar(iso: string | null): string {
  if (iso === null) return ''
  const match = iso.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!match) return iso
  const monat = MONATE[Number(match[2]) - 1] ?? match[2]
  return match[3] ? `${Number(match[3])}. ${monat} ${match[1]}` : `${monat} ${match[1]}`
}

/** Markdown-Auszeichnung entfernen und Whitespace glaetten (wie `sauber()` im Skript). */
export function sauber(text: string): string {
  return text.replace(/\*\*|`|\*/g, '').replace(/\s+/g, ' ').trim()
}

/** Deutsches Datum fuer Kopfzeilen (`22.08.2026`). */
export function datumKurz(date: Date): string {
  const tag = String(date.getDate()).padStart(2, '0')
  const monat = String(date.getMonth() + 1).padStart(2, '0')
  return `${tag}.${monat}.${date.getFullYear()}`
}

/** Obsidian-Wikilink auf den Bericht eines Vorhabens. */
export function berichtLink(projekt: ProjektDatensatz, label: string): string {
  return `[[${projekt.ordner}/BERICHT|${label}]]`
}
