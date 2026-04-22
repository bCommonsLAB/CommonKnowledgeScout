'use client'

/**
 * @fileoverview Bulk-Publish-Button fuer den Galerie-Tabellen-Toolbar.
 *
 * @description
 * Publiziert alle aktuell gefilterten Dokumente in einem Rutsch und – falls
 * in `library.config.translations` konfiguriert – enqueued automatisch
 * Uebersetzungsjobs fuer die konfigurierten Ziel-Locales.
 *
 * Designentscheidungen:
 *  - Scope = aktuell gefilterte Dokumente (gleicher Filter wie Liste/Delete),
 *    damit der Nutzer ueber die Facetten/Suche vorauswaehlen kann, was
 *    publiziert wird. Kein zweites Auswahlmodell.
 *  - Status-Ziel ist fix `published`. Unpublish-Bulk gibt es (absichtlich)
 *    nicht – das waere wahrscheinlich ein versehentlicher Klick mit groesserem
 *    Schaden.
 *  - Bestaetigungs-Dialog mit Kosten-Hinweis (LLM-Credits), weil der Nutzer
 *    mehrere Uebersetzungsjobs gleichzeitig triggert.
 *  - Analog zu BulkDeleteButton: erst `/ids` fuer die Liste, dann
 *    `/publish-bulk` fuer die eigentliche Aktion.
 */

import React, { useState } from 'react'
import { Send } from 'lucide-react'
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
import { useTranslation } from '@/lib/i18n/hooks'

export interface BulkPublishButtonProps {
  /** Library-ID */
  libraryId: string
  /** Callback nach erfolgreicher Publikation (Listen-Refresh aufrufen). */
  onPublished?: () => void
  /** Gesamtanzahl aktuell gefilterter Dokumente (nur Anzeige). */
  totalCount?: number
  /** Aktuelle Filter (werden an /ids weitergereicht). */
  filters?: Record<string, string[] | undefined>
  /** Aktuelle Suchanfrage (wird an /ids weitergereicht). */
  searchQuery?: string
  /** Ob Uebersetzungen konfiguriert sind – steuert den Kostenhinweis im Dialog. */
  hasTranslationTargets?: boolean
}

export function BulkPublishButton({
  libraryId,
  onPublished,
  totalCount,
  filters,
  searchQuery = '',
  hasTranslationTargets = false,
}: BulkPublishButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [isPublishing, setIsPublishing] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Anzahl, die wir anzeigen – basiert auf totalCount (Server-Wahrheit), faellt
  // auf 0 zurueck falls unbekannt. Bei 0 rendern wir den Button gar nicht.
  const documentCount = totalCount ?? 0
  if (documentCount <= 0) return null

  const handleBulkPublish = async () => {
    setIsPublishing(true)

    try {
      // 1) fileIds fuer aktuell gefilterte Menge vom Server holen (keine
      //    Client-Liste vertrauen – Pagination koennte unvollstaendig sein).
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([key, values]) => {
          if (Array.isArray(values)) {
            values.forEach((value) => params.append(key, String(value)))
          }
        })
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const idsUrl = `/api/chat/${encodeURIComponent(libraryId)}/docs/ids${
        params.toString() ? `?${params.toString()}` : ''
      }`
      const idsResponse = await fetch(idsUrl)
      if (!idsResponse.ok) {
        throw new Error(t('gallery.publishAll.errors.loadIds'))
      }

      const idsData = await idsResponse.json()
      const allFileIds: string[] = Array.isArray(idsData.fileIds) ? idsData.fileIds : []
      if (allFileIds.length === 0) {
        throw new Error(t('gallery.publishAll.errors.noDocs'))
      }

      // 2) Bulk-Publish-Aufruf. Achtung: Server limitiert auf 500 pro Request.
      const response = await fetch(
        `/api/chat/${encodeURIComponent(libraryId)}/docs/publish-bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileIds: allFileIds, status: 'published' }),
        },
      )

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      const affected = Number(result.affected ?? 0)
      const jobs = Number(result.translationJobsEnqueued ?? 0)
      const errs = Array.isArray(result.errors) ? result.errors.length : 0

      if (errs > 0) {
        toast({
          title: t('gallery.publishAll.toast.partialTitle'),
          description: t('gallery.publishAll.toast.partialDesc', {
            affected,
            requested: allFileIds.length,
            jobs,
          }),
          variant: 'destructive',
        })
      } else {
        toast({
          title: t('gallery.publishAll.toast.successTitle'),
          description: t('gallery.publishAll.toast.successDesc', { affected, jobs }),
        })
      }

      setIsOpen(false)
      onPublished?.()
    } catch (error) {
      console.error('[BulkPublishButton] Fehler beim Publizieren:', error)
      toast({
        title: t('gallery.publishAll.toast.errorTitle'),
        description: error instanceof Error ? error.message : t('common.unknownError'),
        variant: 'destructive',
      })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="default" size="sm" disabled={isPublishing}>
          <Send className="h-4 w-4 mr-2" />
          {isPublishing
            ? t('gallery.publishAll.button.busy')
            : t('gallery.publishAll.button.label', { count: documentCount })}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('gallery.publishAll.dialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('gallery.publishAll.dialog.body', { count: documentCount })}
            {hasTranslationTargets && (
              <>
                <br />
                <br />
                <span className="text-xs text-muted-foreground">
                  {t('gallery.publishAll.dialog.costHint')}
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPublishing}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleBulkPublish} disabled={isPublishing}>
            {isPublishing
              ? t('gallery.publishAll.button.busy')
              : t('gallery.publishAll.dialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
