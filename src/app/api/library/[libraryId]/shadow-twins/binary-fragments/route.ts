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

    // Extrahiere binaryFragments mit sourceId-Information
    // Enthält resolvedUrl: entweder Azure-URL oder generierte Storage-API-URL
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

    for (const [sourceId, doc] of docs.entries()) {
      // Extrahiere Transcript-Artefakte
      if (doc.artifacts?.transcript) {
        for (const [targetLanguage, record] of Object.entries(doc.artifacts.transcript)) {
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
          for (const [targetLanguage, record] of Object.entries(langRecords)) {
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
          
          // Generiere resolvedUrl: Azure-URL (bevorzugt) oder Storage-API-URL (Fallback)
          let resolvedUrl: string | undefined
          if (url) {
            // Azure Blob Storage URL vorhanden
            resolvedUrl = url
          } else if (fileId) {
            // Dateisystem-Referenz: Generiere Storage-API-URL
            resolvedUrl = `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(fileId)}&libraryId=${encodeURIComponent(libraryId)}`
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
