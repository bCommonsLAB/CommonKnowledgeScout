import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getChatById, updateChatTitle, deleteChat, createChat } from '@/lib/db/chats-repo'

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
    
    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined
    
    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    const userEmailOrSessionId = userEmail || sessionId
    if (!userEmailOrSessionId) {
      console.error('[api/chat/chats] Chat-ID vorhanden, aber weder userEmail noch sessionId:', {
        chatId,
        hasUserEmail: !!userEmail,
        hasSessionId: !!sessionId,
        userId: userId || null,
      })
      return NextResponse.json({ error: 'Nicht authentifiziert oder Session-ID erforderlich' }, { status: 401 })
    }
    
    // Wenn nicht authentifiziert und keine Session-ID: Fehler
    if (!userId && !sessionId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const chat = await getChatById(chatId, userEmailOrSessionId)
    if (!chat) {
      console.warn('[api/chat/chats] Chat nicht gefunden - erstelle neuen Chat:', {
        chatId,
        userEmail: userEmail || null,
        sessionId: sessionId || null,
        userEmailOrSessionId,
        isEmail: userEmailOrSessionId.includes('@'),
      })
      // Erstelle neuen Chat statt Fehler
      const { libraryId } = await params
      const newChatId = await createChat(libraryId, userEmailOrSessionId, 'Neuer Chat')
      const newChat = await getChatById(newChatId, userEmailOrSessionId)
      return NextResponse.json(newChat)
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
    
    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined
    
    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    const userEmailOrSessionId = userEmail || sessionId
    if (!userEmailOrSessionId) {
      console.error('[api/chat/chats] PATCH: Chat-ID vorhanden, aber weder userEmail noch sessionId:', {
        chatId,
        hasUserEmail: !!userEmail,
        hasSessionId: !!sessionId,
        userId: userId || null,
      })
      return NextResponse.json({ error: 'Nicht authentifiziert oder Session-ID erforderlich' }, { status: 401 })
    }
    
    // Wenn nicht authentifiziert und keine Session-ID: Fehler
    if (!userId && !sessionId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const body = await request.json().catch(() => ({}))
    
    // Prüfe, ob Chat existiert und Benutzer Zugriff hat
    let activeChatId = chatId
    const chat = await getChatById(chatId, userEmailOrSessionId)
    if (!chat) {
      console.warn('[api/chat/chats] PATCH: Chat nicht gefunden - erstelle neuen Chat:', {
        chatId,
        userEmail: userEmail || null,
        sessionId: sessionId || null,
        userEmailOrSessionId,
        isEmail: userEmailOrSessionId.includes('@'),
      })
      // Erstelle neuen Chat statt Fehler
      const { libraryId } = await params
      const title = typeof body.title === 'string' && body.title.trim().length > 0
        ? body.title.trim()
        : 'Neuer Chat'
      activeChatId = await createChat(libraryId, userEmailOrSessionId, title)
    } else {
      // Aktualisiere Titel, falls vorhanden
      if (typeof body.title === 'string' && body.title.trim().length > 0) {
        await updateChatTitle(chatId, body.title.trim())
      }
    }
    
    // Lade aktualisierten Chat
    const updatedChat = await getChatById(activeChatId, userEmailOrSessionId)
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
    
    // Session-ID aus Header lesen (für anonyme Nutzer)
    const sessionIdHeader = request.headers.get('x-session-id') || request.headers.get('X-Session-ID')
    const sessionId = sessionIdHeader || undefined
    
    // Für anonyme Nutzer: Session-ID muss vorhanden sein
    const userEmailOrSessionId = userEmail || sessionId
    if (!userEmailOrSessionId) {
      console.error('[api/chat/chats] DELETE: Chat-ID vorhanden, aber weder userEmail noch sessionId:', {
        chatId,
        hasUserEmail: !!userEmail,
        hasSessionId: !!sessionId,
        userId: userId || null,
      })
      return NextResponse.json({ error: 'Nicht authentifiziert oder Session-ID erforderlich' }, { status: 401 })
    }
    
    // Wenn nicht authentifiziert und keine Session-ID: Fehler
    if (!userId && !sessionId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }
    
    const deleted = await deleteChat(chatId, userEmailOrSessionId)
    if (!deleted) {
      // Chat nicht gefunden - das ist OK bei DELETE (idempotent)
      console.warn('[api/chat/chats] DELETE: Chat nicht gefunden (idempotent):', {
        chatId,
        userEmail: userEmail || null,
        sessionId: sessionId || null,
        userEmailOrSessionId,
        isEmail: userEmailOrSessionId.includes('@'),
      })
      // Gebe success zurück, auch wenn Chat nicht existiert (idempotent)
      return NextResponse.json({ success: true })
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

