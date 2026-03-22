/**
 * @fileoverview Aggregierte Medien für Transformations-/Medien-Tab
 *
 * Kombiniert Geschwister-Dateien im Quellordner mit Shadow-Twin-Fragmenten
 * über denselben Service wie das Sammel-Transkript — kanonische Dateinamen,
 * keine doppelte Client-Logik.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { getMediaKind, type MediaKind } from '@/lib/media-types'
import { FileLogger } from '@/lib/debug/logger'
import {
  buildAggregatedMediaForSources,
  type MediaFileInfo,
} from '@/lib/media/aggregated-media-service'
import type { SiblingFile } from '../sibling-files/route'

/** Wie sibling-files: nur zuordenbare Medien-Typen */
const ASSIGNABLE_MEDIA_KINDS = new Set<MediaKind>(['image', 'pdf', 'link'])

/** Ein Fragment-Eintrag für die Galerie (kanonischer Name, stabiler Key) */
export interface AggregatedFragmentGalleryItem {
  key: string
  /** Anzeige- und Frontmatter-Name (nach Transkript-Normalisierung) */
  displayName: string
  /** Storage-sourceId der Quelldatei (z. B. PDF) */
  fragmentSourceId: string
  mediaKind: 'image' | 'document'
  previewUrl?: string
  /** Quelldateiname (PDF/Office), aus der extrahiert wurde */
  sourceFileName?: string
}

async function resolveFragmentPreviewUrl(
  libraryId: string,
  m: MediaFileInfo,
  storageProvider: Awaited<ReturnType<typeof getServerProvider>>,
): Promise<string | undefined> {
  if (m.url) return m.url
  if (m.fileId) {
    try {
      return await storageProvider.getStreamingUrl(m.fileId)
    } catch {
      return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(m.fileId)}`
    }
  }
  return undefined
}

/**
 * Baut die Liste der Shadow-Twin-Quellen für die Aggregation (wie MediaTab fragmentSourceIds).
 */
function buildAggregationSourceItems(
  parentId: string,
  anchorSourceId: string,
  anchorName: string,
  compositeSourceFileNames: string[],
  nameToSiblingId: Map<string, string>,
): Array<{ id: string; name: string; parentId: string }> {
  const byId = new Map<string, { id: string; name: string; parentId: string }>()

  const add = (id: string, name: string) => {
    if (!byId.has(id)) {
      byId.set(id, { id, name, parentId })
    }
  }

  add(anchorSourceId, anchorName)

  if (compositeSourceFileNames.length > 0) {
    for (const fileName of compositeSourceFileNames) {
      const sid = nameToSiblingId.get(fileName)
      if (sid) {
        add(sid, fileName)
      }
    }
  }

  return [...byId.values()]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> },
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })
    }

    const { libraryId } = await params
    const body = await request.json() as {
      anchorSourceId?: string
      targetLanguage?: string
      compositeSourceFileNames?: string[]
    }

    if (!body?.anchorSourceId || typeof body.anchorSourceId !== 'string') {
      return NextResponse.json({ error: 'anchorSourceId ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const anchorItem = await provider.getItemById(body.anchorSourceId)
    if (!anchorItem) {
      return NextResponse.json({ error: 'Quelldatei nicht gefunden' }, { status: 404 })
    }

    const parentId = anchorItem.parentId
    const siblings = await provider.listItemsById(parentId)

    const files: SiblingFile[] = siblings
      .filter((item) => {
        if (item.id === body.anchorSourceId) return false
        if (item.type === 'folder') return false
        const kind = getMediaKind(item)
        return ASSIGNABLE_MEDIA_KINDS.has(kind)
      })
      .map((item) => ({
        id: item.id,
        name: item.metadata.name,
        size: item.metadata.size,
        mediaKind: getMediaKind(item),
        mimeType: item.metadata.mimeType,
      }))

    const nameToSiblingId = new Map(files.map((f) => [f.name, f.id] as const))

    const compositeNames = Array.isArray(body.compositeSourceFileNames)
      ? body.compositeSourceFileNames.filter((n): n is string => typeof n === 'string')
      : []

    const targetLanguage =
      typeof body.targetLanguage === 'string' && body.targetLanguage.trim() !== ''
        ? body.targetLanguage.trim()
        : 'de'

    const sourceItems = buildAggregationSourceItems(
      parentId,
      body.anchorSourceId,
      anchorItem.metadata.name,
      compositeNames,
      nameToSiblingId,
    )

    const { mediaFiles, pdfSections, otherExtracted } = await buildAggregatedMediaForSources({
      libraryId,
      userEmail,
      targetLanguage,
      sourceItems,
    })

    const sourceFileToId = new Map(sourceItems.map((s) => [s.name, s.id] as const))

    const fragmentGalleryItems: AggregatedFragmentGalleryItem[] = []

    /**
     * Kanonische Namen und Normalisierung stecken in pdfSections/otherExtracted
     * (nicht in dem Roh-Array mediaFiles aus collectMediaFiles).
     */
    const appendLayoutFragments = async (
      layoutFragments: MediaFileInfo[],
      sourceFileName: string,
    ) => {
      const fragmentSourceId = sourceFileToId.get(sourceFileName)
      if (!fragmentSourceId) return

      for (const m of layoutFragments) {
        const looksLikeImage =
          m.mimeType?.toLowerCase().startsWith('image/') ||
          /\.(jpe?g|png|gif|webp)$/i.test(m.name || '')
        if (!looksLikeImage) continue

        const previewUrl = await resolveFragmentPreviewUrl(libraryId, m, provider)
        const key = `fragment:${fragmentSourceId}:${m.name}`

        fragmentGalleryItems.push({
          key,
          displayName: m.name,
          fragmentSourceId,
          mediaKind: 'image',
          previewUrl,
          sourceFileName,
        })
      }
    }

    for (const section of pdfSections) {
      await appendLayoutFragments(section.fragments, section.pdfFileName)
    }
    for (const group of otherExtracted) {
      await appendLayoutFragments(group.fragments, group.sourceFileName)
    }

    FileLogger.info('aggregated-media', 'Aggregation geliefert', {
      libraryId,
      siblingCount: files.length,
      rawMediaFileCount: mediaFiles.length,
      fragmentRowCount: fragmentGalleryItems.length,
      pdfSectionCount: pdfSections.length,
      otherExtractedCount: otherExtracted.length,
    })

    return NextResponse.json({
      files,
      fragmentGalleryItems,
      pdfSections,
      otherExtracted,
    })
  } catch (error) {
    FileLogger.error('aggregated-media', 'Fehler bei Aggregation', { error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Interner Fehler' },
      { status: 500 },
    )
  }
}
