import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getQueryLogById, deleteQueryLog } from '@/lib/db/queries-repo'

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

    const deleted = await deleteQueryLog(queryId, userEmail, sessionId)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}




