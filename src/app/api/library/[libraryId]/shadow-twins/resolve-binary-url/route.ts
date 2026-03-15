/**
 * @fileoverview Shadow-Twin Binary Fragment URL Resolver API
 *
 * @description
 * Löst die URL eines Binary-Fragments auf.
 * Verwendet den ShadowTwinService zur Storage-Abstraktion:
 * - Wenn Azure-URL vorhanden → direkt verwenden
 * - Wenn nur fileId vorhanden → Storage-API-URL generieren
 * - Fallback: Wenn in MongoDB keine Fragmente registriert sind,
 *   wird direkt im Shadow-Twin-Ordner im Storage gesucht.
 * 
 * Das Frontend muss sich nicht um die Storage-Details kümmern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin'
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo'
import { FileLogger } from '@/lib/debug/logger'

interface RequestBody {
  /** ID der Quelldatei */
  sourceId: string
  /** Name der Quelldatei */
  sourceName: string
  /** Parent-ID der Quelldatei */
  parentId: string
  /** Name des Binary-Fragments (z.B. "cover_generated_2026-01-20_12-20-43.png") */
  fragmentName: string
}

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
    const body = await request.json() as RequestBody

    if (!body?.sourceId || !body?.fragmentName) {
      return NextResponse.json({ error: 'sourceId und fragmentName sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    // Erstelle ShadowTwinService
    const service = await ShadowTwinService.create({
      library,
      userEmail,
      sourceId: body.sourceId,
      sourceName: body.sourceName || '',
      parentId: body.parentId || '',
    })

    // Debug: Lade alle Fragmente für Diagnose
    const allFragments = await service.getBinaryFragments()
    
    FileLogger.info('shadow-twins/resolve-binary-url', 'Debug: Fragmente geladen', {
      sourceId: body.sourceId,
      fragmentName: body.fragmentName,
      fragmentCount: allFragments?.length ?? 0,
      fragmentNames: allFragments?.map(f => f.name) ?? [],
      fragmentsWithUrl: allFragments?.filter(f => f.url).length ?? 0,
      fragmentsWithFileId: allFragments?.filter(f => f.fileId).length ?? 0,
    })

    // Löse Binary-Fragment-URL auf
    const resolvedUrl = await service.resolveBinaryFragmentUrl(body.fragmentName)

    if (resolvedUrl) {
      return NextResponse.json({ resolvedUrl, fragmentName: body.fragmentName }, { status: 200 })
    }

    // Storage-Fallback: Wenn MongoDB kein Fragment kennt, direkt im Shadow-Twin-Ordner suchen.
    // Typischer Fall: Dateien wurden manuell ins Storage kopiert, aber nie in MongoDB registriert.
    // Lade sourceName/parentId aus MongoDB, falls nicht im Request angegeben
    let effectiveSourceName = body.sourceName || ''
    let effectiveParentId = body.parentId || ''
    if (!effectiveSourceName || !effectiveParentId) {
      try {
        const docs = await getShadowTwinsBySourceIds({ libraryId, sourceIds: [body.sourceId] })
        const doc = docs.get(body.sourceId)
        if (doc) {
          effectiveSourceName = effectiveSourceName || doc.sourceName || ''
          effectiveParentId = effectiveParentId || doc.parentId || ''
        }
      } catch (lookupErr) {
        FileLogger.debug('shadow-twins/resolve-binary-url', 'MongoDB-Lookup für sourceName/parentId fehlgeschlagen', {
          error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
        })
      }
    }

    if (effectiveParentId && effectiveSourceName) {
      try {
        const provider = await getServerProvider(userEmail, libraryId)
        if (provider) {
          const shadowTwinFolder = await findShadowTwinFolder(effectiveParentId, effectiveSourceName, provider)
          if (shadowTwinFolder) {
            const folderItems = await provider.listItemsById(shadowTwinFolder.id)
            const binaryFile = folderItems.find(
              (item) => item.type === 'file' &&
                item.metadata.name.toLowerCase() === body.fragmentName.toLowerCase()
            )

            if (binaryFile) {
              const streamingUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(binaryFile.id)}`
              FileLogger.info('shadow-twins/resolve-binary-url', 'Fragment via Storage-Fallback gefunden', {
                fragmentName: body.fragmentName, sourceId: body.sourceId, fileId: binaryFile.id,
              })
              return NextResponse.json({ resolvedUrl: streamingUrl, fragmentName: body.fragmentName }, { status: 200 })
            }
          }

          // Zweiter Storage-Fallback: direkt im Quellverzeichnis suchen.
          // Wichtig für Galerie-Bilder, die als normale Sibling-Dateien vorliegen
          // und nicht als binaryFragment im Shadow-Twin registriert sind.
          const sourceSiblings = await provider.listItemsById(effectiveParentId)
          const siblingMatch = sourceSiblings.find(
            (item) =>
              item.type === 'file' &&
              item.metadata.name.toLowerCase() === body.fragmentName.toLowerCase()
          )
          if (siblingMatch) {
            const streamingUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(siblingMatch.id)}`
            FileLogger.info('shadow-twins/resolve-binary-url', 'Datei via Source-Verzeichnis-Fallback gefunden', {
              fragmentName: body.fragmentName, sourceId: body.sourceId, fileId: siblingMatch.id,
            })
            return NextResponse.json({ resolvedUrl: streamingUrl, fragmentName: body.fragmentName }, { status: 200 })
          }
        }
      } catch (storageErr) {
        FileLogger.warn('shadow-twins/resolve-binary-url', 'Storage-Fallback fehlgeschlagen', {
          fragmentName: body.fragmentName,
          error: storageErr instanceof Error ? storageErr.message : String(storageErr),
        })
      }
    }

    FileLogger.warn('shadow-twins/resolve-binary-url', 'Fragment nicht gefunden (inkl. Storage-Fallback)', {
      fragmentName: body.fragmentName,
      sourceId: body.sourceId,
      availableFragments: allFragments?.map(f => ({ name: f.name, originalName: f.originalName, hasUrl: !!f.url, hasFileId: !!f.fileId })) ?? [],
    })
    return NextResponse.json({ 
      error: 'Fragment nicht gefunden',
      fragmentName: body.fragmentName,
      sourceId: body.sourceId,
      availableFragments: allFragments?.map(f => f.name) ?? [],
    }, { status: 404 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/resolve-binary-url', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
