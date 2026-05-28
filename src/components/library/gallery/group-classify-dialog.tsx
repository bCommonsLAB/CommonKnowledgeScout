'use client'

/**
 * @fileoverview Stoffgruppen-Klassifikations-Dialog (Stufe 4).
 *
 * @description
 * Triggert pro Stoffgruppe einen einzelnen LLM-Call (`POST /api/diva-texture/
 * group-classify` mit `dryRun: true`), zeigt den Vorschlag (Material-Klasse,
 * Typ, Konfidenz) sowie den Override-Schutz (Anzahl gelockter / verworfener
 * Mitglieder). Mit "Uebernehmen fuer N Mitglieder" ruft der Dialog dieselbe
 * Route ohne `dryRun` erneut auf und propagiert die Klassifikation auf alle
 * nicht gelockten/nicht verworfenen Mitglieder.
 *
 * Vereinfachung gegenueber Plan (User-Entscheid): keine eigene Persistenz,
 * keine `groupClassificationId`.
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

/** Klassifikations-Snapshot, der vom Server zurueckkommt. */
interface ClassificationResult {
  groupName: string
  representative: {
    fileId: string
    sourceFileName: string
    sourceImage: 'basecolor' | 'supplier-preview'
  }
  classification: {
    material_class: string
    material_type: string
    confidence_class: number
    confidence_type: number | ''
    needs_human_review: boolean
  }
  members: {
    total: number
    applied: string[]
    /** Mitglieder, deren material_class durch die Propagation gewechselt hat. */
    markedForRefresh: string[]
    skippedLocked: string[]
    skippedRejected: string[]
    /** Mitglieder ohne vorhandenes Artefakt fuer die Propagation. */
    skippedNoArtifact: string[]
  }
  dryRun: boolean
}

export interface GroupClassifyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  libraryId: string
  groupName: string
  /** Schwellwert fuer den Auto-Apply-Hint (`confidence_class >= threshold`). */
  autoApplyConfidenceThreshold: number
  /** Wird nach erfolgreichem Apply gefeuert, damit die Galerie neu laedt. */
  onApplied?: (result: ClassificationResult) => void
}

async function callGroupClassify(
  libraryId: string,
  groupName: string,
  dryRun: boolean,
): Promise<ClassificationResult> {
  const res = await fetch('/api/diva-texture/group-classify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId, groupName, dryRun }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(typeof error.error === 'string' ? error.error : `HTTP ${res.status}`)
  }
  return (await res.json()) as ClassificationResult
}

export function GroupClassifyDialog({
  open,
  onOpenChange,
  libraryId,
  groupName,
  autoApplyConfidenceThreshold,
  onApplied,
}: GroupClassifyDialogProps): React.ReactNode {
  const [preview, setPreview] = React.useState<ClassificationResult | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isApplying, setIsApplying] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Bei jedem Oeffnen einen frischen Dry-Run starten — vermeidet stale Daten,
  // wenn der User die Gruppe inzwischen veraendert hat.
  React.useEffect(() => {
    if (!open) {
      setPreview(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    callGroupClassify(libraryId, groupName, true)
      .then((result) => {
        if (!cancelled) setPreview(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, libraryId, groupName])

  const handleApply = async (): Promise<void> => {
    if (!preview) return
    setIsApplying(true)
    setError(null)
    try {
      const result = await callGroupClassify(libraryId, groupName, false)
      setPreview(result)
      toast({
        title: 'Stoffgruppen-Klassifikation uebernommen',
        description: `${result.members.applied.length} Mitglieder aktualisiert`,
      })
      onApplied?.(result)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast({
        title: 'Fehler bei der Stoffgruppen-Klassifikation',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsApplying(false)
    }
  }

  const applicable = preview
    ? preview.members.total -
      preview.members.skippedLocked.length -
      preview.members.skippedRejected.length
    : 0
  const confidence = preview?.classification.confidence_class ?? 0
  const meetsThreshold = confidence >= autoApplyConfidenceThreshold

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stoffgruppe propagieren: {groupName}</DialogTitle>
          <DialogDescription>
            Die Klassifikation eines bereits im Archiv analysierten
            Repraesentativen wird auf alle nicht gelockten und nicht
            verworfenen Mitglieder uebernommen. Es laeuft KEIN neuer LLM-Call
            — Pass 1 muss vorher pro Material via Archiv ausgefuehrt sein.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          {isLoading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Loader2 className='h-4 w-4 animate-spin' />
              Lade Klassifikation des Repraesentativen …
            </div>
          ) : error ? (
            <div className='rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
              {error}
            </div>
          ) : preview ? (
            <ul className='space-y-2 text-sm'>
              <li>
                <strong>Material-Klasse:</strong> {preview.classification.material_class || '—'}
                {preview.classification.material_type
                  ? ` / ${preview.classification.material_type}`
                  : ''}
              </li>
              <li>
                <strong>Konfidenz:</strong>{' '}
                {`${Math.round(preview.classification.confidence_class * 100)}%`}{' '}
                {meetsThreshold ? (
                  <span className='text-emerald-700 dark:text-emerald-400'>
                    ≥ Schwellwert ({Math.round(autoApplyConfidenceThreshold * 100)}%)
                  </span>
                ) : (
                  <span className='text-amber-700 dark:text-amber-400'>
                    &lt; Schwellwert ({Math.round(autoApplyConfidenceThreshold * 100)}%)
                  </span>
                )}
              </li>
              <li>
                <strong>Repraesentativ:</strong> {preview.representative.sourceFileName}{' '}
                <span className='text-muted-foreground'>
                  (Quellbild: {preview.representative.sourceImage})
                </span>
              </li>
              <li>
                <strong>Mitglieder:</strong> {applicable} von {preview.members.total} werden
                aktualisiert
                {preview.members.skippedLocked.length > 0
                  ? `, ${preview.members.skippedLocked.length} locked`
                  : ''}
                {preview.members.skippedRejected.length > 0
                  ? `, ${preview.members.skippedRejected.length} verworfen`
                  : ''}
                {preview.members.skippedNoArtifact.length > 0
                  ? `, ${preview.members.skippedNoArtifact.length} ohne Pass-1-Lauf (im Archiv ausfuehren)`
                  : ''}
              </li>
              {preview.classification.needs_human_review ? (
                <li className='text-amber-700 dark:text-amber-400'>
                  Diese Gruppe ist als <em>needs_human_review</em> markiert.
                </li>
              ) : null}
              {preview.members.markedForRefresh.length > 0 ? (
                <li className='text-sky-700 dark:text-sky-400'>
                  {preview.members.markedForRefresh.length} Mitglied
                  {preview.members.markedForRefresh.length === 1 ? '' : 'er'} wurden mit{' '}
                  <em>needs_visual_refresh</em> markiert — ein Korrektur-Lauf im Archiv ist
                  noetig, um die visuellen Properties zur neuen Klasse passend zu bestimmen.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isApplying}>
            Abbrechen
          </Button>
          <Button
            onClick={handleApply}
            disabled={!preview || isApplying || applicable === 0}
          >
            {isApplying ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Uebernehme …
              </>
            ) : (
              `Uebernehmen fuer ${applicable} Mitglieder`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
