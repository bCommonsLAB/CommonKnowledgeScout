'use client'

/**
 * @fileoverview Geruest des einheitlichen Abnahme-Kopfs (Welle A4).
 *
 * @description
 * Mockup `.dhead`, in Zustand A und B IDENTISCH gebaut: Zeile 1 traegt
 * Titel · Zustands-Chip · EINEN primaeren Knopf · Menue `⋯`; Zeile 2
 * Breadcrumb · Fortschritt · Sammelaktionen bzw. Sprung-Hinweis. Dieses
 * Modul liefert nur das Geruest und die kleinen Bausteine — Vorhaben- und
 * Artefakt-Kopf fuellen sie. Das Menue ist ein Popover mit vertikaler
 * Aktionsliste („alles Seltene").
 *
 * @module components/library/agent-view
 */

import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/** Zustands-Chip des Kopfs — `ton` folgt den Mockup-Chips (stand/ok/open). */
export function KopfChip({ ton, title, children }: { ton: 'stand' | 'ok' | 'open'; title?: string; children: ReactNode }) {
  const klasse =
    ton === 'ok'
      ? 'border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : ton === 'open'
        ? 'border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400'
        : 'border-border bg-muted text-foreground'
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${klasse}`} title={title}>
      {children}
    </span>
  )
}

/** Menue `⋯` — traegt alles Seltene (Mockup Zeile 1, rechts aussen). */
export function KopfMenue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground" aria-label={label}>
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1.5 p-2 text-xs">
        {children}
      </PopoverContent>
    </Popover>
  )
}

/** Zwei Zeilen, immer gleich gebaut — der Kopf nimmt ab, was rechts steht. */
export function AbnahmeKopfRahmen({ zeile1, zeile2, kinder }: {
  zeile1: ReactNode
  zeile2: ReactNode
  /** Hinweise/Fehler unter den zwei Zeilen (benannt, nie still). */
  kinder?: ReactNode
}) {
  return (
    <header className="space-y-1.5 border-b bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">{zeile1}</div>
      <div className="flex flex-wrap items-center gap-2">{zeile2}</div>
      {kinder}
    </header>
  )
}

/** Breadcrumb der Zeile 2 (Mockup: Monospace, gedaempft). */
export function KopfBreadcrumb({ path }: { path: string }) {
  return (
    <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground" title={path}>
      {path.split('/').join(' / ')}
    </span>
  )
}
