import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getChatById, updateChatTitle, deleteChat } from '@/lib/db/chats-repo'

/**
 * GET /api/chat/[libraryId]/chats/[chatId]
 * Lädt Chat-Details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; chatId: string }> }
) {
  try {
    const { chatId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const chat = await getChatById(chatId, userEmail)
    if (!chat) {
      return NextResponse.json({ error: 'Chat nicht gefunden' }, { status: 404 })
    }
    
    return NextResponse.json(chat)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] get chat error', {
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
 * PATCH /api/chat/[libraryId]/chats/[chatId]
 * Aktualisiert Chat (z.B. Titel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; chatId: string }> }
) {
  try {
    const { chatId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const body = await request.json().catch(() => ({}))
    
    // Prüfe, ob Chat existiert und Benutzer Zugriff hat
    const chat = await getChatById(chatId, userEmail)
    if (!chat) {
      return NextResponse.json({ error: 'Chat nicht gefunden' }, { status: 404 })
    }
    
    // Aktualisiere Titel, falls vorhanden
    if (typeof body.title === 'string' && body.title.trim().length > 0) {
      await updateChatTitle(chatId, body.title.trim())
    }
    
    // Lade aktualisierten Chat
    const updatedChat = await getChatById(chatId, userEmail)
    return NextResponse.json(updatedChat)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] update chat error', {
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
 * DELETE /api/chat/[libraryId]/chats/[chatId]
 * Löscht einen Chat
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; chatId: string }> }
) {
  try {
    const { chatId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    
    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const deleted = await deleteChat(chatId, userEmail)
    if (!deleted) {
      return NextResponse.json({ error: 'Chat nicht gefunden' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[api/chat] delete chat error', {
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

