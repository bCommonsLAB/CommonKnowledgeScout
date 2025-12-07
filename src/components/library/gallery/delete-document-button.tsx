'use client'

import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface DeleteDocumentButtonProps {
  /** Dokument, das gelöscht werden soll */
  doc: DocCardMeta
  /** Library-ID */
  libraryId: string
  /** Callback nach erfolgreichem Löschen */
  onDeleted?: () => void
  /** Button-Variant (Standard: ghost) */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Button-Größe (Standard: icon) */
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * Delete-Button-Komponente für einzelne Dokumente
 * Zeigt Bestätigungsdialog und löscht MongoDB-Dokumente (nicht Storage-Dateien)
 */
export function DeleteDocumentButton({
  doc,
  libraryId,
  onDeleted,
  variant = 'ghost',
  size = 'icon',
}: DeleteDocumentButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  // Stelle sicher, dass fileId vorhanden ist
  const fileId = doc.fileId || doc.id
  if (!fileId) {
    console.warn('[DeleteDocumentButton] Keine fileId gefunden für Dokument:', doc)
    return null
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(
        `/api/chat/${encodeURIComponent(libraryId)}/docs/delete?fileId=${encodeURIComponent(fileId)}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      await response.json()

      toast({
        title: 'Dokument gelöscht',
        description: `"${doc.shortTitle || doc.title || doc.fileName || 'Dokument'}" wurde erfolgreich gelöscht.`,
      })

      setIsOpen(false)
      onDeleted?.()
    } catch (error) {
      console.error('[DeleteDocumentButton] Fehler beim Löschen:', error)
      toast({
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const documentTitle = doc.shortTitle || doc.title || doc.fileName || 'Dokument'

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            // Stoppe Event-Propagation, damit Row-Click nicht ausgelöst wird
            e.stopPropagation()
          }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Dokument löschen</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dokument löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie das Dokument <strong>&quot;{documentTitle}&quot;</strong> wirklich löschen?
            <br />
            <br />
            <span className="text-xs text-muted-foreground">
              Hinweis: Es werden nur die Datenbank-Einträge gelöscht. Die ursprünglichen Dateien bleiben erhalten.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Löschen...' : 'Löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

