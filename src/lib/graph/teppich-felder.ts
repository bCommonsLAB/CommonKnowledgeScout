/**
 * @fileoverview Felder des Teppichs am Meta-Dokument (Plan `teppich-der-dokumente`, T1).
 *
 * @description
 * Reine Leser ohne Datenbank: was die Lage-Regel aus einem Meta-Dokument braucht
 * (`leseTeppichEingabe`) und was die Lese-Route je Dokument ausgibt
 * (`leseTeppichPunkt`). Beide lesen die Felder an genau einer Stelle, damit
 * Auftrag und Route dieselbe Regel haben.
 *
 * Felder (flach in `docMetaJson`, wie `similarity_neighbors`):
 * `teppich_x`, `teppich_y`, `teppich_gewicht` (fehlt ohne Umfang), `teppich_stand`.
 *
 * @usedIn src/lib/graph/teppich-persist.ts, src/lib/graph/teppich-antwort.ts
 */

import type { TeppichEingabe } from './teppich-lage'

/** Projektion fuer beide Leser (Mongo `find`). */
export const TEPPICH_PROJEKTION = {
  _id: 0, fileId: 1, fileName: 1, title: 1, shortTitle: 1, date: 1, year: 1, chunkCount: 1,
  detailViewType: 1,
  'docMetaJson.date': 1, 'docMetaJson.year': 1, 'docMetaJson.title': 1, 'docMetaJson.detailViewType': 1,
  'docMetaJson.similarity_neighbors': 1,
  'docMetaJson.teppich_x': 1, 'docMetaJson.teppich_y': 1, 'docMetaJson.teppich_gewicht': 1,
  'docMetaJson.teppich_stand': 1,
} as const

/** Strukturelle Seiten der Website sind kein Inhalt und liegen nicht auf dem Teppich. */
export const TEPPICH_OHNE_TYP = 'website'

export interface TeppichMetaZeile {
  fileId?: unknown
  fileName?: unknown
  title?: unknown
  shortTitle?: unknown
  date?: unknown
  year?: unknown
  chunkCount?: unknown
  detailViewType?: unknown
  docMetaJson?: Record<string, unknown>
}

export interface TeppichPunkt {
  fileId: string
  x: number
  y: number
  gewicht: number | null
  jahr: number | null
  titel: string
}

const TITEL_MAX = 80

const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null)

function jahrAus(v: unknown): number | null {
  const n = typeof v === 'string' && /^\d{4}$/.test(v.trim()) ? Number(v.trim()) : zahl(v)
  return n !== null && Number.isInteger(n) && n >= 1000 && n <= 2999 ? n : null
}

/** Zeitpunkt: zuerst das Datum, sonst die Mitte des Jahres, sonst `null`. */
export function zeitAus(zeile: TeppichMetaZeile): number | null {
  const meta = zeile.docMetaJson ?? {}
  for (const roh of [zeile.date, meta.date]) {
    const t = text(roh)
    if (!t) continue
    const ms = Date.parse(t)
    if (Number.isFinite(ms)) return ms
  }
  const jahr = jahrAus(zeile.year) ?? jahrAus(meta.year)
  return jahr === null ? null : Date.UTC(jahr, 6, 1)
}

/** Jahr fuer die Anzeige: das Jahr selbst, sonst aus dem Datum. */
export function jahrFuerAnzeige(zeile: TeppichMetaZeile): number | null {
  const meta = zeile.docMetaJson ?? {}
  const jahr = jahrAus(zeile.year) ?? jahrAus(meta.year)
  if (jahr !== null) return jahr
  const ms = zeitAus(zeile)
  return ms === null ? null : new Date(ms).getUTCFullYear()
}

export function istTeppichInhalt(zeile: TeppichMetaZeile): boolean {
  const meta = zeile.docMetaJson ?? {}
  return zeile.detailViewType !== TEPPICH_OHNE_TYP && meta.detailViewType !== TEPPICH_OHNE_TYP
}

function nachbarnAus(roh: unknown): Array<{ fileId: string; weight: number }> {
  if (!Array.isArray(roh)) return []
  const out: Array<{ fileId: string; weight: number }> = []
  for (const n of roh) {
    if (!n || typeof n !== 'object') continue
    const fid = text((n as Record<string, unknown>).fileId)
    const w = zahl((n as Record<string, unknown>).weight)
    if (fid && w !== null) out.push({ fileId: fid, weight: w })
  }
  return out
}

/** Eingabe der Lage-Regel; `null` ohne Kennung (dann zaehlt der Aufrufer die Zeile). */
export function leseTeppichEingabe(zeile: TeppichMetaZeile): TeppichEingabe | null {
  const fileId = text(zeile.fileId)
  if (!fileId) return null
  const meta = zeile.docMetaJson ?? {}
  const x = zahl(meta.teppich_x)
  const y = zahl(meta.teppich_y)
  const umfang = zahl(zeile.chunkCount)
  return {
    fileId,
    zeit: zeitAus(zeile),
    nachbarn: nachbarnAus(meta.similarity_neighbors),
    umfang: umfang !== null && umfang >= 0 ? umfang : null,
    vorher: x !== null && y !== null ? { x, y } : null,
  }
}

/** Punkt fuer die Lese-Route; `null`, wenn das Dokument noch keine Lage hat. */
export function leseTeppichPunkt(zeile: TeppichMetaZeile): TeppichPunkt | null {
  const fileId = text(zeile.fileId)
  const meta = zeile.docMetaJson ?? {}
  const x = zahl(meta.teppich_x)
  const y = zahl(meta.teppich_y)
  if (!fileId || x === null || y === null) return null
  const titel = text(zeile.shortTitle) ?? text(zeile.title) ?? text(meta.title) ?? text(zeile.fileName) ?? fileId
  return {
    fileId,
    x,
    y,
    gewicht: zahl(meta.teppich_gewicht),
    jahr: jahrFuerAnzeige(zeile),
    titel: titel.length > TITEL_MAX ? `${titel.slice(0, TITEL_MAX - 1)}…` : titel,
  }
}
