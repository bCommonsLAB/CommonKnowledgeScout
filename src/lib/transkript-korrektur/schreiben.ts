/**
 * @fileoverview Korrigiertes Transkript nach MongoDB schreiben (P3b).
 *
 * @description
 * Gemeinsamer Schreibweg fuer Bruecke und Oberflaeche: MongoDB ist die
 * fuehrende Fassung. Die Bruecke (`korrigiereTranskript`) unterdrueckt den
 * Spiegel-Write des Services und exportiert danach selbst versioniert; die
 * Oberflaeche laesst den Service den Spiegel nachziehen, wenn die Library
 * `persistToFilesystem` fuehrt. Bewusst NICHT hier: Transformations-Bodies
 * anfassen oder eine Re-Transformation starten (kostet Geld).
 *
 * @module transkript-korrektur
 */

import type { TransformationZeile } from '@/lib/mcp/transkript-korrektur-typen'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'

/**
 * Transformationen der Familie — nach einer Korrektur ALLE ueberholt (sie
 * entstanden vorher). `twinOrdnerPfad` nur fuer die Pfadangabe in der Antwort;
 * ohne Spiegel reicht der leere String.
 */
export function transformationenVon(doc: ShadowTwinDocument, twinOrdnerPfad: string): TransformationZeile[] {
  const zeilen: TransformationZeile[] = []
  for (const [template, sprachen] of Object.entries(doc.artifacts?.transformation ?? {})) {
    for (const [sprache, record] of Object.entries(sprachen ?? {})) {
      if (typeof record?.markdown !== 'string') continue
      const name = buildArtifactName(
        { sourceId: doc.sourceId, kind: 'transformation', targetLanguage: sprache, templateName: template },
        doc.sourceName,
      )
      zeilen.push({ pfad: twinOrdnerPfad ? `${twinOrdnerPfad}/${name}` : name, template, sprache, jetztUeberholt: true })
    }
  }
  return zeilen
}

export interface TranskriptSchreibLauf {
  library: Library
  userEmail: string
  /** Noetig, wenn der Service den Spiegel schreiben soll (`persistToFilesystem`). */
  provider?: StorageProvider
  doc: Pick<ShadowTwinDocument, 'sourceId' | 'sourceName' | 'parentId'>
  markdownNeu: string
  /** true = nur MongoDB (die Bruecke exportiert danach selbst versioniert). */
  skipFilesystemMirror: boolean
}

/** Schreibt das korrigierte Transkript als fuehrende Fassung nach MongoDB. */
export async function schreibeTranskriptKorrektur(args: TranskriptSchreibLauf): Promise<void> {
  const { library, userEmail, provider, doc, markdownNeu, skipFilesystemMirror } = args
  const service = new ShadowTwinService({
    library, userEmail, sourceId: doc.sourceId, sourceName: doc.sourceName, parentId: doc.parentId, provider,
  })
  await service.upsertMarkdown({ kind: 'transcript', targetLanguage: '', markdown: markdownNeu, skipFilesystemMirror })
}
