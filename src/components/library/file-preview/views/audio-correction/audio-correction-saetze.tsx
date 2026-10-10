'use client'

/**
 * Linke Spalte des Reiters „Korrektur", wenn Satz-Segmente vorliegen: das
 * Transkript Satz fuer Satz. Gelb = die Werte sprechen dagegen (Grund im
 * Tooltip und unter dem Satz), Zeitmarke = anhoeren ab dieser Stelle, Luecken
 * ueber 10 s als eigene Zeile. Ein Satz ist per Doppelklick/Stift
 * korrigierbar (`AudioCorrectionSatz`). Reine Darstellung; Bewertung aus
 * `bewerteSegmente`, Audio aus `useAudioSprung`, Korrekturen aus dem Tab.
 */

import * as React from 'react'
import { Button } from '@ks/ui'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import type { Bewertung } from '@/lib/transkript-verlaesslichkeit/befunde'
import { AudioCorrectionSatz } from './audio-correction-satz'

interface Props {
  bewertung: Bewertung
  /** Aktuelle Abspielzeit — der laufende Satz wird hervorgehoben. */
  zeit: number
  onSpringe: (sekunden: number) => void
  /** Zeiten aus der Textposition geschaetzt (gpt-transcribe). */
  zeitenGeschaetzt: boolean
  /** Vorgemerkte Satz-Korrekturen je Index. */
  korrekturen: Map<number, string>
  onKorrigiere: (index: number, neu: string) => void
}

export function satzId(index: number): string {
  return `korrektur-satz-${index}`
}

export function AudioCorrectionSaetze({ bewertung, zeit, onSpringe, zeitenGeschaetzt, korrekturen, onKorrigiere }: Props) {
  const [nurGelb, setNurGelb] = React.useState(false)
  const gelbeIndizes = React.useMemo(() => bewertung.saetze.filter((s) => s.befunde.length > 0).map((s) => s.index), [bewertung])
  const naechsteRef = React.useRef(0)
  // Ganze-Satz-Ersetzung braucht einen eindeutigen Text (der Schreibweg lehnt Mehrdeutiges ab).
  const mehrdeutig = React.useMemo(() => {
    const zaehler = new Map<string, number>()
    for (const s of bewertung.saetze) zaehler.set(s.segment.text, (zaehler.get(s.segment.text) ?? 0) + 1)
    return new Set([...zaehler].filter(([, n]) => n > 1).map(([t]) => t))
  }, [bewertung])

  const laufender = React.useMemo(() => {
    let treffer: number | null = null
    for (const s of bewertung.saetze) if (s.segment.start <= zeit) treffer = s.index
    return treffer
  }, [bewertung, zeit])

  const springeZurNaechstenGelben = () => {
    if (gelbeIndizes.length === 0) return
    const index = gelbeIndizes[naechsteRef.current % gelbeIndizes.length]
    naechsteRef.current += 1
    document.getElementById(satzId(index))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const sichtbar = nurGelb ? bewertung.saetze.filter((s) => s.befunde.length > 0 || s.lueckeDavor !== null) : bewertung.saetze

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background pb-2 text-xs">
        <span className="text-muted-foreground">
          {bewertung.saetze.length} Saetze · <span className="font-medium text-amber-700 dark:text-amber-400">{bewertung.gelb} gelb</span> · {bewertung.luecken} Luecken
          {!bewertung.sprachpruefung && ' · Sprachpruefung aus (keine Sprachen hinterlegt)'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setNurGelb((v) => !v)} title="Nur gelbe Stellen und Luecken zeigen">
            {nurGelb ? 'Alle' : 'Nur gelbe'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={springeZurNaechstenGelben} disabled={gelbeIndizes.length === 0} title="Zur naechsten gelben Stelle">
            <ChevronDown className="h-3.5 w-3.5" /><span className="hidden lg:inline ml-1">Naechste gelbe</span>
          </Button>
        </div>
      </div>
      {bewertung.mitWerten === 0 && (
        <p className="text-xs text-muted-foreground">Dieser Lauf hat keine Verlaesslichkeitswerte geliefert — ohne Gelb heisst hier nichts.</p>
      )}
      <div className="space-y-1 text-sm leading-relaxed">
        {sichtbar.map((s) => {
          const laeuft = laufender === s.index
          return (
            <React.Fragment key={s.index}>
              {s.lueckeDavor !== null && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded border border-dashed border-amber-400 px-2 py-1 text-left text-xs text-amber-700 dark:text-amber-400"
                  onClick={() => onSpringe(s.segment.start - (s.lueckeDavor ?? 0))}
                  title="Anhoeren: Ist hier wirklich niemand zu hoeren?"
                >
                  <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(s.lueckeDavor)} s ohne Text — fehlt hier Rede?
                </button>
              )}
              <AudioCorrectionSatz
                satz={s}
                domId={satzId(s.index)}
                laeuft={laeuft}
                korrektur={korrekturen.get(s.index)}
                mehrdeutig={mehrdeutig.has(s.segment.text)}
                zeitenGeschaetzt={zeitenGeschaetzt}
                onSpringe={onSpringe}
                onKorrigiere={(neu) => onKorrigiere(s.index, neu)}
              />
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
