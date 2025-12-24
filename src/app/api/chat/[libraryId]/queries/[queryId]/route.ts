import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getQueryLogById, deleteQueryLog } from '@/lib/db/queries-repo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  const { libraryId, queryId } = await params
  try {
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
    // Aber wenn Library öffentlich ist und keine Session-ID vorhanden ist, gib 404 zurück (Query existiert nicht für diese Session)
    if (!userEmail && !sessionId) {
      // Wenn Library öffentlich ist, gib 404 zurück (Query kann ohne Session-ID nicht gefunden werden)
      if (ctx?.library.config?.publicPublishing?.isPublic) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }

    try {
      const log = await getQueryLogById({ libraryId, queryId, userEmail, sessionId })
      if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(log)
    } catch (queryError) {
      // Wenn getQueryLogById einen Fehler wirft (z.B. "Entweder userEmail oder sessionId muss angegeben werden"),
      // gib 404 zurück statt Fehler (für bessere UX)
      console.error('[api/chat/queries] getQueryLogById error', {
        error: queryError instanceof Error ? queryError.message : String(queryError),
        queryId,
        userEmail: userEmail || null,
        sessionId: sessionId || null,
        libraryId,
      })
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('[api/chat/queries] GET error', {
      error: error instanceof Error ? error.message : String(error),
      queryId,
    })
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; queryId: string }> }
) {
  const { libraryId, queryId } = await params
  try {
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
    // Aber wenn Library öffentlich ist und keine Session-ID vorhanden ist, gib 404 zurück (Query existiert nicht für diese Session)
    if (!userEmail && !sessionId) {
      // Wenn Library öffentlich ist, gib 404 zurück (Query kann ohne Session-ID nicht gefunden werden)
      if (ctx?.library.config?.publicPublishing?.isPublic) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }

    // Versuche mit userEmail/sessionId zu löschen
    const deleted = await deleteQueryLog(queryId, userEmail, sessionId)
    
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




