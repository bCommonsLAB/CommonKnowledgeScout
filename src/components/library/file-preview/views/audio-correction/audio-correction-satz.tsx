'use client'

/**
 * Ein Satz in der Lese-Ansicht des Reiters „Korrektur": Zeitmarke zum
 * Anhoeren, Text, Gruende fuer Gelb — und Bearbeiten an Ort und Stelle
 * (Doppelklick oder Stift). „Uebernehmen" speichert sofort; schlaegt das
 * fehl, bleibt der Editor mit dem Text offen und zeigt den Grund.
 */

import * as React from 'react'
import { Button, Textarea } from '@ks/ui'
import { Check, Loader2, Pencil, Play, X } from 'lucide-react'
import { formatZeit, type BewerteterSatz } from '@/lib/transkript-verlaesslichkeit/befunde'

interface Props {
  satz: BewerteterSatz
  domId: string
  laeuft: boolean
  /** Satztext kommt im Transkript mehrfach vor — ganze-Satz-Ersetzung waere nicht eindeutig. */
  mehrdeutig: boolean
  zeitenGeschaetzt: boolean
  onSpringe: (sekunden: number) => void
  /** Speichert sofort; null = gespeichert, sonst Fehlermeldung. */
  onKorrigiere: (neu: string) => Promise<string | null>
}

export function AudioCorrectionSatz({ satz, domId, laeuft, mehrdeutig, zeitenGeschaetzt, onSpringe, onKorrigiere }: Props) {
  const [bearbeiten, setBearbeiten] = React.useState(false)
  const [entwurf, setEntwurf] = React.useState('')
  const [speichert, setSpeichert] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const [gespeichert, setGespeichert] = React.useState(false)
  const gelb = satz.befunde.length > 0
  const text = satz.segment.text

  const oeffnen = () => {
    setEntwurf(text)
    setFehler(null)
    setBearbeiten(true)
  }
  const uebernehmen = async () => {
    if (entwurf.trim() === text) { setBearbeiten(false); return }
    setSpeichert(true)
    setFehler(null)
    const ergebnis = await onKorrigiere(entwurf)
    setSpeichert(false)
    if (ergebnis) { setFehler(ergebnis); return }
    setBearbeiten(false)
    setGespeichert(true)
  }

  return (
    <div
      id={domId}
      className={`group grid grid-cols-[3.5rem_1fr_auto] gap-2 rounded px-1 py-0.5 ${gelb && !gespeichert ? 'bg-amber-100 dark:bg-amber-900/40' : ''} ${laeuft ? 'ring-1 ring-primary' : ''}`}
      title={gelb && !bearbeiten && !gespeichert ? satz.befunde.map((b) => b.text).join('\n') : undefined}
    >
      <button
        type="button"
        className="flex items-start gap-1 pt-0.5 text-xs tabular-nums text-muted-foreground hover:text-foreground"
        onClick={() => onSpringe(satz.segment.start)}
        title={zeitenGeschaetzt ? 'Anhoeren (Zeit geschaetzt, startet etwas frueher)' : 'Anhoeren ab hier'}
      >
        <Play className="mt-0.5 h-3 w-3" /> {formatZeit(satz.segment.start)}
      </button>

      {bearbeiten ? (
        <div className="space-y-1">
          <Textarea
            value={entwurf}
            rows={Math.min(6, Math.max(2, Math.ceil(entwurf.length / 90)))}
            autoFocus
            disabled={speichert}
            className="text-sm"
            onChange={(e) => setEntwurf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !speichert) setBearbeiten(false)
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void uebernehmen() }
            }}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => void uebernehmen()} disabled={speichert}>
              {speichert ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Uebernehmen
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setBearbeiten(false)} disabled={speichert}>
              <X className="mr-1 h-3.5 w-3.5" /> Abbrechen
            </Button>
            <span className="text-[11px] text-muted-foreground">Enter speichert, Esc bricht ab</span>
          </div>
          {fehler && <p className="text-xs text-destructive">Nicht gespeichert: {fehler}</p>}
        </div>
      ) : (
        <div onDoubleClick={mehrdeutig ? undefined : oeffnen}>
          <span>{text}</span>
          {gespeichert && <span className="ml-2 text-[11px] text-emerald-700 dark:text-emerald-400">✓ gespeichert</span>}
          {gelb && !gespeichert && (
            <span className="block text-[11px] text-amber-800 dark:text-amber-300">{satz.befunde.map((b) => b.text).join(' · ')}</span>
          )}
        </div>
      )}

      {!bearbeiten && (
        <button
          type="button"
          className="h-6 w-6 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
          onClick={oeffnen}
          disabled={mehrdeutig}
          title={mehrdeutig
            ? 'Dieser Satz kommt im Transkript mehrfach vor — rechts unter Ersetzungen mit mehr Kontext korrigieren'
            : 'Satz korrigieren (oder Doppelklick auf den Text)'}
          aria-label="Satz korrigieren"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
