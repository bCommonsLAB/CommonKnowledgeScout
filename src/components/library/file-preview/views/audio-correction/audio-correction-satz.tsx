'use client'

/**
 * Ein Satz in der Lese-Ansicht des Reiters „Korrektur": Zeitmarke zum
 * Anhoeren, Text, Gruende fuer Gelb — und Bearbeiten an Ort und Stelle
 * (Doppelklick oder Stift). „Uebernehmen" merkt die Korrektur nur vor; sie
 * erscheint rechts als Ersetzung und wird mit „Bestaetigen und schreiben"
 * gespeichert.
 */

import * as React from 'react'
import { Button, Textarea } from '@ks/ui'
import { Check, Pencil, Play, X } from 'lucide-react'
import { formatZeit, type BewerteterSatz } from '@/lib/transkript-verlaesslichkeit/befunde'

interface Props {
  satz: BewerteterSatz
  domId: string
  laeuft: boolean
  /** Vorgemerkte Korrektur (noch nicht geschrieben), sonst undefined. */
  korrektur: string | undefined
  /** Satztext kommt im Transkript mehrfach vor — ganze-Satz-Ersetzung waere nicht eindeutig. */
  mehrdeutig: boolean
  zeitenGeschaetzt: boolean
  onSpringe: (sekunden: number) => void
  onKorrigiere: (neu: string) => void
}

export function AudioCorrectionSatz({ satz, domId, laeuft, korrektur, mehrdeutig, zeitenGeschaetzt, onSpringe, onKorrigiere }: Props) {
  const [bearbeiten, setBearbeiten] = React.useState(false)
  const [entwurf, setEntwurf] = React.useState('')
  const gelb = satz.befunde.length > 0
  const text = korrektur ?? satz.segment.text

  const oeffnen = () => {
    setEntwurf(text)
    setBearbeiten(true)
  }
  const uebernehmen = () => {
    onKorrigiere(entwurf)
    setBearbeiten(false)
  }

  return (
    <div
      id={domId}
      className={`group grid grid-cols-[3.5rem_1fr_auto] gap-2 rounded px-1 py-0.5 ${gelb ? 'bg-amber-100 dark:bg-amber-900/40' : ''} ${laeuft ? 'ring-1 ring-primary' : ''}`}
      title={gelb && !bearbeiten ? satz.befunde.map((b) => b.text).join('\n') : undefined}
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
            className="text-sm"
            onChange={(e) => setEntwurf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setBearbeiten(false)
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); uebernehmen() }
            }}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={uebernehmen}><Check className="mr-1 h-3.5 w-3.5" /> Uebernehmen</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setBearbeiten(false)}><X className="mr-1 h-3.5 w-3.5" /> Abbrechen</Button>
            {korrektur !== undefined && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { onKorrigiere(satz.segment.text); setBearbeiten(false) }}>
                Original wiederherstellen
              </Button>
            )}
            <span className="text-[11px] text-muted-foreground">Enter = uebernehmen, Esc = abbrechen</span>
          </div>
        </div>
      ) : (
        <div onDoubleClick={mehrdeutig ? undefined : oeffnen}>
          <span className={korrektur !== undefined ? 'text-sky-800 dark:text-sky-300' : undefined}>{text}</span>
          {korrektur !== undefined && (
            <span className="block text-[11px] text-sky-700 dark:text-sky-400">geaendert, noch nicht geschrieben · vorher: {satz.segment.text}</span>
          )}
          {gelb && (
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
