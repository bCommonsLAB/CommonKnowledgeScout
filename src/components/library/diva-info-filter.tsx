'use client'

/**
 * @fileoverview 3-Wege-Filter „mit/ohne DIVA-Info" fuer die Dateiliste.
 *
 * @description
 * Schaltet `annotationFilterModeAtom` zwischen alle / nur annotiert / nur
 * nicht-annotiert. Quelle der Annotationen ist `itemAnnotationsAtom` (per Hook
 * geladen). Die Mechanik ist generisch (Annotation vorhanden ja/nein); die
 * Labels sind DIVA-spezifisch. Zeigt Ladezustand + Fehler (kein stiller Fallback).
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  annotationFilterModeAtom,
  itemAnnotationsAtom,
  itemAnnotationsStatusAtom,
  type AnnotationFilterMode,
} from '@/atoms/library-atom'

const OPTIONS: Array<{ value: AnnotationFilterMode; label: string; title: string }> = [
  { value: 'all', label: 'Alle', title: 'Alle Dateien anzeigen' },
  { value: 'with', label: 'Mit DIVA-Info', title: 'Nur Texturen mit gespeicherter DIVA-Info' },
  { value: 'without', label: 'Ohne DIVA-Info', title: 'Nur Dateien ohne DIVA-Info' },
]

export function DivaInfoFilter({ className, stacked = false }: { className?: string; stacked?: boolean }): React.ReactElement {
  const [mode, setMode] = useAtom(annotationFilterModeAtom)
  const annotations = useAtomValue(itemAnnotationsAtom)
  const status = useAtomValue(itemAnnotationsStatusAtom)
  const count = annotations.size

  return (
    <div className={cn('flex items-center gap-1', stacked && 'flex-col items-stretch', className)}>
      {OPTIONS.map((option) => {
        const isActive = mode === option.value
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode(option.value)}
            className={cn('h-8 px-2 text-xs', stacked && 'justify-start w-full', isActive && 'bg-primary text-primary-foreground')}
            title={option.title}
          >
            {option.label}
            {option.value === 'with' && status === 'loaded' && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">{count}</span>
            )}
          </Button>
        )
      })}
      {status === 'loading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {status === 'error' && (
        <span title="DIVA-Annotationen konnten nicht geladen werden">
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        </span>
      )}
    </div>
  )
}
