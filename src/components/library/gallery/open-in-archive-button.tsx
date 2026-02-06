'use client'

import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface OpenInArchiveButtonProps {
  /** Dokument (fileId wird für die Archiv-Navigation verwendet) */
  doc: DocCardMeta
  /** Library-ID */
  libraryId: string
  /** Button-Variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Button-Größe */
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Button „Im Archiv öffnen“ – navigiert zur Library (Archiv) und öffnet die Quelldatei zur Bearbeitung.
 * Nur sinnvoll, wenn die Gallery-Daten aus derselben Library stammen (fileId = Storage-Item-ID).
 */
export function OpenInArchiveButton({
  doc,
  libraryId,
  variant = 'ghost',
  size = 'icon',
}: OpenInArchiveButtonProps) {
  const fileId = doc.fileId || doc.id
  if (!fileId) return null

  const href = `/library?activeLibraryId=${encodeURIComponent(libraryId)}&openFileId=${encodeURIComponent(fileId)}`

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className="h-8 w-8"
            asChild
          >
            <a
              href={href}
              aria-label="Im Archiv öffnen"
              onClick={(e) => e.stopPropagation()}
            >
              <FolderOpen className="h-4 w-4" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Im Archiv öffnen (zum Bearbeiten)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
