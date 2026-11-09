/**
 * @fileoverview Verwaltungssicht auf das Fragen-Log einer Library (Owner/Moderator).
 *
 * @description
 * Eine gespeicherte Antwort = eine Gruppe von Einträgen mit demselben
 * Cache-Hash (jeder Cache-Treffer legt seit D12b ein eigenes Log in der
 * Sitzung der Person an). Die Liste zeigt je Hash den jüngsten Eintrag und
 * zählt die Gruppe. Verwerfen setzt `cacheInvalidatedAt` auf ALLE Einträge
 * der Gruppe — sonst käme die alte Antwort über einen Zwilling zurück.
 * Niemals löschen; Chronik und Sitzungen bleiben vollständig.
 * Erstellerdaten (E-Mail, Sitzung) verlassen dieses Modul nicht.
 *
 * @module chat
 */

import type { Filter } from 'mongodb'
import type { QueryLog } from '@/types/query-log'
import type { StoryTopicsData } from '@/types/story-topics'
import { getQueriesCollection } from './queries-repo'

/** `null` matcht fehlend UND null — das Feld fehlt an allen Einträgen vor dieser Welle. */
const NICHT_VERWORFEN = { cacheInvalidatedAt: null as unknown as Date }

/**
 * Antwort oder Themenübersicht vorhanden — nur solche Einträge sind Cache-Kandidaten.
 * `null` steht ausdrücklich in `$nin`: der Mongo-Treiber schreibt `undefined`
 * als null, und ein Fehler-Log mit `answer: null` darf keine Antwort sein.
 */
const MIT_ANTWORT: Filter<QueryLog> = {
  $or: [
    { answer: { $nin: ['', null as unknown as string] } },
    { storyTopicsData: { $exists: true, $ne: null as unknown as StoryTopicsData } },
  ],
}

/** Höchstens so viele Gruppen werden gelesen und geprüft — genug für jede Library, begrenzt für den Server. */
export const MAX_GRUPPEN = 2000

export interface FragenLogGruppe {
  queryId: string
  question: string
  shortTitle: string | null
  createdAt: Date
  status: QueryLog['status']
  cacheHash: string | null
  cacheParams: QueryLog['cacheParams'] | null
  cacheInvalidatedAt: Date | null
  /** Zitierte Dokumente der Antwort (`references`). */
  anzahlQuellen: number
  /** Einträge mit diesem Hash (Cache-Treffer eingeschlossen). */
  anzahlEintraege: number
}

export interface FragenLogFilter {
  libraryId: string
  /** Teiltext in der Frage, Groß-/Kleinschreibung egal. */
  suche?: string
  /** Nur Einträge, die noch als Cache-Treffer gelten (nicht verworfen). */
  nurTreffer?: boolean
}

function regexSicher(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Jüngster Eintrag je Cache-Hash (ohne Hash: je queryId), jüngste zuerst. */
export async function listeFragenLogGruppen(filter: FragenLogFilter): Promise<FragenLogGruppe[]> {
  const col = await getQueriesCollection()
  const match: Record<string, unknown> = { libraryId: filter.libraryId, ...MIT_ANTWORT }
  const suche = filter.suche?.trim()
  if (suche) match.question = { $regex: regexSicher(suche), $options: 'i' }
  if (filter.nurTreffer) match.cacheInvalidatedAt = null
  const rows = await col
    .aggregate<FragenLogGruppe>([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $ifNull: ['$cacheHash', '$queryId'] },
          queryId: { $first: '$queryId' },
          question: { $first: '$question' },
          shortTitle: { $first: '$shortTitle' },
          createdAt: { $first: '$createdAt' },
          status: { $first: '$status' },
          cacheHash: { $first: '$cacheHash' },
          cacheParams: { $first: '$cacheParams' },
          cacheInvalidatedAt: { $first: '$cacheInvalidatedAt' },
          anzahlQuellen: { $first: { $size: { $ifNull: ['$references', []] } } },
          anzahlEintraege: { $sum: 1 },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: MAX_GRUPPEN },
      { $project: { _id: 0 } },
    ])
    .toArray()
  return rows.map((r) => ({
    ...r,
    shortTitle: r.shortTitle ?? null,
    cacheHash: r.cacheHash ?? null,
    cacheParams: r.cacheParams ?? null,
    cacheInvalidatedAt: r.cacheInvalidatedAt ?? null,
  }))
}

