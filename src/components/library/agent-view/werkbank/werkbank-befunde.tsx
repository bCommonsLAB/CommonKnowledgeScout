'use client'

/**
 * @fileoverview Befunde des Teilbaums im Werkbank-Detail (F9, Welle W4).
 *
 * @description
 * Drei einklappbare Akteur-Gruppen mit Zaehlern, darin nach Zyklus-Schritt —
 * gruppiert ueber das BESTEHENDE Todo-Routing (`buildTodoLists`, F2, keine
 * zweite Gruppierungslogik). Die Cowork-Gruppe traegt „Auftrag kopieren
 * (dieses Vorhaben)": der bestehende `auftrag-generator`, gefuettert mit
 * genau den Befunden dieses Teilbaums. Kappung wird ausgewiesen, wenn der
 * Report mehr Befunde zaehlt als er listet (Gap-Budget).
 *
 * @module components/library/agent-view
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCopy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { buildAuftrag, type AuftragContext } from '@/lib/agent-view/auftrag-generator'
import { actorLabel, gapLabel, zyklusSchrittLabel } from '@/lib/agent-view/labels'
import { buildTodoLists, TODO_ACTORS } from '@/lib/agent-view/todo-lists'
import type { CoverageGap, GapActor } from '@/lib/agent-view/types'

export function WerkbankBefunde({
  befunde,
  totalGaps,
  auftragContext,
}: {
  /** Befunde des Teilbaums (via `teilbaumBefunde`). */
  befunde: readonly CoverageGap[]
  /** Teilbaum-Zaehler der Karte — groesser als `befunde.length` ⇒ Kappung benennen. */
  totalGaps: number
  auftragContext: AuftragContext
}) {
  const { toast } = useToast()
  const [zu, setZu] = useState<ReadonlySet<GapActor>>(new Set())
  const lists = buildTodoLists(befunde)

  const toggle = (actor: GapActor) => {
    setZu((prev) => {
      const next = new Set(prev)
      if (next.has(actor)) next.delete(actor)
      else next.add(actor)
      return next
    })
  }

  const copyAuftrag = async (gaps: readonly CoverageGap[]) => {
    try {
      const text = buildAuftrag(gaps, auftragContext)
      await navigator.clipboard.writeText(text)
      toast({ title: 'Auftrag kopiert', description: `${gaps.length} Befund(e) dieses Vorhabens als Cowork-Auftrag.` })
    } catch (error) {
      toast({
        title: 'Kopieren fehlgeschlagen',
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      })
    }
  }

  if (befunde.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Befunde im Teilbaum dieses Vorhabens.</p>
  }

  return (
    <div className="space-y-2">
      {totalGaps > befunde.length && (
        <p className="text-xs text-muted-foreground">
          {totalGaps - befunde.length} weitere Befunde sind gezaehlt, aber nicht gelistet (Gap-Budget des
          Reports) — Zaehler stimmen, die Liste hier ist unvollstaendig.
        </p>
      )}
      {TODO_ACTORS.map((actor) => {
        const list = lists[actor]
        const offen = !zu.has(actor)
        return (
          <section key={actor} className="rounded-md border">
            <div className="flex w-full items-center gap-2 px-2 py-1">
              <button
                type="button"
                onClick={() => toggle(actor)}
                aria-expanded={offen}
                className="flex flex-1 items-center gap-2 rounded py-0.5 text-sm font-semibold hover:bg-accent"
              >
                {offen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                {actorLabel(actor)}
                <Badge variant="secondary">{list.totalCount}</Badge>
              </button>
              {actor === 'cowork' && list.totalCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => void copyAuftrag(list.groups.flatMap((group) => group.gaps))}
                >
                  <ClipboardCopy className="mr-1 h-3 w-3" aria-hidden />
                  Auftrag kopieren (dieses Vorhaben)
                </Button>
              )}
            </div>
            {offen && list.totalCount === 0 && (
              <p className="px-2 pb-2 text-xs text-muted-foreground">Keine offenen Befunde.</p>
            )}
            {offen &&
              list.groups.map((group) => (
                <div key={group.zyklusSchritt} className="space-y-1 px-2 pb-2">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    {zyklusSchrittLabel(group.zyklusSchritt)}
                  </h4>
                  {group.gaps.map((gap, index) => (
                    <p key={`${gap.type}-${gap.targetId}-${index}`} className="text-xs">
                      <span className="font-medium">{gapLabel(gap.type)}</span>
                      <span className="text-muted-foreground"> — {gap.message}</span>
                      <span className="block truncate text-muted-foreground/80" title={gap.path || '(Wurzel)'}>
                        {gap.path || '(Archiv-Wurzel)'}
                      </span>
                    </p>
                  ))}
                </div>
              ))}
          </section>
        )
      })}
    </div>
  )
}
