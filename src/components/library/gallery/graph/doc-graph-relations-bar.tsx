'use client'

/**
 * DocGraphRelationsBar — Steuerleiste der Quelle A (berechnete Beziehungen).
 *
 * Zeigt einen Veraltungs-Hinweis (Staleness) und — nur für Owner/Co-Creator —
 * einen „Neu berechnen"-Button. Der Button stößt den `external-jobs`-Recompute
 * an (POST .../doc-relations/recompute, ganze Library) und öffnet das bestehende
 * Job-Monitor-Panel für den Fortschritt. Kein Silent Fallback: Fehler werden als
 * Toast gemeldet.
 */

import { useState } from 'react'
import { Button, Badge, toast } from '@ks/ui'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useGalleryHost } from '@/contexts/gallery-host-context'
import { useTranslation } from '@ks/i18n/react'

interface DocGraphRelationsBarProps {
  libraryId?: string
  /** Owner → „Neu berechnen"-Button sichtbar (bewusst nur Owner). */
  canManage?: boolean
  /** `true` = veraltet, `null` = noch nie berechnet. */
  stale: boolean | null
  computedAt: string | null
}

export function DocGraphRelationsBar({ libraryId, canManage, stale, computedAt }: DocGraphRelationsBarProps) {
  const { t } = useTranslation()
  const { jobGestartet } = useGalleryHost()
  const [busy, setBusy] = useState(false)

  const recompute = async () => {
    if (!libraryId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/doc-relations/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'library' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : res.statusText)
      toast({ title: t('gallery.graph.relationsRecomputeQueued') })
      jobGestartet()
    } catch (e) {
      toast({
        title: t('gallery.graph.relationsRecomputeError'),
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
        <span className="text-xs text-muted-foreground">{t('gallery.graph.relationsNeverComputed')}</span>
      )}
      {stale === true && (
        <Badge variant="outline" className="gap-1 text-amber-600">
          <AlertTriangle className="h-3 w-3" />
          {t('gallery.graph.relationsStale')}
        </Badge>
      )}
      {stale === false && computedAt && (
        <span className="text-xs text-muted-foreground">
          {t('gallery.graph.relationsComputedAt')}: {new Date(computedAt).toLocaleDateString()}
        </span>
      )}
      {canManage && (
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" disabled={busy} onClick={recompute}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy ? t('gallery.graph.relationsRecomputing') : t('gallery.graph.relationsRecompute')}
        </Button>
      )}
    </div>
  )
}
