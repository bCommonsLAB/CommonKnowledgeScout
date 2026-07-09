'use client'

/**
 * DocGraphSimilarityBar — Steuerleiste der Quelle C (Aehnlichkeits-Nachbarn).
 *
 * Zeigt einen Veraltungs-Hinweis (Staleness, clientseitig aus den Docs
 * abgeleitet) und — nur fuer Owner — einen „Neu berechnen"-Button. Der Button
 * stoesst `POST doc-similarity/recompute` an (external-job, 1 Vector-Suche je
 * Doc) und oeffnet das Job-Monitor-Panel. Kein Silent Fallback: Fehler → Toast.
 * Spiegelt DocGraphRelationsBar (gleiches Muster, andere Route).
 */

import { useState } from 'react'
import { useSetAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { jobMonitorPanelOpenAtom } from '@/atoms/job-monitor-panel-open-atom'
import { toast } from '@/components/ui/use-toast'
import { useTranslation } from '@/lib/i18n/hooks'

interface DocGraphSimilarityBarProps {
  libraryId?: string
  /** Owner → „Neu berechnen"-Button sichtbar. */
  canManage?: boolean
  /** `true` = veraltet, `null` = noch nie berechnet. */
  stale: boolean | null
  computedAt: string | null
}

export function DocGraphSimilarityBar({ libraryId, canManage, stale, computedAt }: DocGraphSimilarityBarProps) {
  const { t } = useTranslation()
  const setJobPanelOpen = useSetAtom(jobMonitorPanelOpenAtom)
  const [busy, setBusy] = useState(false)

  const recompute = async () => {
    if (!libraryId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/doc-similarity/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : res.statusText)
      toast({ title: t('gallery.graph.similarityRecomputeQueued', { defaultValue: 'Nachbar-Berechnung gestartet' }) })
      setJobPanelOpen(true)
    } catch (e) {
      toast({
        title: t('gallery.graph.similarityRecomputeError', { defaultValue: 'Fehler beim Start der Berechnung' }),
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stale === null && (
        <span className="text-xs text-muted-foreground">
          {t('gallery.graph.similarityNeverComputed', { defaultValue: 'Nachbarn noch nicht berechnet' })}
        </span>
      )}
      {stale === true && (
        <Badge variant="outline" className="gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          {t('gallery.graph.similarityStale', { defaultValue: 'Veraltet – Katalog hat sich geändert' })}
        </Badge>
      )}
      {stale === false && computedAt && (
        <span className="text-xs text-muted-foreground">
          {t('gallery.graph.similarityComputedAt', { defaultValue: 'Berechnet' })}: {new Date(computedAt).toLocaleDateString()}
        </span>
      )}
      {canManage && (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={busy} onClick={recompute}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy
            ? t('gallery.graph.similarityRecomputing', { defaultValue: 'Berechne…' })
            : t('gallery.graph.similarityRecompute', { defaultValue: 'Nachbarn neu berechnen' })}
        </Button>
      )}
    </div>
  )
}
