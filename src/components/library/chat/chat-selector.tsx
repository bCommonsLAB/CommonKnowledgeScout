'use client'

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import type { Chat } from '@/types/chat'

interface ChatSelectorProps {
  libraryId: string
  activeChatId: string | null
  onChatChange: (chatId: string | null) => void
  onCreateNewChat: () => void
}

/**
 * ChatSelector-Komponente für die Auswahl zwischen verschiedenen Chats
 * 
 * Zeigt eine Dropdown-Liste aller Chats und ermöglicht die Erstellung neuer Chats.
 */
export function ChatSelector({ libraryId, activeChatId, onChatChange, onCreateNewChat }: ChatSelectorProps) {
  const [chats, setChats] = useState<Chat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lade Chats beim Initialisieren oder wenn sich libraryId ändert
  useEffect(() => {
    let cancelled = false
    async function loadChats() {
      setLoading(true)
      setError(null)
      try {
        // Session-ID für anonyme Nutzer
        const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
        const sessionId = getOrCreateSessionId()
        const headers: Record<string, string> = {}
        if (!sessionId.startsWith('temp-')) {
          headers['X-Session-ID'] = sessionId
        }
        
        const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/chats`, { 
          cache: 'no-store',
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        })
        if (!res.ok) throw new Error('Fehler beim Laden der Chats')
        const data = await res.json() as { items?: Chat[] }
        if (!cancelled && Array.isArray(data.items)) {
          setChats(data.items)
          // Wenn kein aktiver Chat vorhanden und Chats existieren, wähle den neuesten
          if (!activeChatId && data.items.length > 0) {
            onChatChange(data.items[0].chatId)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Fehler beim Laden der Chats')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    loadChats()
    return () => { cancelled = true }
  }, [libraryId, activeChatId, onChatChange])

  // Aktualisiere Chats nach Erstellung eines neuen Chats
  const handleCreateNewChat = async () => {
    try {
      // Session-ID für anonyme Nutzer
      const { getOrCreateSessionId } = await import('@/lib/session/session-utils')
      const sessionId = getOrCreateSessionId()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (!sessionId.startsWith('temp-')) {
        headers['X-Session-ID'] = sessionId
      }
      
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Neuer Chat' }),
      })
      if (!res.ok) throw new Error('Fehler beim Erstellen des Chats')
      const data = await res.json() as { chatId: string }
      // Lade Chats neu
      const chatsRes = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/chats`, { 
        cache: 'no-store',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      })
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json() as { items?: Chat[] }
        if (Array.isArray(chatsData.items)) {
          setChats(chatsData.items)
          onChatChange(data.chatId)
          onCreateNewChat()
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Erstellen des Chats')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Lade Chats...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <Select
        value={activeChatId || ''}
        onValueChange={(value) => {
          // "new" wird nicht als Wert verwendet, sondern nur für UI
          if (value !== 'new' && value !== 'empty') {
            onChatChange(value)
          }
        }}
      >
        <SelectTrigger className="flex-1 w-full">
          <SelectValue placeholder="Chat auswählen" />
        </SelectTrigger>
        <SelectContent>
          {chats.length === 0 && (
            <SelectItem value="empty" disabled>
              Keine Chats vorhanden
            </SelectItem>
          )}
          {chats.map((chat) => (
            <SelectItem key={chat.chatId} value={chat.chatId}>
              <span className="font-medium">
                {chat.title} ({new Date(chat.updatedAt).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCreateNewChat}
        className="h-10 flex-shrink-0"
      >
        <Plus className="h-4 w-4 mr-2" />
        Neu
      </Button>
    </div>
  )
}

