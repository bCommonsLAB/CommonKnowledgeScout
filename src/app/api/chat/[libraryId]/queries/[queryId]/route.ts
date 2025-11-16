import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getQueryLogById, deleteQueryLog } from '@/lib/db/queries-repo'
import { findLibraryOwnerEmail } from '@/lib/chat/loader'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  try {
    const { libraryId, queryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined
    
    // Prüfe, ob Library öffentlich ist
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    
    // Wenn nicht öffentlich und nicht authentifiziert: Fehler
    if (!ctx?.library.config?.publicPublishing?.isPublic && (!userId || !userEmail)) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    if (!userEmail && !sessionId) {
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }

    const log = await getQueryLogById({ libraryId, queryId, userEmail, sessionId })
    if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(log)
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  try {
    const { libraryId, queryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined
    
    // Prüfe, ob Library öffentlich ist
    const { loadLibraryChatContext } = await import('@/lib/chat/loader')
    const ctx = await loadLibraryChatContext(userEmail || '', libraryId)
    
    // Wenn nicht öffentlich und nicht authentifiziert: Fehler
    if (!ctx?.library.config?.publicPublishing?.isPublic && (!userId || !userEmail)) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    if (!userEmail && !sessionId) {
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }

    // Versuche zuerst mit userEmail/sessionId zu löschen
    let deleted = await deleteQueryLog(queryId, userEmail, sessionId)
    
    // Wenn nicht gelöscht und Library öffentlich ist: Prüfe ob Benutzer der Owner ist
    if (!deleted && ctx?.library.config?.publicPublishing?.isPublic && userEmail) {
      const ownerEmail = await findLibraryOwnerEmail(libraryId)
      if (ownerEmail === userEmail) {
        // Library-Owner kann alle Queries dieser Library löschen
        // Versuche erneut ohne userEmail/sessionId-Filter (nur queryId + libraryId)
        deleted = await deleteQueryLog(queryId, userEmail, undefined, libraryId)
      }
    }
    
    if (!deleted) {
      // Prüfe, ob die Query überhaupt existiert (für bessere Fehlermeldung)
      const existingQuery = await getQueryLogById({ libraryId, queryId, userEmail, sessionId })
      if (!existingQuery) {
        return NextResponse.json({ error: 'Query nicht gefunden' }, { status: 404 })
      }
      // Query existiert, aber gehört nicht zum aktuellen Benutzer/Session
      return NextResponse.json({ error: 'Zugriff verweigert' }, { status: 403 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[api/chat/queries] DELETE error:', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}




