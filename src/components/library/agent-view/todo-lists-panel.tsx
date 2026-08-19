'use client'

/**
 * @fileoverview Todos & Auftrag (Welle 3): drei Akteur-Listen + Generator.
 *
 * @description
 * Verteilt die Report-Befunde per Todo-Routing (F2) auf Mensch, Cowork und
 * KnowledgeScout. Jeder Befund ist auswaehlbar; „Auftrag kopieren" erzeugt
 * den kopierfertigen Cowork-Auftrag (Clipboard only, F3 v1 — keine Dateien,
 * keine API-Kopplung). KnowledgeScout-Todos verweisen auf die vorhandenen
 * Werkzeuge; die Sicht selbst schreibt nie in den Bestand.
 *
 * @module components/library/agent-view
 */

import { useMemo, useState } from 'react'
import { ClipboardCopy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { buildAuftrag } from '@/lib/agent-view/auftrag-generator'
import { actorLabel, zyklusSchrittLabel } from '@/lib/agent-view/labels'
import { buildTodoLists, TODO_ACTORS } from '@/lib/agent-view/todo-lists'
import type { CoverageReport, GapActor } from '@/lib/agent-view/types'
import { TodoGapRow } from './todo-gap-row'

const ACTOR_HINT: Record<GapActor, string> = {
  mensch: 'Abnahme-Liste: Verifikation und Stand-Entscheidungen (ab Welle 4 direkt in der Sicht).',
  cowork: 'Fuer die naechste Cowork-Session — Befunde auswaehlen und den Auftrag kopieren.',
  knowledgescout: 'Erledigt KnowledgeScout selbst: Pipeline (Archiv) bzw. Pruefen/Reparieren (Einstellungen).',
}

export interface TodoListsPanelProps {
  report: CoverageReport
  generatedAt: string
  libraryLabel: string
  /** `config.agentView.localRootPath` — rendert absolute Pfade im Auftrag. */
  localRootPath: string | null
}

export function TodoListsPanel({ report, generatedAt, libraryLabel, localRootPath }: TodoListsPanelProps) {
  const { toast } = useToast()
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())

  // Index in report.gaps ist die stabile Kennung innerhalb EINES Reports.
  const keyByGap = useMemo(() => new Map(report.gaps.map((gap, index) => [gap, index])), [report.gaps])
  const lists = useMemo(() => buildTodoLists(report.gaps), [report.gaps])

  const toggle = (gapKey: number, isSelected: boolean) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (isSelected) next.add(gapKey)
      else next.delete(gapKey)
      return next
    })
  }

  const copyAuftrag = async () => {
    const gaps = report.gaps.filter((gap, index) => selected.has(index))
    try {
      const text = buildAuftrag(gaps, { libraryLabel, localRootPath, generatedAt })
      await navigator.clipboard.writeText(text)
      toast({ title: 'Auftrag kopiert', description: `${gaps.length} Befund(e) als Cowork-Auftrag in der Zwischenablage.` })
    } catch (error) {
      toast({
        title: 'Kopieren fehlgeschlagen',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    }
  }

  if (report.gaps.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine offenen Befunde — es gibt nichts zu beauftragen.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={() => void copyAuftrag()} disabled={selected.size === 0}>
          <ClipboardCopy className="mr-2 h-4 w-4" />
          Auftrag kopieren ({selected.size})
        </Button>
        <span className="text-xs text-muted-foreground">
          Clipboard only — der Text ist fuer eine Cowork-Session bestimmt und endet mit dem Konsistenz-Rueckmeldungsblock.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {TODO_ACTORS.map((actor) => {
          const list = lists[actor]
          return (
            <section key={actor} className="space-y-2">
              <header className="space-y-0.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  {actorLabel(actor)}
                  <Badge variant="secondary">{list.totalCount}</Badge>
                </h3>
                <p className="text-xs text-muted-foreground">{ACTOR_HINT[actor]}</p>
              </header>
              {list.groups.map((group) => (
                <div key={group.zyklusSchritt} className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">{zyklusSchrittLabel(group.zyklusSchritt)}</h4>
                  {group.gaps.map((gap) => {
                    const gapKey = keyByGap.get(gap)
                    if (gapKey === undefined) throw new Error('Befund ohne Report-Index')
                    return (
                      <TodoGapRow key={gapKey} gap={gap} gapKey={gapKey} selected={selected.has(gapKey)} onToggle={toggle} />
                    )
                  })}
                </div>
              ))}
              {list.totalCount === 0 && <p className="text-xs text-muted-foreground">Keine offenen Todos.</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
