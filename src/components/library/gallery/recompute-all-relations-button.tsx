'use client'

/**
 * @fileoverview Beziehungen-Trigger fuer die GANZE Library (Tabellen-Kopf).
 *
 * @description
 * Owner/Co-Creator-Aktion im Kopf der Tabellenansicht: berechnet die
 * „Supports"-Kanten (Quelle A) fuer ALLE Maßnahmen der Library neu
 * (`scope: 'library'`). Pendant zum Per-Zeile-Button (`DocRelationsButton`,
 * `scope: 'source'`). Ruft `POST /api/library/[libraryId]/doc-relations/recompute`
 * und oeffnet das Job-Monitor-Panel. Kein Silent Fallback: Fehler als Toast.
 *
 * @module components/library/gallery
 */

import React, { useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { Waypoints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'
import { useTranslation } from '@/lib/i18n/hooks'

export interface RecomputeAllRelationsButtonProps {
  libraryId: string
  /** Callback nach erfolgreichem Anstoßen der Neuberechnung. */
  onChanged?: () => void
}

export function RecomputeAllRelationsButton({ libraryId, onChanged }: RecomputeAllRelationsButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)
  // Aktive Galerie-Filter mitgeben: so wird nur die gefilterte Gruppe analysiert
  // (bleibt unter der Pro-Maßnahme-Grenze, ermoeglicht „in Gruppen testen").
  const filters = useAtomValue(galleryFiltersAtom)
  const [isLoading, setIsLoading] = useState(false)

  async function recompute() {
    setIsLoading(true)
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => Array.isArray(v) && v.length > 0),
      )
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/doc-relations/recompute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'library', filters: activeFilters }),
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
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1"
      disabled={isLoading}
      onClick={recompute}
    >
      <Waypoints className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
      {t('gallery.graph.relationsRecomputeAll', { defaultValue: 'Beziehungen für alle berechnen' })}
    </Button>
  )
}
