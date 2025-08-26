"use client"

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle } from 'lucide-react'
import { ChatPanel as LibraryChatPanel } from '@/components/library/chat/chat-panel'
import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'

export function ChatSidePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)

  return (
    <div className="pointer-events-none">
      {/* Handle */}
      <div className={cn(
        "fixed top-28 right-0 z-40 transition-transform",
        isOpen ? "translate-x-[calc(0px)]" : "translate-x-0"
      )}>
        <button
          onClick={() => setIsOpen(v => !v)}
          className={cn(
            "pointer-events-auto select-none",
            "bg-primary text-primary-foreground",
            "rounded-l-md shadow",
            "px-2 py-1",
            "hover:opacity-90 flex items-center gap-1"
          )}
          aria-label={isOpen ? 'Chat schließen' : 'Chat öffnen'}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Chat</span>
        </button>
      </div>

      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-screen z-30",
        "w-[380px] md:w-[420px]",
        "bg-background border-l",
        "shadow-lg",
        "transition-transform duration-300",
        isOpen ? "translate-x-0" : "translate-x-full",
        "pointer-events-auto"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>Chat</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)} aria-label="Schließen">×</Button>
          </div>
          <ScrollArea className="flex-1">
            {activeLibraryId ? (
              <div className="p-3">
                <LibraryChatPanel libraryId={activeLibraryId} />
              </div>
            ) : (
              <div className="p-3 text-sm text-muted-foreground">Bitte eine Bibliothek auswählen.</div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}


