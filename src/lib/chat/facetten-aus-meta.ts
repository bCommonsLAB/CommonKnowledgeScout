/**
 * Facettenwerte aus dem Meta-Dokument ergänzen (Befund 07.10.2026, Plan `story-status-modalitaet`).
 *
 * Die Facettenwerte landen beim Ingest auf jedem Chunk (`extractFacetValues`),
 * aber nur für Facetten, die ZU DIESEM ZEITPUNKT konfiguriert waren. Wird eine
 * Facette später angelegt, tragen ältere Chunks sie nicht — Quellen-Header
 * (m3) und Nachprüfung (m4) sehen den Status dann nicht, obwohl das
 * Meta-Dokument ihn hat. (Im Live-Test 07.10. lag die Hauptursache woanders:
 * feste Feldlisten in Projektion und Mapping der Vektorsuche, inzwischen
 * behoben. Dieses Sicherheitsnetz bleibt für Libraries ohne Re-Ingest.)
 *
 * Der Orchestrator zieht nach dem Retrieval fehlende Facettenwerte aus den
 * Meta-Dokumenten nach: eine Abfrage je Antwort, nur Dokumente mit Lücke,
 * nur fehlende Schlüssel (Chunk-Werte haben Vorrang). Das ist kein stiller
 * Fallback: ohne Meta-Dokument bleibt die Lücke, und der Aufrufer bekommt die
 * Zahlen zum Protokollieren. Für den Galerie-/Facetten-Pfad ist das
 * Meta-Dokument in Mongo ohnehin die Quelle der Wahrheit.
 */

import type { Document } from 'mongodb'
import { getCollectionOnly } from '@/lib/repositories/vector-repo'
import { fileIdVonQuelle } from '@/lib/chat/common/zitatmarken'
import { extractFacetMetadata } from '@/lib/chat/retrievers/metadata-extractor'
import type { FacetDef } from '@/lib/chat/dynamic-facets'
import type { RetrievedSource } from '@/types/retriever'

export interface FacettenErgaenzung {
  /** Dokumente (fileIds), bei denen mindestens eine Facette auf einer Textstelle fehlte. */
  dokumenteMitLuecke: number
  /** Dokumente, zu denen ein Meta-Dokument gefunden wurde. */
  metaGefunden: number
  /** Anzahl nachgezogener Facettenwerte über alle Textstellen. */
  ergaenzt: number
}

/** Facettenwerte eines Meta-Dokuments: `docMetaJson` zuerst, Top-Level-Felder (z. B. Backfill) haben Vorrang. */
function facettenDesMetaDokuments(doc: Document, facetDefs: ReadonlyArray<FacetDef>): Record<string, unknown> {
  const defs = [...facetDefs]
  const ausJson = extractFacetMetadata(doc.docMetaJson as Record<string, unknown> | undefined, defs)
  const topLevel = extractFacetMetadata(doc as Record<string, unknown>, defs)
  return { ...ausJson, ...topLevel }
}

/**
 * Ergänzt `source.metadata` um Facettenwerte aus dem Meta-Dokument, wo sie
 * fehlen. Mutiert die übergebenen Quellen (dieselben Objekte gehen in Prompt,
 * Belege und Nachprüfung).
 */
export async function ergaenzeFacettenAusMeta(
  sources: RetrievedSource[],
  facetDefs: ReadonlyArray<FacetDef>,
  libraryKey: string,
  libraryId: string,
): Promise<FacettenErgaenzung> {
  const keys = facetDefs.map((f) => f.metaKey)
  const fehlt = (s: RetrievedSource) => keys.some((k) => s.metadata?.[k] === undefined)
  const fileIds = [...new Set(sources.filter(fehlt).map(fileIdVonQuelle))]
  if (fileIds.length === 0) return { dokumenteMitLuecke: 0, metaGefunden: 0, ergaenzt: 0 }

  const col = await getCollectionOnly(libraryKey)
  const projection: Record<string, 1> = { fileId: 1, docMetaJson: 1 }
  for (const k of keys) projection[k] = 1
  const docs = await col.find({ kind: 'meta', libraryId, fileId: { $in: fileIds } }, { projection }).toArray()
  const werteJeDatei = new Map<string, Record<string, unknown>>()
  for (const doc of docs) {
    if (typeof doc.fileId === 'string') werteJeDatei.set(doc.fileId, facettenDesMetaDokuments(doc, facetDefs))
  }

  let ergaenzt = 0
  for (const source of sources) {
    const werte = werteJeDatei.get(fileIdVonQuelle(source))
    if (!werte) continue
    for (const k of keys) {
      if (source.metadata?.[k] !== undefined || werte[k] === undefined) continue
      source.metadata = { ...(source.metadata ?? {}), [k]: werte[k] }
      ergaenzt += 1
    }
  }
  return { dokumenteMitLuecke: fileIds.length, metaGefunden: werteJeDatei.size, ergaenzt }
}
