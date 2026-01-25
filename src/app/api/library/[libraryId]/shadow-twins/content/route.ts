/**
 * @fileoverview Shadow-Twin Content API (Mongo)
 *
 * @description
 * Liefert und aktualisiert Shadow-Twin-Markdown aus MongoDB.
 * Wird verwendet, wenn Shadow-Twins nicht im Filesystem liegen.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { getShadowTwinArtifact, toArtifactKey, updateShadowTwinArtifactMarkdown } from '@/lib/repositories/shadow-twin-repo'
import { FileLogger } from '@/lib/debug/logger'

function getQueryParam(searchParams: URLSearchParams, key: string): string | null {
  const value = searchParams.get(key)
  return value && value.trim().length > 0 ? value : null
}

export async function GET(
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
    const { searchParams } = new URL(request.url)
    const sourceId = getQueryParam(searchParams, 'sourceId')
    const kind = getQueryParam(searchParams, 'kind')
    const targetLanguage = getQueryParam(searchParams, 'targetLanguage') || 'de'
    const templateName = getQueryParam(searchParams, 'templateName') || undefined

    if (!sourceId || !kind) {
      return NextResponse.json({ error: 'sourceId und kind sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    const record = await getShadowTwinArtifact({
      libraryId,
      sourceId,
      artifactKey: toArtifactKey({
        sourceId,
        kind: kind as 'transcript' | 'transformation',
        targetLanguage,
        templateName,
      }),
    })

    if (!record) {
      return NextResponse.json({ error: 'Artefakt nicht gefunden' }, { status: 404 })
    }

    return NextResponse.json({ markdown: record.markdown }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/content', 'GET fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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
    const body = await request.json() as {
      sourceId?: string
      kind?: 'transcript' | 'transformation'
      targetLanguage?: string
      templateName?: string
      markdown?: string
    }

    if (!body?.sourceId || !body?.kind || typeof body?.markdown !== 'string') {
      return NextResponse.json({ error: 'sourceId, kind und markdown sind erforderlich' }, { status: 400 })
    }

    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const shadowTwinConfig = getShadowTwinConfig(library)
    if (shadowTwinConfig.primaryStore !== 'mongo') {
      return NextResponse.json({ error: 'Mongo ist nicht aktiv' }, { status: 400 })
    }

    await updateShadowTwinArtifactMarkdown({
      libraryId,
      sourceId: body.sourceId,
      artifactKey: toArtifactKey({
        sourceId: body.sourceId,
        kind: body.kind,
        targetLanguage: body.targetLanguage || 'de',
        templateName: body.templateName,
      }),
      markdown: body.markdown,
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('shadow-twins/content', 'POST fehlgeschlagen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
