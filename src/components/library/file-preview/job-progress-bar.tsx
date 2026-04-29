'use client';

/**
 * file-preview/job-progress-bar.tsx
 *
 * Progress-Bar fuer laufende Jobs in der File-Preview. Aus
 * `file-preview.tsx` extrahiert (Welle 3-II-a).
 *
 * Vertrag: rein, ohne Storage-Touch — siehe
 * `welle-3-archiv-detail-contracts.mdc` §1.
 */

import * as React from 'react'
import { Progress } from '@/components/ui/progress'

export interface JobProgressBarProps {
  status: 'queued' | 'running' | 'completed' | 'failed'
  progress?: number
  message?: string
  phase?: string
}

/**
 * Mapping von Phase-Codes (vom Secretary-Service) zu lesbaren Labels.
 * Generische Status-Phasen werden bewusst auf '' gemappt, damit der
 * Status-Label-Text "Wird verarbeitet..." stehen bleibt.
 */
export function getPhaseLabel(phase?: string): string {
  if (!phase) return ''
  const normalized = phase.toLowerCase()

  // Ignoriere generische Status-Phasen.
  const ignoredPhases = ['running', 'initializing', 'postprocessing', 'completed', 'progress']
  if (ignoredPhases.includes(normalized)) return ''

  const phaseLabels: Record<string, string> = {
    extract: 'Transkript',
    extract_pdf: 'Transkript',
    extract_office: 'Transkript',
    extraction: 'Transkript',
    transcribe: 'Transkript',
    transcription: 'Transkript',
    transform: 'Transformation',
    transform_template: 'Transformation',
    transformation: 'Transformation',
    template: 'Transformation',
    metadata: 'Transformation',
    ingest: 'Story',
    ingest_rag: 'Story',
    ingestion: 'Story',
    publish: 'Story',
  }
  return phaseLabels[normalized] || ''
}

/**
 * Bereinigt technische Detail-Messages (z.B. "Mistral-OCR: foo - Args: ..."),
 * damit der Anwender nur den relevanten Teil sieht.
 */
function getCleanMessage(message: string | undefined): string | undefined {
  if (!message) return undefined
  if (message.startsWith('Mistral-OCR:')) {
    const parts = message.split(' - Args:')
    return parts[0].replace('Mistral-OCR: ', '')
  }
  return message
}

export function JobProgressBar({ status, progress, message, phase }: JobProgressBarProps) {
  const phaseLabel = getPhaseLabel(phase)

  const statusLabel = (() => {
    if (status === 'queued') return 'In Warteschlange...'
    if (status === 'completed') return 'Abgeschlossen'
    if (status === 'failed') return 'Fehlgeschlagen'
    if (phaseLabel) return `${phaseLabel} wird verarbeitet...`
    return 'Wird verarbeitet...'
  })()

  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0
  const cleanMessage = getCleanMessage(message)
  const progressBarValue = status === 'running' ? progressValue : status === 'queued' ? 0 : 100

  return (
    <div className="mx-3 mt-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{statusLabel}</span>
        {status === 'running' && (
          <span className="text-xs text-muted-foreground">{progressValue}%</span>
        )}
      </div>
      <Progress value={progressBarValue} className="h-2" />
      {cleanMessage && (
        <p className="mt-2 text-xs text-muted-foreground truncate">{cleanMessage}</p>
      )}
    </div>
  )
}
