/**
 * @fileoverview Shadow-Twin Upsert API (Mongo)
 *
 * @description
 * Persistiert Shadow-Twin-Markdown in MongoDB und gibt ein virtuelles StorageItem zurueck.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getServerProvider } from '@/lib/storage/server-provider'
import { persistShadowTwinToMongo } from '@/lib/shadow-twin/shadow-twin-mongo-writer'
import { buildMongoShadowTwinItem } from '@/lib/shadow-twin/mongo-shadow-twin-item'
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
    const body = await request.json() as {
      sourceId?: string
      artifactKey?: { kind?: 'transcript' | 'transformation'; targetLanguage?: string; templateName?: string }
      markdown?: string
      shadowTwinFolderId?: string
    }

    if (!body?.sourceId || !body?.artifactKey?.kind || !body?.artifactKey?.targetLanguage || typeof body?.markdown !== 'string') {
      return NextResponse.json({ error: 'sourceId, artifactKey und markdown sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    const provider = await getServerProvider(userEmail, libraryId)
    const sourceItem = await provider.getItemById(body.sourceId)

    const artifactKey = {
      sourceId: body.sourceId,
      kind: body.artifactKey.kind,
      targetLanguage: body.artifactKey.targetLanguage,
      templateName: body.artifactKey.templateName,
    }

    const result = await persistShadowTwinToMongo({
      libraryId,
      userEmail,
      sourceItem,
      provider,
      artifactKey,
      markdown: body.markdown,
      shadowTwinFolderId: body.shadowTwinFolderId,
    })

    const virtualItem = buildMongoShadowTwinItem({
      libraryId,
      sourceId: sourceItem.id,
      sourceName: sourceItem.metadata.name,
      parentId: sourceItem.parentId,
      kind: artifactKey.kind,
      targetLanguage: artifactKey.targetLanguage,
      templateName: artifactKey.templateName,
      markdownLength: result.markdown.length,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json(
      {
        ok: true,
        markdown: result.markdown,
        item: virtualItem,
        imageCount: result.imageCount,
        imageErrorsCount: result.imageErrorsCount,
      },
      { status: 200 }
    )
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/upsert', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
