import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { listChats, createChat } from '@/lib/db/chats-repo'

/**
 * GET /api/chat/[libraryId]/chats
 * Listet alle Chats für eine Bibliothek und einen Benutzer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : undefined
    
    const chats = await listChats(libraryId, userEmail, limit)
    return NextResponse.json({ items: chats })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] list chats error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      { error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/chat/[libraryId]/chats
 * Erstellt einen neuen Chat
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === 'string' && body.title.trim().length > 0
      ? body.title.trim()
      : 'Neuer Chat'
    
    const chatId = await createChat(libraryId, userEmail, title)
    return NextResponse.json({ chatId, title })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] create chat error', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    })
    const dev = process.env.NODE_ENV !== 'production'
    return NextResponse.json(
      { error: 'Interner Fehler', ...(dev ? { details: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}

