'use client'

/**
 * Block 2 und 3 des Reiters „Korrektur": Ersetzungen (Hoerfehler) und
 * Sprecher-Zuordnung — je Zeile annehmen, ablehnen, aendern. Reine Darstellung;
 * Zustand haelt `useAudioCorrection`.
 */

import { Button, Checkbox, Input } from '@ks/ui'
import { Plus, Trash2 } from 'lucide-react'
import { leereErsetzung, type ErsetzungZeile, type SprecherZeile } from './audio-correction-types'

function Beleg({ beleg, begruendung }: { beleg: string; begruendung: string }) {
  if (!beleg && !begruendung) return null
  const unsicher = beleg === 'unsicher'
  return (
    <span className={`text-[11px] ${unsicher ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`} title={begruendung}>
      {beleg}{begruendung ? ` · ${begruendung}` : ''}
    </span>
  )
}

interface ErsetzungenProps {
  zeilen: ErsetzungZeile[]
  onChange: (zeilen: ErsetzungZeile[]) => void
  disabled: boolean
}

export function ErsetzungenListe({ zeilen, onChange, disabled }: ErsetzungenProps) {
  const update = (id: string, patch: Partial<ErsetzungZeile>) => onChange(zeilen.map((z) => (z.id === id ? { ...z, ...patch } : z)))
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Ersetzungen (Namen, Zahlen, Fachwoerter)</div>
          <p className="text-xs text-muted-foreground">Jede Stelle muss genau einmal vorkommen; &bdquo;alle&ldquo; ersetzt jedes Vorkommen.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onChange([...zeilen, leereErsetzung()])} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" /> Zeile
        </Button>
      </div>
      {zeilen.length === 0 && <p className="text-xs text-muted-foreground">Keine Ersetzungen. Vorschlaege holen oder eine Zeile von Hand anlegen.</p>}
      {zeilen.map((z) => (
        <div key={z.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto] items-center gap-2">
          <Checkbox checked={z.aktiv} disabled={disabled} onCheckedChange={(v) => update(z.id, { aktiv: v === true })} aria-label="Ersetzung uebernehmen" />
          <Input value={z.alt} disabled={disabled} placeholder="alt (woertlich)" className="h-8 text-xs" onChange={(e) => update(z.id, { alt: e.target.value })} />
          <Input value={z.neu} disabled={disabled} placeholder="neu" className="h-8 text-xs" onChange={(e) => update(z.id, { neu: e.target.value })} />
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Checkbox checked={z.alle} disabled={disabled} onCheckedChange={(v) => update(z.id, { alle: v === true })} aria-label="alle Vorkommen" /> alle
          </label>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={disabled} onClick={() => onChange(zeilen.filter((x) => x.id !== z.id))} aria-label="Zeile entfernen">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <div className="col-span-5 -mt-1 pl-7 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
            {z.zeile !== null && <span>Zeile {z.zeile}</span>}
            {z.kontext && <span className="truncate max-w-[60ch]" title={z.kontext}>{z.kontext}</span>}
            <Beleg beleg={z.beleg} begruendung={z.begruendung} />
          </div>
        </div>
      ))}
    </div>
  )
}

interface SprecherProps {
  zeilen: SprecherZeile[]
  onChange: (zeilen: SprecherZeile[]) => void
  disabled: boolean
  hatPraefixe: boolean
}

export function SprecherListe({ zeilen, onChange, disabled, hatPraefixe }: SprecherProps) {
  const update = (label: string, patch: Partial<SprecherZeile>) => onChange(zeilen.map((z) => (z.label === label ? { ...z, ...patch } : z)))
  return (
    <div className="rounded border p-3 space-y-2">
      <div className="text-sm font-medium">Sprecher</div>
      <p className="text-xs text-muted-foreground">
        Label aus der Transkription → Person. Ein Haken ersetzt das Label an jedem Absatz; ohne Haken bleibt es Rolle.
      </p>
      {zeilen.length === 0 && (
        <p className="text-xs text-muted-foreground">Dieses Transkript hat keine Sprecher-Labels. Mit &bdquo;Sprecher erkennen&ldquo; neu transkribieren, wenn die Zuordnung gebraucht wird.</p>
      )}
      {zeilen.length > 0 && !hatPraefixe && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Die Labels stehen im Frontmatter, aber nicht mehr als Praefix im Text — vermutlich schon zugeordnet.</p>
      )}
      {zeilen.map((z) => (
        <div key={z.label} className="grid grid-cols-[auto_12rem_1fr] items-center gap-2">
          <Checkbox checked={z.aktiv} disabled={disabled || !hatPraefixe} onCheckedChange={(v) => update(z.label, { aktiv: v === true })} aria-label="Sprecher zuordnen" />
          <span className="text-xs font-mono truncate" title={z.label}>{z.label}</span>
          <div className="flex items-center gap-2">
            <Input value={z.name} disabled={disabled || !hatPraefixe} placeholder="Name der Person" className="h-8 text-xs" onChange={(e) => update(z.label, { name: e.target.value })} />
            <Beleg beleg={z.beleg} begruendung={z.begruendung} />
          </div>
        </div>
      ))}
    </div>
  )
}
