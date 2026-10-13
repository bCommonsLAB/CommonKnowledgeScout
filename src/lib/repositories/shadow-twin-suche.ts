/**
 * @fileoverview Twin-Dokumente einer Library nach Quellkennung oder Name finden (Wunschliste 8, W8-2).
 *
 * @description
 * Lesender Zugriff auf `shadow_twins__<libraryId>`. Je Library EINE Abfrage
 * mit `$in` ueber Kennungen und Namen — der Aufrufer fragt Library fuer
 * Library (`quelle-suche-lauf.ts`). Gestuetzt von den Indizes
 * `{ libraryId, sourceContentHash }` und `{ libraryId, sourceName }`
 * (`ensureShadowTwinIndexes`); hier wird KEIN Index angelegt, weil das auf
 * einer Library ohne Twins eine leere Collection erzeugte — ein Lesezugriff
 * schreibt nicht.
 *
 * `mitErschliessung: false` laedt nur die Kopf-Felder (der Scan braucht keine
 * Artefakte); `true` laedt die Dokumente ganz, um Transkript und
 * Transformationen zu zaehlen — deshalb mit Obergrenze.
 *
 * @module repositories
 */

import { getShadowTwinCollection, readTranscriptRecord, type ShadowTwinDocument } from './shadow-twin-repo'

export interface QuellKandidat {
  libraryId: string
  sourceId: string
  sourceName: string
  parentId: string
  sourceContentHash: string | null
  sourceSize: number | null
  /** Nur mit `mitErschliessung`: gibt es ein Transkript, wie viele Transformationen? */
  erschliessung?: { transkript: boolean; transformationen: number }
}

const KOPF_FELDER = { _id: 0, sourceId: 1, sourceName: 1, parentId: 1, sourceContentHash: 1, sourceSize: 1 } as const

function zaehleTransformationen(doc: ShadowTwinDocument): number {
  let anzahl = 0
  for (const sprachen of Object.values(doc.artifacts?.transformation ?? {})) {
    for (const record of Object.values(sprachen ?? {})) if (typeof record?.markdown === 'string') anzahl += 1
  }
  return anzahl
}

export async function findeQuellKandidaten(args: {
  libraryId: string
  hashes: readonly string[]
  namen: readonly string[]
  mitErschliessung: boolean
  limit: number
}): Promise<QuellKandidat[]> {
  const { libraryId, hashes, namen, mitErschliessung, limit } = args
  const oder = [
    ...(hashes.length > 0 ? [{ sourceContentHash: { $in: [...hashes] } }] : []),
    ...(namen.length > 0 ? [{ sourceName: { $in: [...namen] } }] : []),
  ]
  if (oder.length === 0) return []
  const col = await getShadowTwinCollection(libraryId)
  const docs = await col
    .find({ libraryId, $or: oder }, mitErschliessung ? {} : { projection: KOPF_FELDER })
    .limit(limit)
    .toArray()
  return docs.map((doc) => ({
    libraryId,
    sourceId: doc.sourceId,
    sourceName: doc.sourceName,
    parentId: doc.parentId,
    sourceContentHash: typeof doc.sourceContentHash === 'string' && doc.sourceContentHash !== '' ? doc.sourceContentHash : null,
    sourceSize: typeof doc.sourceSize === 'number' ? doc.sourceSize : null,
    ...(mitErschliessung
      ? { erschliessung: { transkript: readTranscriptRecord(doc) !== null, transformationen: zaehleTransformationen(doc) } }
      : {}),
  }))
}
