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
import { isAbsoluteLoopbackMediaUrl } from '@/lib/storage/non-portable-media-url'
import type { SiblingFile } from '../sibling-files/route'

/** Per `MEDIA_TAB_RESOLUTION_TRACE=1` in .env: detaillierte Server-Logs zu jeder Vorschau-URL (physische Quelle + Client-Pfad). */
function isMediaResolutionTraceEnabled(): boolean {
  return process.env.MEDIA_TAB_RESOLUTION_TRACE === '1'
}

/** Kurzklassifikation der an den Client gesendeten previewUrl (für Logs). */
function classifyPreviewUrlForTrace(url: string | undefined): string {
  if (!url) return 'none'
  const u = url.trim()
  if (u.startsWith('/api/storage/streaming-url')) {
    return 'relative_streaming_url_then_302_to_provider_binary'
  }
  if (u.includes('/api/storage/nextcloud')) {
    return 'relative_nextcloud_proxy_binary_direct'
  }
  if (u.includes('/api/storage/filesystem')) {
    return 'relative_filesystem_proxy_binary'
  }
  if (u.startsWith('https://') || u.startsWith('http://')) {
    return 'absolute_http_url_stored_in_mongo_eg_azure'
  }
  if (u.startsWith('/')) return 'relative_other_api_path'
  return 'unknown'
}

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

/** Löst Vorschau-URL für ein Fragment; liefert Trace-Felder für optionales Logging. */
async function resolveFragmentPreviewUrlWithTrace(
  libraryId: string,
  m: MediaFileInfo,
  storageProvider: Awaited<ReturnType<typeof getServerProvider>>,
): Promise<{ previewUrl: string | undefined; trace: Record<string, unknown> }> {
  const hadRawUrl = !!m.url
  const rawUrlLoopback = hadRawUrl && isAbsoluteLoopbackMediaUrl(m.url as string)
  let previewUrl: string | undefined
  let resolutionStep: string

  if (m.url && !isAbsoluteLoopbackMediaUrl(m.url)) {
    previewUrl = m.url
    resolutionStep = 'use_fragment_url_from_mongo'
  } else if (m.fileId) {
    try {
      previewUrl = await storageProvider.getStreamingUrl(m.fileId)
      resolutionStep = 'provider_getStreamingUrl'
    } catch {
      previewUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(m.fileId)}`
      resolutionStep = 'getStreamingUrl_threw_use_streaming_url_fallback'
    }
  } else {
    resolutionStep = 'no_url_no_fileId'
  }

  return {
    previewUrl,
    trace: {
      resolutionStep,
      mongoFragmentHadUrl: hadRawUrl,
      mongoUrlIgnoredAsLoopback: rawUrlLoopback || false,
      mongoFileId: m.fileId ?? null,
      previewUrlClass: classifyPreviewUrlForTrace(previewUrl),
    },
  }
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
    const storageBackendLabel = provider.name
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

    if (isMediaResolutionTraceEnabled()) {
      FileLogger.info('aggregated-media/trace', 'Kontext: Medien-Tab-Galerie = Storage-Geschwister + Mongo-binaryFragments', {
        libraryId,
        anchorSourceId: body.anchorSourceId,
        anchorFileName: anchorItem.metadata.name,
        parentFolderId: parentId,
        storageBackend: storageBackendLabel,
        uiNote:
          'Badge „lokal“ = Datei liegt als Geschwister im gleichen Ordner im Storage (listItemsById), nicht „lokales Dateisystem“.',
      })
      for (const f of files) {
        if (f.mediaKind !== 'image') continue
        FileLogger.info('aggregated-media/trace', 'Geschwister-Bild (nur Storage-Listing, kein Mongo-Eintrag nötig)', {
          libraryId,
          physicalSource: 'storage_webdav_or_filesystem',
          storageBackend: storageBackendLabel,
          fileName: f.name,
          storageFileId: f.id,
          uiGallerySource: 'sibling',
          uiBadgeLokalMeans: 'sibling_im_ordner',
          clientImgSrc:
            '/api/storage/streaming-url?libraryId=…&fileId=… (vom Client gebaut; siehe nächster Request in Network)',
          serverThen:
            'GET streaming-url → provider.getStreamingUrl(fileId) → 302 zu Binary-Proxy (z.B. /api/storage/nextcloud?action=binary)',
        })
      }
    }

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

        const { previewUrl, trace } = await resolveFragmentPreviewUrlWithTrace(libraryId, m, provider)
        const key = `fragment:${fragmentSourceId}:${m.name}`

        if (isMediaResolutionTraceEnabled()) {
          FileLogger.info('aggregated-media/trace', 'Fragment-Bild (Mongo binaryFragments-Metadaten; Bytes über Storage/Azure)', {
            libraryId,
            physicalSource:
              'mongo_shadow_twin_binaryFragments_eintrag plus ggf_webdav_oder_azure_bytes',
            storageBackend: storageBackendLabel,
            fragmentDisplayName: m.name,
            fragmentSourceId,
            sourcePdfOrFile: sourceFileName,
            uiGallerySource: 'fragment',
            ...trace,
            clientImgSrc: previewUrl ?? null,
          })
        }

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
