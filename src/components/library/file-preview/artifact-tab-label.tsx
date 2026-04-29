'use client';

/**
 * file-preview/artifact-tab-label.tsx
 *
 * Tab-Label-Komponente fuer die File-Preview-Tabs (Original, Transcript,
 * Transformation, Story, Overview). Zeigt ein Icon mit zustandsabhaengiger
 * Farbe + Label-Text.
 *
 * Aus `file-preview.tsx` extrahiert (Welle 3-II-a).
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { StoryStepState, StoryStepStatus } from '@/components/library/shared/story-status'

/**
 * Liefert den Step mit der gegebenen ID aus der Steps-Liste,
 * oder `null` wenn nicht vorhanden.
 */
export function getStoryStep(steps: StoryStepStatus[], id: StoryStepStatus['id']): StoryStepStatus | null {
  return steps.find((step) => step.id === id) ?? null
}

/**
 * Mapping von StoryStepState zu Tailwind-Farbklassen fuer das Tab-Icon.
 * - `present` → gruen
 * - `running` → bernsteinfarben
 * - `error` → rot (destructive)
 * - `null` / `missing` → muted
 */
export function stepStateClass(state: StoryStepState | null): string {
  if (state === 'present') return 'text-green-600'
  if (state === 'running') return 'text-amber-600'
  if (state === 'error') return 'text-destructive'
  return 'text-muted-foreground'
}

interface ArtifactTabLabelProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  state: StoryStepState | null
}

export function ArtifactTabLabel({ icon: Icon, label, state }: ArtifactTabLabelProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={cn('h-4 w-4', stepStateClass(state))} />
      <span>{label}</span>
    </span>
  )
}
