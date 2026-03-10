/**
 * @fileoverview API-Route für Sammel-Transkript-Erstellung
 *
 * Nimmt mehrere Source-IDs entgegen, erzeugt ein leichtgewichtiges
 * Composite-Markdown mit Obsidian-Wiki-Links und speichert es
 * im selben Verzeichnis wie die Quelldateien.
 *
 * POST /api/library/[libraryId]/composite-transcript
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { LibraryService } from '@/lib/services/library-service'
import { getServerProvider } from '@/lib/storage/server-provider'
import { buildCompositeReference } from '@/lib/creation/composite-transcript'
import { FileLogger } from '@/lib/debug/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CompositeTranscriptRequest {
  /** Ausgewählte Quelldateien mit id, name und parentId */
  sourceItems: Array<{ id: string; name: string; parentId: string }>
  /** Zielsprache (Default: 'de') */
  targetLanguage?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // Authentifizierung
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 })
    }

    // Library validieren
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Request Body parsen
    const body: CompositeTranscriptRequest = await request.json()
    const { sourceItems, targetLanguage = 'de' } = body

    if (!sourceItems || sourceItems.length < 2) {
      return NextResponse.json(
        { error: 'Mindestens 2 Quelldateien erforderlich' },
        { status: 400 }
      )
    }

    // Composite-Reference erzeugen (leichtgewichtig, nur Wiki-Links)
    const result = await buildCompositeReference({
      libraryId,
      userEmail,
      targetLanguage,
      sourceItems,
    })

    // Wenn Transkripte fehlen: Warnung zurückgeben (nicht speichern)
    if (result.missingTranscripts.length > 0) {
      return NextResponse.json({
        success: false,
        missingTranscripts: result.missingTranscripts,
        message: `${result.missingTranscripts.length} Quelle(n) ohne Transkript. Bitte zuerst transkribieren.`,
      }, { status: 422 })
    }

    // Dateiname: deterministisch aus der Quellenanzahl und Sprache
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `sammel-transkript_${timestamp}_${targetLanguage}.md`

    // Im selben Verzeichnis wie die Quellen speichern
    const parentId = sourceItems[0].parentId
    const provider = await getServerProvider(userEmail, libraryId)

    const blob = new Blob([result.markdown], { type: 'text/markdown' })
    const file = new File([blob], fileName, { type: 'text/markdown' })
    const savedItem = await provider.uploadFile(parentId, file)

    FileLogger.info('composite-transcript/api', 'Sammel-Transkript gespeichert', {
      fileName,
      parentId,
      savedItemId: savedItem.id,
      sourceCount: sourceItems.length,
      mediaCount: result.mediaFiles.length,
    })

    return NextResponse.json({
      success: true,
      file: {
        id: savedItem.id,
        name: savedItem.metadata.name,
        parentId,
      },
      sourceFileNames: result.sourceFileNames,
      mediaCount: result.mediaFiles.length,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    FileLogger.error('composite-transcript/api', 'Fehler beim Erstellen', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
