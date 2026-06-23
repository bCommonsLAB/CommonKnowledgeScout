/**
 * @fileoverview Shadow-Twin Binary Fragments API
 *
 * @description
 * Liefert binaryFragments aus MongoDB für gegebene sourceIds.
 * Wird verwendet, um alle Dateien eines Migration-Runs anzuzeigen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinsBySourceIds, readTranscriptRecord, type ShadowTwinArtifactRecord } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { isAbsoluteLoopbackMediaUrl } from '@/lib/storage/non-portable-media-url'
import { FileLogger } from '@/lib/debug/logger'
import { mapWithConcurrency } from '@/lib/utils/concurrency'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const { libraryId } = await params
    const body = await request.json() as { sourceIds?: string[] }

    if (!body?.sourceIds || !Array.isArray(body.sourceIds)) {
      return NextResponse.json({ error: 'sourceIds Array ist erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    // Lade Shadow-Twin-Dokumente für alle sourceIds
    const docs = await getShadowTwinsBySourceIds({
      libraryId,
      sourceIds: body.sourceIds,
    })

    // Provider einmalig holen, um Streaming-URLs aufzulösen (statt hardcoded Filesystem-URL)
    let storageProvider: Awaited<ReturnType<typeof getServerProvider>> | null = null
    try {
      storageProvider = await getServerProvider(userEmail, libraryId)
    } catch (providerError) {
      FileLogger.warn('shadow-twins/binary-fragments', 'Provider konnte nicht geladen werden – Fallback auf streaming-url', { error: providerError })
    }

    // Extrahiere binaryFragments mit sourceId-Information
    // Enthält resolvedUrl: entweder Azure-URL oder provider-aufgelöste Streaming-URL
    const fragments: Array<{
      sourceId: string
      sourceName: string
      parentName?: string
      name: string
      kind: string
      url?: string
      fileId?: string
      /** Aufgelöste URL: Azure-URL (bevorzugt) oder Storage-API-URL (Fallback) */
      resolvedUrl?: string
      hash?: string
      mimeType?: string
      size?: number
      createdAt: string
      /** Variante: original, thumbnail, preview */
      variant?: ImageVariant
      /** Hash des Original-Bildes (bei Thumbnails/Previews) */
      sourceHash?: string
    }> = []

    // Extrahiere auch Artefakte (Markdown-Dateien) aus den Dokumenten
    const artifacts: Array<{
      sourceId: string
      sourceName: string
      parentName?: string
      artifactFileName: string
      kind: 'transcript' | 'transformation'
      targetLanguage: string
      templateName?: string
      mongoUpserted: boolean
    }> = []

    // Cache fuer Ordnernamen (parentId -> name)
    const parentNameCache = new Map<string, string>()
    async function resolveParentName(parentId: string | undefined): Promise<string> {
      if (!parentId || !storageProvider) return ''
      const cached = parentNameCache.get(parentId)
      if (cached !== undefined) return cached
      try {
        const parentItem = await storageProvider.getItemById(parentId)
        const name = parentItem?.metadata?.name || ''
        parentNameCache.set(parentId, name)
        return name
      } catch {
        parentNameCache.set(parentId, '')
        return ''
      }
    }

    // Typ für Bild-Varianten
    type ImageVariant = 'original' | 'thumbnail' | 'preview'

    // Rohe Fragmente einsammeln; die teure getStreamingUrl-Aufloesung passiert danach
    // gebuendelt + begrenzt parallel (B3) statt seriell pro Fragment.
    const rawFragments: Array<{ sourceId: string; sourceName: string; parentName: string; fragment: Record<string, unknown> }> = []

    for (const [sourceId, doc] of docs.entries()) {
      // Ordnernamen einmalig pro parentId aufloesen
      const parentName = await resolveParentName(doc.parentId)

      // Extrahiere Transcript-Artefakt (sprach-neutral: max. ein Record pro Quelle; Helper toleriert Legacy-Map)
      {
        const transcriptRecord = readTranscriptRecord(doc)
        const transcriptEntries: Array<[string, ShadowTwinArtifactRecord]> = transcriptRecord ? [['', transcriptRecord]] : []
        for (const [targetLanguage] of transcriptEntries) {
          const { buildArtifactName } = await import('@/lib/shadow-twin/artifact-naming')
          const artifactFileName = buildArtifactName(
            {
              sourceId,
              kind: 'transcript',
              targetLanguage,
            },
            doc.sourceName
          )
          artifacts.push({
            sourceId,
            sourceName: doc.sourceName,
            parentName: parentName || undefined,
            artifactFileName,
            kind: 'transcript',
            targetLanguage,
            mongoUpserted: true,
          })
        }
      }

      // Extrahiere Transformation-Artefakte
      if (doc.artifacts?.transformation) {
        for (const [templateName, langRecords] of Object.entries(doc.artifacts.transformation)) {
          for (const [targetLanguage] of Object.entries(langRecords)) {
            const { buildArtifactName } = await import('@/lib/shadow-twin/artifact-naming')
            const artifactFileName = buildArtifactName(
              {
                sourceId,
                kind: 'transformation',
                targetLanguage,
                templateName,
              },
              doc.sourceName
            )
            artifacts.push({
              sourceId,
              sourceName: doc.sourceName,
              parentName: parentName || undefined,
              artifactFileName,
              kind: 'transformation',
              targetLanguage,
              templateName,
              mongoUpserted: true,
            })
          }
        }
      }

      // binaryFragments nur einsammeln (Aufloesung folgt gebuendelt nach der Schleife)
      if (doc.binaryFragments && Array.isArray(doc.binaryFragments)) {
        for (const fragment of doc.binaryFragments) {
          rawFragments.push({ sourceId, sourceName: doc.sourceName, parentName, fragment: fragment as Record<string, unknown> })
        }
      }
    }

    // resolvedUrl je Fragment BEGRENZT PARALLEL aufloesen (statt seriell ~1,5 s/Bild).
    // Azure/oeffentliche URLs brauchen keinen Call; nur fileId-Fragmente rufen
    // getStreamingUrl. Bounded concurrency haelt Nextcloud unter dem Rate-Limit (429).
    const STREAMING_URL_CONCURRENCY = 8
    const resolvedUrls = await mapWithConcurrency(
      rawFragments,
      STREAMING_URL_CONCURRENCY,
      async ({ fragment }): Promise<string | undefined> => {
        const url = fragment.url as string | undefined
        const fileId = fragment.fileId as string | undefined
        // Azure oder andere oeffentliche URL — nicht Dev-localhost-Proxy aus Mongo.
        if (url && !isAbsoluteLoopbackMediaUrl(url)) return url
        if (fileId) {
          if (storageProvider) {
            try {
              return await storageProvider.getStreamingUrl(fileId)
            } catch {
              return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
            }
          }
          return `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
        }
        return undefined
      }
    )

    rawFragments.forEach(({ sourceId, sourceName, parentName, fragment }, i) => {
      fragments.push({
        sourceId,
        sourceName,
        parentName: parentName || undefined,
        name: (fragment.name as string) || 'Unbekannt',
        // kind aus Fragment, oder aus mimeType/Dateiname ableiten (für ältere Daten ohne kind-Feld)
        kind: (fragment.kind as string)
          || (fragment.mimeType && (fragment.mimeType as string).startsWith('image/') ? 'image' : undefined)
          || (/\.(jpeg|jpg|png|gif|webp|svg|bmp)$/i.test((fragment.name as string) || '') ? 'image' : 'binary'),
        url: fragment.url as string | undefined,
        fileId: fragment.fileId as string | undefined,
        resolvedUrl: resolvedUrls[i],
        hash: fragment.hash as string | undefined,
        mimeType: fragment.mimeType as string | undefined,
        size: fragment.size as number | undefined,
        createdAt: (fragment.createdAt as string) || new Date().toISOString(),
        variant: fragment.variant as ImageVariant | undefined,
        sourceHash: fragment.sourceHash as string | undefined,
      })
    })

    return NextResponse.json({ fragments, artifacts }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/binary-fragments', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
