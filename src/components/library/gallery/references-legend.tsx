'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ChatReferenceList } from '@/components/library/chat/chat-reference-list'
import { X } from 'lucide-react'
import type { ChatResponse } from '@/types/chat-response'

export interface ReferencesLegendProps {
  references: ChatResponse['references']
  libraryId: string
  queryId?: string // Optional: Falls vorhanden, werden sources aus QueryLog geladen
  onClose: () => void
  onOpenDocument: (fileId: string) => void
  title: string
  description: string
}

export function ReferencesLegend({ references, libraryId, queryId, onClose, onOpenDocument, title, description }: ReferencesLegendProps) {
  if (!references || references.length === 0) return null
  return (
    <div className="flex-shrink-0 border-b bg-background px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <ChatReferenceList
        references={references}
        libraryId={libraryId}
        queryId={queryId}
        onDocumentClick={onOpenDocument}
      />
    </div>
  )
}