/** Wie viele gespeicherte Antworten (Hash-Gruppen) der Library gelten noch als Treffer? */
export async function zaehleGueltigeAntworten(libraryId: string): Promise<number> {
  const col = await getQueriesCollection()
  const rows = await col
    .aggregate<{ anzahl: number }>([
      { $match: { libraryId, ...MIT_ANTWORT, ...NICHT_VERWORFEN } },
      { $group: { _id: { $ifNull: ['$cacheHash', '$queryId'] } } },
      { $count: 'anzahl' },
    ])
    .toArray()
  return rows[0]?.anzahl ?? 0
}

export interface VerwerfenAuftrag {
  libraryId: string
  queryIds?: string[]
  alle?: boolean
}

export interface VerwerfenErgebnis {
  /** Einträge, die jetzt `cacheInvalidatedAt` tragen (vorher nicht verworfen). */
  verworfen: number
  /** Nur bei queryIds: wie viele der genannten Kennungen in der Library gefunden wurden. */
  gefunden?: number
  zeitpunkt: Date
}

/**
 * Verwirft Antworten: `alle` setzt das Datum auf jeden noch gültigen Eintrag
 * der Library; `queryIds` auf jeden Eintrag, der denselben Hash wie eine der
 * genannten Kennungen trägt (Einträge ohne Hash nur direkt).
 */
export async function verwerfeAntworten(auftrag: VerwerfenAuftrag): Promise<VerwerfenErgebnis> {
  const ids = (auftrag.queryIds ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0)
  if (auftrag.alle !== true && ids.length === 0) {
    throw new Error('Entweder queryIds (mindestens eine Kennung) oder alle: true angeben')
  }
  const col = await getQueriesCollection()
  const zeitpunkt = new Date()
  const noch: Filter<QueryLog> = { libraryId: auftrag.libraryId, ...NICHT_VERWORFEN, ...MIT_ANTWORT }
  if (auftrag.alle === true) {
    const r = await col.updateMany(noch, { $set: { cacheInvalidatedAt: zeitpunkt } })
    return { verworfen: r.modifiedCount, zeitpunkt }
  }
  const treffer = await col
    .find({ libraryId: auftrag.libraryId, queryId: { $in: ids } }, { projection: { _id: 0, queryId: 1, cacheHash: 1 } })
    .toArray()
  const hashes = [...new Set(treffer.map((t) => t.cacheHash).filter((h): h is string => typeof h === 'string' && h.length > 0))]
  const ohneHash = treffer.filter((t) => !t.cacheHash).map((t) => t.queryId)
  if (hashes.length === 0 && ohneHash.length === 0) return { verworfen: 0, gefunden: 0, zeitpunkt }
  const r = await col.updateMany(
    { ...noch, $and: [MIT_ANTWORT, { $or: [{ cacheHash: { $in: hashes } }, { queryId: { $in: ohneHash } }] }] },
    { $set: { cacheInvalidatedAt: zeitpunkt } },
  )
  return { verworfen: r.modifiedCount, gefunden: treffer.length, zeitpunkt }
}

/** Ein Eintrag für die Verwaltungssicht — ohne Erstellerdaten (E-Mail, Sitzung). */
export async function leseEintragFuerVerwaltung(libraryId: string, queryId: string): Promise<Omit<QueryLog, 'userEmail' | 'sessionId'> | null> {
  const col = await getQueriesCollection()
  const log = await col.findOne({ queryId, libraryId }, { projection: { _id: 0, userEmail: 0, sessionId: 0 } })
  return log ?? null
}
