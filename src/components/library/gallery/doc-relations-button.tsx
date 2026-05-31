/**
 * @fileoverview Beziehungen-Trigger fuer einzelne Dokumente (Galerie-Tabelle).
 *
 * @description
 * Owner/Co-Creator-Aktion in der Tabellenansicht, platziert neben dem
 * Publish-/Re-Translate-Button: berechnet die AUSGEHENDEN „Supports"-Kanten
 * GENAU dieser Maßnahme neu (Quelle A, `scope: 'source'`). Ruft
 * `POST /api/library/[libraryId]/doc-relations/recompute` und öffnet das
 * bestehende Job-Monitor-Panel, damit der Lauf gezielt beobachtet werden kann.
 *
 * Bewusst minimal — pro Zeile EIN LLM-Aufruf (kleine, prüfbare Ausgabe), ideal
 * zum Testen der Prompt-Qualität an einer echten Klimamaßnahme.
 *
 * @module components/library/gallery
 */

'use client'

import React, { useState } from 'react'
import { useSetAtom } from 'jotai'
import { Waypoints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import { useTranslation } from '@/lib/i18n/hooks'
import type { DocCardMeta } from '@/lib/gallery/types'

export interface DocRelationsButtonProps {
  doc: DocCardMeta
  libraryId: string
  /** Callback nach erfolgreichem Anstoßen der Neuberechnung. */
  onChanged?: () => void
}

export function DocRelationsButton({ doc, libraryId, onChanged }: DocRelationsButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)
  const [isLoading, setIsLoading] = useState(false)

  const fileId = doc.fileId || doc.id
  if (!fileId) return null

  async function recompute() {
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/doc-relations/recompute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope: 'source',
            sourceFileId: fileId,
            sourceName: doc.title || doc.shortTitle || doc.fileName,
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      toast({ title: t('gallery.graph.relationsRecomputeQueued') })
      setJobPanelOpen(true)
      onChanged?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      toast({
        title: t('gallery.graph.relationsRecomputeError'),
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant='ghost'
      size='icon'
      title={t('gallery.graph.relationsRecomputeRow', {
        defaultValue: 'Beziehungen für diese Maßnahme berechnen',
      })}
      disabled={isLoading}
      onClick={(e) => {
        e.stopPropagation()
        void recompute()
      }}
    >
      <Waypoints className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
    </Button>
  )
}
