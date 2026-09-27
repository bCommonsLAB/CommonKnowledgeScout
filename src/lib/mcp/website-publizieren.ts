/**
 * @fileoverview Publizieren einer Markdown-Quelle ohne Sprachmodell (B1).
 *
 * @description
 * Der Weg, den `scripts/migrate-website-docs-to-files.ts` einmalig gegangen
 * ist, als Funktion: Markdown lesen, pruefen, als Transformation mit
 * deterministischem Vorlagennamen am Twin registrieren, regulaer ingestieren.
 * Der Text bleibt Byte fuer Byte, wie er in der Quelle steht — wer eine
 * Vorlage anwenden will, nimmt `transformation_starten`.
 *
 * Vorlagenname ist Teil des Artefakt-Schluessels (ArtifactKey-Determinismus):
 * `website-page` fuer Website-Seiten (kompatibel zu den Twins der Migration),
 * `markdown-page` fuer jede andere Markdown-Quelle.
 *
 * @module mcp
 */

import { IngestionService } from '@/lib/chat/ingestion-service'
import { deleteVectorsByFileId, getCollectionNameForLibrary, getMetaByFileId } from '@/lib/repositories/vector-repo'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'
import { getEffectiveDocumentNavigationSlug } from '@ks/util'
import type { ResolvedSource } from './tools-erschliessen-shared'
import { istMarkdownQuelle } from './transformation-markdown'
import { pruefeMarkdownDokument } from './website-pruefung'

export const VORLAGE_WEBSITE = 'website-page'
export const VORLAGE_MARKDOWN = 'markdown-page'

export interface PublizierZeile {
  quelle: string
  fileId?: string
  navigationSlug?: string | null
  detailViewType?: string | null
  warnungen: string[]
  /** Grund, warum NICHT geschrieben wurde (Warnungen ohne trotzWarnungen, harter Fehler). */
  uebersprungen?: string
  chunks?: number
}

/** Vorlagenname je Dokumenttyp — deterministisch, nie geraten. */
export function vorlageFuer(detailViewType: string | null): string {
  return detailViewType === 'website' ? VORLAGE_WEBSITE : VORLAGE_MARKDOWN
}

export async function publiziereMarkdownQuelle(args: {
  library: Library
  userEmail: string
  provider: StorageProvider
  source: ResolvedSource
  zielsprache: string
  trotzWarnungen: boolean
}): Promise<PublizierZeile> {
  const { library, userEmail, provider, source, zielsprache, trotzWarnungen } = args
  if (!istMarkdownQuelle(source.name)) {
    throw new Error(`"${source.name}" ist keine Markdown-Quelle — fuer Audio/PDF/Office quelle_erschliessen verwenden`)
  }
  const { blob } = await provider.getBinary(source.itemId)
  const markdown = await blob.text()
  const pruefung = pruefeMarkdownDokument(markdown)

  if (pruefung.fehler.length > 0) {
    return {
      quelle: source.name, warnungen: pruefung.warnungen,
      uebersprungen: `Fehler: ${pruefung.fehler.join('; ')}`,
    }
  }
  if (pruefung.warnungen.length > 0 && !trotzWarnungen) {
    return {
      quelle: source.name, warnungen: pruefung.warnungen,
      uebersprungen: 'Warnungen — mit trotzWarnungen: true publizieren oder das Dokument korrigieren',
    }
  }

  const twin = new ShadowTwinService({
    library, userEmail, sourceId: source.itemId, sourceName: source.name, parentId: source.parentId, provider,
  })
  await twin.upsertMarkdown({
    kind: 'transformation',
    targetLanguage: zielsprache,
    templateName: vorlageFuer(pruefung.detailViewType),
    markdown,
  })
  const ingest = await IngestionService.upsertMarkdown(
    userEmail, library.id, source.itemId, source.name, markdown, undefined, undefined, provider,
  )
  return {
    quelle: source.name,
    fileId: source.itemId,
    navigationSlug: getEffectiveDocumentNavigationSlug({
      fileId: source.itemId,
      fileName: source.name,
      title: typeof pruefung.meta.title === 'string' ? pruefung.meta.title : undefined,
      shortTitle: typeof pruefung.meta.shortTitle === 'string' ? pruefung.meta.shortTitle : undefined,
      slug: pruefung.meta.slug,
    }),
    detailViewType: pruefung.detailViewType,
    warnungen: pruefung.warnungen,
    chunks: ingest.chunksUpserted,
  }
}

/**
 * Nimmt den Galerie-Eintrag samt Vektoren zurueck. Twin und Quelle bleiben —
 * ein erneutes `dokument_publizieren` stellt den Eintrag wieder her.
 */
export async function depubliziereQuelle(args: {
  library: Library
  fileId: string
}): Promise<{ fileId: string; warPubliziert: boolean }> {
  const libraryKey = getCollectionNameForLibrary(args.library)
  const meta = await getMetaByFileId(libraryKey, args.fileId)
  if (!meta) return { fileId: args.fileId, warPubliziert: false }
  await deleteVectorsByFileId(libraryKey, args.fileId)
  return { fileId: args.fileId, warPubliziert: true }
}
