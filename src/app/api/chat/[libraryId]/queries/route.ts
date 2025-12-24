import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { listRecentQueries } from '@/lib/db/queries-repo'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
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
    // Aber wenn Library öffentlich ist und keine Session-ID vorhanden ist, gib leere Liste zurück statt Fehler
    if (!userEmail && !sessionId) {
      // Wenn Library öffentlich ist, gib leere Liste zurück (keine Historie für anonyme Nutzer ohne Session)
      if (ctx?.library.config?.publicPublishing?.isPublic) {
        return NextResponse.json({ items: [] })
      }
      return NextResponse.json({ error: 'Session-ID erforderlich für anonyme Nutzer' }, { status: 400 })
    }
    
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 20
    const chatId = url.searchParams.get('chatId') // Optional: Filter nach chatId
    
    try {
      const items = await listRecentQueries({ libraryId, userEmail, sessionId, chatId: chatId || undefined, limit })
      return NextResponse.json({ items })
    } catch (queryError) {
      // Wenn listRecentQueries einen Fehler wirft (z.B. "Entweder userEmail oder sessionId muss angegeben werden"),
      // gib leere Liste zurück statt Fehler (für bessere UX)
      console.error('[api/chat] listRecentQueries error', {
        error: queryError instanceof Error ? queryError.message : String(queryError),
        userEmail: userEmail || null,
        sessionId: sessionId || null,
        libraryId,
      })
      return NextResponse.json({ items: [] })
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] list queries error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json({ error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}


