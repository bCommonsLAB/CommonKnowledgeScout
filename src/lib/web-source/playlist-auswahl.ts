/**
 * @fileoverview Auswahl und Ordnernamen fuer eine Playlist planen (reine Funktionen, Welle K3).
 *
 * @description
 * Die Vorschau schlaegt je Eintrag einen Ordnernamen vor (`NN Titel` nach
 * Position, mit Datum `JJJJ-MM-TT Titel`); der Mensch bestaetigt Auswahl und
 * Namen VOR dem Anlegen — ein Umbenennen danach setzt Twin-Familien auf
 * `twin_stale`. Beim Anlegen gilt: hoechstens 30 je Aufruf (mehr ist eine
 * Absage mit Hinweis, kein stilles Kuerzen), vorhandene Ordner werden nicht
 * ueberschrieben, sondern je Zeile als Befund gemeldet, nicht abrufbare
 * Eintraege ebenso. Kein Fehler einer Zeile bricht den Stapel ab.
 *
 * @module web-source
 */

import type { PlaylistEintrag } from './playlist-resolve'

/** Stapelgrenze der Bruecke — wie bei quelle_erschliessen und index_aktualisieren. */
export const MAX_PLAYLIST_STAPEL = 30

const MAX_NAME = 80

/** Titel als Ordner-/Dateiname: verbotene Zeichen weg, Leerraum zusammengezogen, gekuerzt. */
export function bereinigeOrdnername(titel: string): string {
  const name = titel
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  if (name.length <= MAX_NAME) return name
  const kurz = name.slice(0, MAX_NAME)
  const schnitt = kurz.lastIndexOf(' ')
  return (schnitt > MAX_NAME / 2 ? kurz.slice(0, schnitt) : kurz).replace(/[. ]+$/g, '')
}

/** `NN Titel` (Position zweistellig, ab 100 dreistellig) oder `JJJJ-MM-TT Titel` mit Datum. */
export function ordnerVorschlag(position: number, titel: string, datum?: string): string {
  const name = bereinigeOrdnername(titel) || `Video ${position}`
  if (datum) return `${datum} ${name}`
  const breite = position >= 100 ? 3 : 2
  return `${String(position).padStart(breite, '0')} ${name}`
}

export interface PlaylistZeilePlan {
  position: number
  id: string
  titel: string
  url: string
  ordner: string
  /** Gesetzt, wenn die Zeile NICHT angelegt wird — mit Grund. */
  befund: string | null
}

export interface PlaylistAnlagePlanInput {
  entries: ReadonlyArray<PlaylistEintrag>
  /** Positionen (Zahl) oder Video-Ids (Text). */
  auswahl: ReadonlyArray<number | string>
  /** Position (als Text) → gewuenschter Ordnername; sonst der Vorschlag. */
  ordnernamen?: Record<string, string>
  /** Namen der Ordner, die es unter der Wurzel schon gibt. */
  vorhandeneNamen: ReadonlyArray<string>
}

/** Plant je Auswahl eine Zeile; wirft nur bei Ueberschreitung der Stapelgrenze. */
export function planePlaylistAnlage(input: PlaylistAnlagePlanInput): PlaylistZeilePlan[] {
  const { entries, ordnernamen = {}, vorhandeneNamen } = input
  if (input.auswahl.length === 0) throw new Error('auswahl ist leer — Positionen oder Video-Ids angeben')
  const auswahl = Array.from(new Set(input.auswahl))
  if (auswahl.length > MAX_PLAYLIST_STAPEL) {
    throw new Error(
      `${auswahl.length} Eintraege gewaehlt, je Aufruf hoechstens ${MAX_PLAYLIST_STAPEL} — in zwei Aufrufen anlegen ` +
        `(z. B. Positionen 1–${MAX_PLAYLIST_STAPEL} und ${MAX_PLAYLIST_STAPEL + 1}–${auswahl.length}). Nichts angelegt.`,
    )
  }
  const vorhanden = new Set(vorhandeneNamen.map((n) => n.toLowerCase()))
  const vergeben = new Set<string>()
  const zeilen: PlaylistZeilePlan[] = []
  for (const wahl of auswahl) {
    const eintrag = typeof wahl === 'number' ? entries.find((e) => e.position === wahl) : entries.find((e) => e.id === wahl)
    if (!eintrag) {
      zeilen.push({ position: typeof wahl === 'number' ? wahl : 0, id: typeof wahl === 'string' ? wahl : '', titel: '', url: '', ordner: '', befund: `${typeof wahl === 'number' ? 'Position' : 'Video-Id'} ${wahl} ist nicht in der Playlist` })
      continue
    }
    const gewuenscht = ordnernamen[String(eintrag.position)]
    const ordner = gewuenscht !== undefined ? bereinigeOrdnername(gewuenscht) : ordnerVorschlag(eintrag.position, eintrag.title)
    const basis = { position: eintrag.position, id: eintrag.id, titel: eintrag.title, url: eintrag.url, ordner }
    if (eintrag.grund) {
      zeilen.push({ ...basis, befund: `nicht abrufbar: ${eintrag.grund}` })
    } else if (!ordner) {
      zeilen.push({ ...basis, befund: `Ordnername fuer Position ${eintrag.position} ist nach der Bereinigung leer` })
    } else if (vorhanden.has(ordner.toLowerCase())) {
      zeilen.push({ ...basis, befund: `Ordner "${ordner}" gibt es unter der Wurzel schon — nicht ueberschrieben` })
    } else if (vergeben.has(ordner.toLowerCase())) {
      zeilen.push({ ...basis, befund: `Ordnername "${ordner}" ist in dieser Auswahl doppelt — ordnernamen fuer Position ${eintrag.position} setzen` })
    } else {
      vergeben.add(ordner.toLowerCase())
      zeilen.push({ ...basis, befund: null })
    }
  }
  return zeilen
}
