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

export interface BulkDeleteButtonProps {
  /** Gefilterte Dokumente, die gelöscht werden sollen */
  documents: DocCardMeta[]
  /** Library-ID */
  libraryId: string
  /** Callback nach erfolgreichem Löschen */
  onDeleted?: () => void
  /** Button-Variant (Standard: destructive) */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Button-Größe (Standard: default) */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Gesamtanzahl gefilterter Dokumente (wird für Anzeige verwendet, falls vorhanden) */
  totalCount?: number
  /** Aktuelle Filter (für API-Aufruf) */
  filters?: Record<string, string[] | undefined>
  /** Aktuelle Suchanfrage (für API-Aufruf) */
  searchQuery?: string
  /**
   * Optionale, vorab bekannte fileId-Liste fuer den Bulk-Loesch-Scope.
   *
   * Wenn gesetzt, ueberspringen wir den `/docs/ids`-Roundtrip und
   * loeschen exakt diese IDs. Wird verwendet, wenn der Scope durch einen
   * rein clientseitigen Filter (z.B. "Nur Favoriten") eingeschraenkt ist
   * und der Server diesen Filter nicht kennt.
   */
  explicitFileIds?: string[]
}

/**
 * Bulk-Delete-Button-Komponente für mehrere Dokumente
 * Zeigt Bestätigungsdialog und löscht alle gefilterten MongoDB-Dokumente
 */
export function BulkDeleteButton({
  documents,
  libraryId,
  onDeleted,
  variant = 'destructive',
  size = 'default',
  totalCount,
  filters,
  searchQuery = '',
  explicitFileIds,
}: BulkDeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const { toast } = useToast()

  // Anzeige-Anzahl: explicit > totalCount > geladene Docs.
  const documentCount = explicitFileIds
    ? explicitFileIds.length
    : totalCount !== undefined
      ? totalCount
      : documents.length

  // Sanity-Check fuer den Render-Pfad: brauchen mindestens eine fileId.
  const fileIds = explicitFileIds && explicitFileIds.length > 0
    ? explicitFileIds
    : documents
        .map(doc => doc.fileId || doc.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

  if (fileIds.length === 0 || documentCount === 0) {
    return null
  }

  const handleBulkDelete = async () => {
    setIsDeleting(true)

    try {
      let allFileIds: string[]

      if (explicitFileIds && explicitFileIds.length > 0) {
        // Client-seitiger Filter (z.B. "Nur Favoriten") – Server kennt
        // diesen Scope nicht, also nutzen wir die explizite Liste direkt.
        allFileIds = explicitFileIds
      } else {
        // Fallback: alle aktuell gefilterten Docs vom Server holen, damit
        // auch Pagination-fern liegende Treffer mit erfasst werden.
        const params = new URLSearchParams()
        if (filters) {
          Object.entries(filters).forEach(([key, values]) => {
            if (Array.isArray(values)) {
              values.forEach(value => params.append(key, String(value)))
            }
          })
        }
        if (searchQuery.trim()) {
          params.append('search', searchQuery.trim())
        }

        const idsUrl = `/api/chat/${encodeURIComponent(libraryId)}/docs/ids${params.toString() ? `?${params.toString()}` : ''}`
        const idsResponse = await fetch(idsUrl)

        if (!idsResponse.ok) {
          throw new Error('Fehler beim Laden der Dokument-IDs')
        }

        const idsData = await idsResponse.json()
        allFileIds = idsData.fileIds || []
      }

      if (allFileIds.length === 0) {
        throw new Error('Keine Dokumente zum Löschen gefunden')
      }

      // Lösche alle gefilterten Dokumente
      const response = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/docs/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds: allFileIds }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      // Zeige Erfolgsmeldung mit Details
      const deletedCount = result.deletedCount || 0
      const totalRequested = result.totalRequested || allFileIds.length
      const hasErrors = result.errors && result.errors.length > 0

      if (hasErrors) {
        toast({
          title: 'Teilweise erfolgreich',
          description: `${deletedCount} von ${totalRequested} Dokumenten wurden gelöscht. Einige Löschungen sind fehlgeschlagen.`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Dokumente gelöscht',
          description: `${deletedCount} Dokument${deletedCount === 1 ? '' : 'e'} wurden erfolgreich gelöscht.`,
        })
      }

      setIsOpen(false)
      onDeleted?.()
    } catch (error) {
      console.error('[BulkDeleteButton] Fehler beim Löschen:', error)
      toast({
        title: 'Fehler beim Löschen',
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={isDeleting}>
          <Trash2 className="h-4 w-4 mr-2" />
          {isDeleting ? 'Löschen...' : `${documentCount} löschen`}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mehrere Dokumente löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            Möchten Sie wirklich <strong>{documentCount} Dokument{documentCount === 1 ? '' : 'e'}</strong> löschen?
            <br />
            <br />
            <span className="text-xs text-muted-foreground">
              Hinweis: Es werden nur die Datenbank-Einträge gelöscht. Die ursprünglichen Dateien bleiben erhalten.
            </span>
            <br />
            <span className="text-xs font-semibold text-destructive">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Löschen...' : 'Alle löschen'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

