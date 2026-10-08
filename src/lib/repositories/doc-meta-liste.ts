/**
 * @fileoverview Meta-Dokumente als flache Feldzeilen lesen (Welle A, Bruecke).
 *
 * @description
 * Die Galerie liest Karten (`findDocs`, DocCardMeta mit Lookups fuer Sterne
 * und Kommentare). Die Bruecke braucht Felder, keine Karten: Kennung, Name,
 * Typ, das komplette `docMetaJson` fuer die Facettenwerte und den
 * Veroeffentlichungs-Stand. Derselbe Filter wie in der Galerie-Route, eigene
 * schmale Projektion — `vector-repo.ts` ist mit 2.000 Zeilen voll.
 *
 * @module repositories
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from './vector-repo'

export interface MetaFeldZeile {
  fileId: string
  fileName: string
  title: string | null
  shortTitle: string | null
  detailViewType: string | null
  upsertedAt: string | null
  /** `publication.status` des Eintrags, z. B. `draft`; null = ohne Feld. */
  publikation: string | null
  docMetaJson: Record<string, unknown>
}

/** Harte Obergrenze je Abruf — groessere Bestaende liest der Aufrufer seitenweise. */
export const META_LISTE_MAX = 200

function alsObjekt(wert: unknown): Record<string, unknown> {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert) ? (wert as Record<string, unknown>) : {}
}

function alsText(wert: unknown): string | null {
  return typeof wert === 'string' && wert.trim() !== '' ? wert : null
}

function zeile(roh: Document): MetaFeldZeile {
  const fileId = roh['fileId']
  if (typeof fileId !== 'string' || fileId === '') throw new Error('Meta-Dokument ohne fileId')
  const docMetaJson = alsObjekt(roh['docMetaJson'])
  const publication = alsObjekt(roh['publication'])
  return {
    fileId,
    fileName: typeof roh['fileName'] === 'string' ? roh['fileName'] : '',
    title: alsText(roh['title']) ?? alsText(docMetaJson['title']),
    shortTitle: alsText(roh['shortTitle']) ?? alsText(docMetaJson['shortTitle']),
    detailViewType: alsText(roh['detailViewType']) ?? alsText(docMetaJson['detailViewType']),
    upsertedAt: alsText(roh['upsertedAt']),
    publikation: alsText(publication['status']),
    docMetaJson,
  }
}

/**
 * Eine Seite Meta-Dokumente als Feldzeilen plus Gesamtzahl. `filter` ist der
 * fertige Mongo-Filter der Galerie (Facetten, Typ, Suche).
 */
export async function findeMetaFelder(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  options: { skip: number; limit: number; sort: Record<string, 1 | -1> },
): Promise<{ zeilen: MetaFeldZeile[]; total: number }> {
  if (options.limit < 1 || options.limit > META_LISTE_MAX) {
    throw new Error(`limit muss zwischen 1 und ${META_LISTE_MAX} liegen (war ${options.limit})`)
  }
  const col = await getCollectionOnly(libraryKey)
  const query = { kind: 'meta', libraryId, ...filter }
  const projektion = {
    _id: 0, fileId: 1, fileName: 1, title: 1, shortTitle: 1, detailViewType: 1,
    upsertedAt: 1, publication: 1, docMetaJson: 1,
  }
  const [rows, total] = await Promise.all([
    col.find(query).project(projektion).sort(options.sort).skip(options.skip).limit(options.limit).toArray(),
    col.countDocuments(query),
  ])
  return { zeilen: rows.map(zeile), total }
}

/**
 * Alle Zeilen eines Filters, seitenweise gelesen, bis `maxDokumente`. Liefert
 * mit, ob der Bestand abgeschnitten wurde — der Aufrufer sagt das, statt
 * eine Teilpruefung als vollstaendig auszugeben.
 */
export async function alleMetaFelder(
  libraryKey: string,
  libraryId: string,
  filter: Record<string, unknown>,
  maxDokumente: number,
): Promise<{ zeilen: MetaFeldZeile[]; total: number; abgeschnitten: boolean }> {
  const zeilen: MetaFeldZeile[] = []
  let total = 0
  for (let skip = 0; skip < maxDokumente; skip += META_LISTE_MAX) {
    const limit = Math.min(META_LISTE_MAX, maxDokumente - skip)
    const seite = await findeMetaFelder(libraryKey, libraryId, filter, { skip, limit, sort: { upsertedAt: -1 } })
    total = seite.total
    zeilen.push(...seite.zeilen)
    if (seite.zeilen.length < limit || zeilen.length >= total) break
  }
  return { zeilen, total, abgeschnitten: zeilen.length < total }
}
