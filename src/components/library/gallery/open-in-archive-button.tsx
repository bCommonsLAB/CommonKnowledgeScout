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
import { tryDecodeRelativePathFromFileId } from '@/utils/decode-storage-file-id'

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
  const indexFileName = doc.fileName?.trim()
  // Bevorzugt: beim Ingest gespeicherte Herkunft (ohne Base64-Dekodierung im Client).
  const ingestPath = doc.sourcePath?.trim()
  const ingestFile = doc.sourceFileName?.trim()
  const hasIngestLoc = Boolean(ingestPath || ingestFile)
  const storagePathDecoded = !hasIngestLoc ? tryDecodeRelativePathFromFileId(fileId) : undefined

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
        <TooltipContent className="max-w-sm">
          <div className="space-y-1 text-xs">
            <p className="font-medium">Im Archiv öffnen</p>
            {hasIngestLoc ? (
              <>
                {ingestPath ? (
                  <p>
                    <span className="text-muted-foreground">Ordner:</span>{' '}
                    <span className="break-all">{ingestPath}</span>
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">Quelldatei:</span>{' '}
                  <span className="break-all">{ingestFile || indexFileName || '—'}</span>
                </p>
              </>
            ) : storagePathDecoded ? (
              <p>
                <span className="text-muted-foreground">Speicherpfad:</span>{' '}
                <span className="break-all">{storagePathDecoded}</span>
              </p>
            ) : (
              <p className="text-muted-foreground break-all">
                ID (nicht als Pfad dekodierbar): {fileId.length > 120 ? `${fileId.slice(0, 120)}…` : fileId}
              </p>
            )}
            {!hasIngestLoc && indexFileName ? (
              <p>
                <span className="text-muted-foreground">Dateiname (Index):</span>{' '}
                <span className="break-all">{indexFileName}</span>
              </p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
