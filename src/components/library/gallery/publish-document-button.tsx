/**
 * @fileoverview Publish-/Re-Translate-Button fuer einzelne Dokumente
 *
 * @description
 * Owner-Aktion in der Tabellenansicht: setzt `publication.status` und
 * stoesst (optional) die Translation-Pipeline an. Ruft die neue
 * `POST /api/chat/[libraryId]/docs/publish`-Route auf.
 *
 * @module components/library/gallery
 */

'use client'

import React, { useState } from 'react'
import { Globe2, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface PublishDocumentButtonProps {
  doc: DocCardMeta
  libraryId: string
  /** Callback nach erfolgreichem Publish/Unpublish/Re-translate */
  onChanged?: () => void
}

/**
 * Drei-Aktionen-Toggle: Publish, Unpublish, Re-translate.
 *
 * - Wenn `publicationStatus !== 'published'`: zeigt "Publish".
 * - Wenn `publicationStatus === 'published'`: zeigt "Re-translate" + "Unpublish".
 *
 * Die Komponente ist bewusst minimal gehalten – Status-Chips/Locales rendert
 * die uebergeordnete Tabelle, weil dort bereits alle Daten verfuegbar sind.
 */
export function PublishDocumentButton({ doc, libraryId, onChanged }: PublishDocumentButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const fileId = doc.fileId || doc.id
  if (!fileId) return null
  const isPublished = doc.publicationStatus === 'published'

  async function call(status: 'published' | 'draft', force = false) {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/chat/${encodeURIComponent(libraryId)}/docs/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId, status, force }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      toast({
        title:
          status === 'published'
            ? t('gallery.publish.successPublished', { defaultValue: 'Dokument veröffentlicht' })
            : t('gallery.publish.successUnpublished', { defaultValue: 'Veröffentlichung zurückgenommen' }),
        description: data?.targetLocales?.length
          ? t('gallery.publish.translationsQueued', {
              count: data.targetLocales.length,
              defaultValue: '{{count}} Übersetzungs-Job(s) angelegt',
            })
          : undefined,
      })
      onChanged?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast({
        title: t('gallery.publish.error', { defaultValue: 'Publish fehlgeschlagen' }),
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isPublished) {
    return (
      <Button
        variant='ghost'
        size='icon'
        title={t('gallery.publish.publish', { defaultValue: 'Veröffentlichen' })}
        disabled={isLoading}
        onClick={(e) => {
          e.stopPropagation()
          void call('published')
        }}
      >
        <Send className='h-4 w-4' />
      </Button>
    )
  }
  return (
    <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
      <Button
        variant='ghost'
        size='icon'
        title={t('gallery.publish.retranslate', { defaultValue: 'Übersetzungen neu erzeugen' })}
        disabled={isLoading}
        onClick={() => void call('published', true)}
      >
        <RefreshCw className='h-4 w-4' />
      </Button>
      <Button
        variant='ghost'
        size='icon'
        title={t('gallery.publish.unpublish', { defaultValue: 'Veröffentlichung zurücknehmen' })}
        disabled={isLoading}
        onClick={() => void call('draft')}
      >
        <Globe2 className='h-4 w-4 opacity-60' />
      </Button>
    </div>
  )
}
