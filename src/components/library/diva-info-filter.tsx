'use client'

/**
 * @fileoverview 3-Wege-Filter fuer Basecolor-Dateien + DIVA-Sidecar-Treffer.
 *
 * @description
 * Schaltet `annotationFilterModeAtom` zwischen:
 *  - alle *_basecolor
 *  - nur *_basecolor mit Sidecar-Treffer
 *  - nur *_basecolor ohne Sidecar-Treffer
 * Quelle der Treffer ist `itemAnnotationsAtom` (Live-Match). Zeigt je Option
 * die Summe (all = with + without). Ladezustand + Fehler ohne stillen Fallback.
 */

import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  annotationFilterModeAtom,
  filesOnlyAtom,
  itemAnnotationsAtom,
  itemAnnotationsStatusAtom,
  type AnnotationFilterMode,
} from '@/atoms/library-atom'
import { isBasecolorFileName } from '@/lib/diva-texture/preprocess-folder'

const OPTIONS: Array<{ value: AnnotationFilterMode; label: string; title: string }> = [
  {
    value: 'all',
    label: 'Alle *_basecolor',
    title: 'Alle Basecolor-Dateien anzeigen',
  },
  {
    value: 'with',
    label: 'Nur *_basecolor mit DIVA-Info',
    title: 'Nur Basecolor-Dateien mit Sidecar-Treffer',
  },
  {
    value: 'without',
    label: 'Nur *_basecolor ohne DIVA-Info',
    title: 'Nur Basecolor-Dateien ohne Sidecar-Treffer',
  },
]

/** Zaehlt Basecolor-Dateien im Ordner: gesamt / mit / ohne Sidecar-Treffer. */
function useBasecolorCounts(): { all: number; with: number; without: number } {
  const files = useAtomValue(filesOnlyAtom)
  const annotations = useAtomValue(itemAnnotationsAtom)

  return React.useMemo(() => {
    let all = 0
    let withInfo = 0
    for (const file of files) {
      const name = file.metadata.name
      if (name.startsWith('.') || file.metadata.isTwin) continue
      if (!isBasecolorFileName(name)) continue
      all += 1
      if (annotations.has(name)) withInfo += 1
    }
    return { all, with: withInfo, without: all - withInfo }
  }, [files, annotations])
}

export function DivaInfoFilter({ className, stacked = false }: { className?: string; stacked?: boolean }): React.ReactElement {
  const [mode, setMode] = useAtom(annotationFilterModeAtom)
  const status = useAtomValue(itemAnnotationsStatusAtom)
  const counts = useBasecolorCounts()
  // Summen erst nach geladenem Live-Match — sonst waere „ohne“ = alle Basecolors.
  const showCounts = status === 'loaded'

  return (
    <div className={cn('flex items-center gap-1', stacked && 'flex-col items-stretch', className)}>
      {OPTIONS.map((option) => {
        const isActive = mode === option.value
        const count = counts[option.value]
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setMode(option.value)}
            className={cn(
              'h-8 px-2 text-xs whitespace-normal text-left',
              stacked && 'justify-start w-full',
              isActive && 'bg-primary text-primary-foreground',
            )}
            title={option.title}
          >
            {option.label}
            {showCounts && (
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
