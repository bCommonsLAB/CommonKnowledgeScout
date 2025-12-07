import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { deleteVectorsByFileId, getCollectionNameForLibrary } from '@/lib/repositories/vector-repo'
import { isModeratorOrOwner } from '@/lib/repositories/library-members-repo'

/**
 * DELETE /api/chat/[libraryId]/docs/delete
 * Löscht MongoDB-Dokumente (Vektoren) für eine oder mehrere fileIds
 * 
 * Unterstützt:
 * - Einzel-Löschung: fileId als Query-Parameter
 * - Bulk-Löschung: Array von fileIds im Request-Body
 * 
 * WICHTIG: Löscht NUR MongoDB-Dokumente, NICHT die Dateien im Storage
 * Löscht alle Dokumente mit der angegebenen fileId (kind: 'meta', 'chunk', 'chapterSummary')
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params

    // Authentifizierung prüfen
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const user = await currentUser()
    if (!user?.emailAddresses?.[0]?.emailAddress) {
      return NextResponse.json({ error: 'Keine E-Mail-Adresse gefunden' }, { status: 401 })
    }
    const userEmail = user.emailAddresses[0].emailAddress

    // Library-Kontext laden
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    // Owner-Berechtigung prüfen
    const hasPermission = await isModeratorOrOwner(libraryId, userEmail)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Keine Berechtigung zum Löschen' }, { status: 403 })
    }

    // Ermittle fileIds: Entweder aus Query-Parameter oder Request-Body
    const searchParams = request.nextUrl.searchParams
    const fileIdParam = searchParams.get('fileId')

    let fileIds: string[] = []

    if (fileIdParam) {
      // Einzel-Löschung: fileId aus Query-Parameter
      fileIds = [fileIdParam]
    } else {
      // Bulk-Löschung: fileIds aus Request-Body
      try {
        const body = await request.json() as { fileIds?: unknown[]; fileId?: unknown }
        if (Array.isArray(body.fileIds)) {
          fileIds = body.fileIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
        } else if (typeof body.fileId === 'string') {
          fileIds = [body.fileId]
        } else {
          return NextResponse.json({ error: 'fileId oder fileIds erforderlich' }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 })
      }
    }

    if (fileIds.length === 0) {
      return NextResponse.json({ error: 'Keine gültigen fileIds angegeben' }, { status: 400 })
    }

    // Collection-Name ermitteln
    const libraryKey = getCollectionNameForLibrary(ctx.library)

    // Lösche alle Vektoren für jede fileId
    let deletedCount = 0
    const errors: Array<{ fileId: string; error: string }> = []

    for (const fileId of fileIds) {
      try {
        await deleteVectorsByFileId(libraryKey, fileId)
        deletedCount++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
        errors.push({ fileId, error: errorMessage })
        console.error(`[API] Fehler beim Löschen von fileId ${fileId}:`, errorMessage)
      }
    }

    // Wenn alle Löschungen fehlgeschlagen sind, Fehler zurückgeben
    if (deletedCount === 0 && errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Alle Löschungen fehlgeschlagen',
          errors 
        },
        { status: 500 }
      )
    }

    // Erfolgreiche Antwort mit Anzahl gelöschter Dokumente
    return NextResponse.json({
      success: true,
      deletedCount,
      totalRequested: fileIds.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[API] Fehler beim Löschen der Dokumente:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

