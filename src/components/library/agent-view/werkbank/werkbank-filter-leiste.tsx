'use client'

/**
 * @fileoverview Filterleiste der Werkbank (F6, Welle W3).
 *
 * @description
 * Segmented-Umschalter `Alle | Zu tun | Bereit` (Default „Zu tun" — die
 * Werkbank oeffnet auf der Arbeit, nicht auf dem Inventar), Chips fuer
 * Akteur und Zyklus-Schritt (exakt die MCP-Filter-Semantik, geteilte
 * Funktion `matchtBefundFilter`), Suche und Sortierung. Der Zustand wohnt
 * beim Aufrufer (URL via nuqs) — diese Leiste ist reine Darstellung.
 *
 * @module components/library/agent-view
 */

import { Input } from '@/components/ui/input'
import { actorLabel } from '@/lib/agent-view/labels'
import type { GapActor, ZyklusSchritt } from '@/lib/agent-view/types'
import type { BefundFilter, WerkbankSortierung, WerkbankStatusFilter } from '@/lib/agent-view/werkbank-filter'
import type { WerkbankGruppierung } from '@/lib/agent-view/werkbank-gruppen'

const STATUS_SEGMENTE: ReadonlyArray<{ wert: WerkbankStatusFilter; label: string }> = [
  { wert: 'alle', label: 'Alle' },
  { wert: 'zu_tun', label: 'Zu tun' },
  { wert: 'bereit', label: 'Bereit' },
  // F6/W6: oeffnet die Arbeitslisten des Users (Steuerung in der Listen-Leiste).
  { wert: 'liste', label: 'Liste ▾' },
]

const AKTEURE: readonly GapActor[] = ['mensch', 'cowork', 'knowledgescout']
const SCHRITTE: readonly ZyklusSchritt[] = [1, 2, 3, 4]

const SORTIERUNGEN: ReadonlyArray<{ wert: WerkbankSortierung; label: string }> = [
  { wert: 'pfad', label: 'Pfad' },
  { wert: 'stand', label: 'Stand' },
  { wert: 'befunde', label: 'Befunde' },
]

/** F12 (W5): zweite Denk-Ebene — gruppieren nach Bereich oder Thema. */
const GRUPPIERUNGEN: ReadonlyArray<{ wert: WerkbankGruppierung; label: string }> = [
  { wert: 'bereich', label: 'Bereich' },
  { wert: 'thema', label: 'Thema' },
]

function chipKlasse(aktiv: boolean): string {
  return `rounded-full border px-2 py-0.5 text-xs ${
    aktiv ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
  }`
}

export function WerkbankFilterLeiste({
  statusFilter,
  onStatusFilter,
  befundFilter,
  onBefundFilter,
  suche,
  onSuche,
  sortierung,
  onSortierung,
  gruppierung,
  onGruppierung,
}: {
  statusFilter: WerkbankStatusFilter
  onStatusFilter: (wert: WerkbankStatusFilter) => void
  befundFilter: BefundFilter
  onBefundFilter: (wert: BefundFilter) => void
  suche: string
  onSuche: (wert: string) => void
  sortierung: WerkbankSortierung
  onSortierung: (wert: WerkbankSortierung) => void
  gruppierung: WerkbankGruppierung
  onGruppierung: (wert: WerkbankGruppierung) => void
}) {
  return (
    <div className="space-y-2 border-b p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Status-Filter" className="inline-flex rounded-md border p-0.5">
          {STATUS_SEGMENTE.map((segment) => (
            <button
              key={segment.wert}
              type="button"
              aria-pressed={statusFilter === segment.wert}
              onClick={() => onStatusFilter(segment.wert)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                statusFilter === segment.wert ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {segment.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Gruppieren nach" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          Gruppieren:
          <span className="inline-flex rounded-md border p-0.5">
            {GRUPPIERUNGEN.map((option) => (
              <button
                key={option.wert}
                type="button"
                aria-pressed={gruppierung === option.wert}
                onClick={() => onGruppierung(option.wert)}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  gruppierung === option.wert ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
        <label className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          Sortierung
          <select
            aria-label="Sortierung"
            value={sortierung}
            onChange={(event) => onSortierung(event.target.value as WerkbankSortierung)}
            className="rounded-md border bg-background px-1.5 py-1 text-xs"
          >
            {SORTIERUNGEN.map((option) => (
              <option key={option.wert} value={option.wert}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      <Input
        type="search"
        value={suche}
        onChange={(event) => onSuche(event.target.value)}
        placeholder="Suche in Name, Pfad, Bericht-Titel …"
        aria-label="Vorhaben durchsuchen"
        className="h-8 text-sm"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {AKTEURE.map((akteur) => {
          const aktiv = befundFilter.akteur === akteur
          return (
            <button
              key={akteur}
              type="button"
              aria-pressed={aktiv}
              onClick={() => onBefundFilter({ ...befundFilter, akteur: aktiv ? null : akteur })}
              className={chipKlasse(aktiv)}
            >
              {actorLabel(akteur)}
            </button>
          )
        })}
        <span aria-hidden className="mx-1 h-4 w-px bg-border" />
        {SCHRITTE.map((schritt) => {
          const aktiv = befundFilter.zyklusSchritt === schritt
          return (
            <button
              key={schritt}
              type="button"
              aria-pressed={aktiv}
              title={`Zyklus-Schritt ${schritt}`}
              onClick={() => onBefundFilter({ ...befundFilter, zyklusSchritt: aktiv ? null : schritt })}
              className={chipKlasse(aktiv)}
            >
              {schritt}
            </button>
          )
        })}
      </div>
    </div>
  )
}
