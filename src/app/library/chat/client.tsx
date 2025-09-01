'use client'

import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { ChatPanel } from '@/components/library/chat/chat-panel'

export default function ChatClient() {
  const libraryId = useAtomValue(activeLibraryIdAtom)
  if (!libraryId) return <div className="text-sm text-muted-foreground">Keine aktive Bibliothek.</div>
  return <ChatPanel libraryId={libraryId} />
}




