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
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { getServerProvider } from '@/lib/storage/server-provider'
import { FileLogger } from '@/lib/debug/logger'

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
      artifactFileName: string
      kind: 'transcript' | 'transformation'
      targetLanguage: string
      templateName?: string
      mongoUpserted: boolean
    }> = []

    // Typ für Bild-Varianten
    type ImageVariant = 'original' | 'thumbnail' | 'preview'

    for (const [sourceId, doc] of docs.entries()) {
      // Extrahiere Transcript-Artefakte
      if (doc.artifacts?.transcript) {
        for (const [targetLanguage] of Object.entries(doc.artifacts.transcript)) {
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
              artifactFileName,
              kind: 'transformation',
              targetLanguage,
              templateName,
              mongoUpserted: true,
            })
          }
        }
      }

      // Extrahiere binaryFragments mit resolvedUrl
      if (doc.binaryFragments && Array.isArray(doc.binaryFragments)) {
        for (const fragment of doc.binaryFragments) {
          const url = fragment.url as string | undefined
          const fileId = fragment.fileId as string | undefined
          
          // Generiere resolvedUrl: Azure-URL (bevorzugt) oder provider-aufgelöste Streaming-URL
          let resolvedUrl: string | undefined
          if (url) {
            // Azure Blob Storage URL vorhanden
            resolvedUrl = url
          } else if (fileId) {
            // Über Provider auflösen (provider-agnostisch) oder Streaming-URL als Fallback
            if (storageProvider) {
              try {
                resolvedUrl = await storageProvider.getStreamingUrl(fileId)
              } catch {
                resolvedUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
              }
            } else {
              resolvedUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(fileId)}`
            }
          }
          
          fragments.push({
            sourceId,
            sourceName: doc.sourceName,
            name: (fragment.name as string) || 'Unbekannt',
            kind: (fragment.kind as string) || 'binary',
            url,
            fileId,
            resolvedUrl,
            hash: fragment.hash as string | undefined,
            mimeType: fragment.mimeType as string | undefined,
            size: fragment.size as number | undefined,
            createdAt: (fragment.createdAt as string) || new Date().toISOString(),
            variant: fragment.variant as ImageVariant | undefined,
            sourceHash: fragment.sourceHash as string | undefined,
          })
        }
      }
    }

    return NextResponse.json({ fragments, artifacts }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/binary-fragments', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
