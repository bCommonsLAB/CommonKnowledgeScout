'use client'

/**
 * Randkarten des Korrektur-Assistenten (rechte Spalte, auf Hoehe des Satzes —
 * wie Kommentare im Aenderungsmodus von Word): Korrektur „alt → neu" und
 * Sprecherwechsel „ab hier spricht …", je mit Uebernehmen (speichert sofort)
 * und Verwerfen. Ein Fehler beim Speichern bleibt an der Karte stehen.
 */

import * as React from 'react'
import { Button } from '@ks/ui'
import { Check, Loader2, UserRound, X } from 'lucide-react'
import type { KorrekturVorschlag, SprecherVorschlag } from '@/lib/transkript-korrektur/assistent-pruefung'

function useAktion(ausfuehren: () => Promise<string | null>) {
  const [laeuft, setLaeuft] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const start = async () => {
    setLaeuft(true)
    setFehler(null)
    const e = await ausfuehren()
    setLaeuft(false)
    if (e) setFehler(e)
  }
  return { laeuft, fehler, start }
}

function Knoepfe({ laeuft, onAnnehmen, onVerwerfen }: { laeuft: boolean; onAnnehmen: () => void; onVerwerfen: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400" onClick={onAnnehmen} disabled={laeuft} title="Uebernehmen (wird sofort gespeichert)" aria-label="Uebernehmen">
        {laeuft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      </Button>
      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:bg-muted" onClick={onVerwerfen} disabled={laeuft} title="Verwerfen" aria-label="Verwerfen">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

export function KorrekturKarte({ v, onAnnehmen, onVerwerfen }: {
  v: KorrekturVorschlag
  onAnnehmen: () => Promise<string | null>
  onVerwerfen: () => void
}) {
  const a = useAktion(onAnnehmen)
  return (
    <div className="rounded border border-sky-300 bg-sky-50 p-2 text-xs dark:border-sky-800 dark:bg-sky-950/40">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-muted-foreground line-through">{v.alt}</span>{' '}
          <span className="font-medium text-sky-800 dark:text-sky-300">{v.neu}</span>
          {v.grund && <div className="mt-0.5 text-[11px] text-muted-foreground">{v.grund}</div>}
        </div>
        <Knoepfe laeuft={a.laeuft} onAnnehmen={() => void a.start()} onVerwerfen={onVerwerfen} />
      </div>
      {a.fehler && <div className="mt-1 text-[11px] text-destructive">Nicht gespeichert: {a.fehler}</div>}
    </div>
  )
}

export function SprecherKarte({ v, onAnnehmen, onVerwerfen }: {
  v: SprecherVorschlag
  onAnnehmen: () => Promise<string | null>
  onVerwerfen: () => void
}) {
  const a = useAktion(onAnnehmen)
  return (
    <div className="rounded border border-sky-300 bg-sky-50 p-2 text-xs dark:border-sky-800 dark:bg-sky-950/40">
      <div className="flex items-start gap-2">
        <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700 dark:text-sky-400" />
        <div className="min-w-0 flex-1">
          Ab hier spricht <span className="font-medium text-sky-800 dark:text-sky-300">{v.name}</span>
          {v.rolle && v.rolle.toLowerCase() !== v.name.toLowerCase() && <span className="text-muted-foreground"> ({v.rolle})</span>}
          {v.grund && <div className="mt-0.5 text-[11px] text-muted-foreground">{v.grund}</div>}
        </div>
        <Knoepfe laeuft={a.laeuft} onAnnehmen={() => void a.start()} onVerwerfen={onVerwerfen} />
      </div>
      {a.fehler && <div className="mt-1 text-[11px] text-destructive">Nicht gespeichert: {a.fehler}</div>}
    </div>
  )
}
