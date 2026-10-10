'use client'

/**
 * Die Korrektur-Ansicht Satz fuer Satz, zweispaltig wie der Aenderungsmodus
 * von Word: links der Text (gelb = Werte sprechen dagegen, Vorschlaege als
 * Revision im Text), rechts am Rand die Vorschlagskarten des Assistenten.
 * Luecken ueber 10 s als eigene Zeile. Kopfzeile mit Zaehlern, Filter und
 * Sprung zur naechsten offenen Stelle (gelb oder Vorschlag).
 */

import * as React from 'react'
import { Button } from '@ks/ui'
import { AlertTriangle, ChevronDown } from 'lucide-react'
import type { KorrekturVorschlag, SprecherVorschlag } from '@/lib/transkript-korrektur/assistent-pruefung'
import type { Bewertung } from '@/lib/transkript-verlaesslichkeit/befunde'
import { AudioCorrectionSatz, type SatzVorschlagAktionen } from './audio-correction-satz'

interface Props {
  bewertung: Bewertung
  /** Aktuelle Abspielzeit — der laufende Satz wird hervorgehoben. */
  zeit: number
  onSpringe: (sekunden: number) => void
  /** Zeiten aus der Textposition geschaetzt (gpt-transcribe). */
  zeitenGeschaetzt: boolean
  /** Satz sofort speichern; null = gespeichert, sonst Fehlermeldung. */
  onKorrigiere: (index: number, neu: string) => Promise<string | null>
  /** Sprecher an einem Satz setzen/umbenennen (Name) oder entfernen (null). */
  onSprecher: (index: number, name: string | null) => Promise<string | null>
  korrekturenJeSatz: Map<number, KorrekturVorschlag[]>
  sprecherJeSatz: Map<number, SprecherVorschlag>
  aktionen: SatzVorschlagAktionen
  /** Rechts in der Kopfzeile, z. B. „Vorschlaege holen". */
  kopfAktion?: React.ReactNode
}

export function satzId(index: number): string {
  return `korrektur-satz-${index}`
}

type Filter = 'alle' | 'offen'

export function AudioCorrectionSaetze(p: Props) {
  const { bewertung, zeit, korrekturenJeSatz, sprecherJeSatz } = p
  const [filter, setFilter] = React.useState<Filter>('alle')
  const naechsteRef = React.useRef(0)
  const offen = (index: number, gelb: boolean) => gelb || korrekturenJeSatz.has(index) || sprecherJeSatz.has(index)
  const offeneIndizes = React.useMemo(
    () => bewertung.saetze.filter((s) => s.befunde.length > 0 || korrekturenJeSatz.has(s.index) || sprecherJeSatz.has(s.index)).map((s) => s.index),
    [bewertung, korrekturenJeSatz, sprecherJeSatz],
  )
  const vorschlaege = [...korrekturenJeSatz.values()].reduce((n, l) => n + l.length, 0) + sprecherJeSatz.size
  // Bisher gesetzte Sprecher als Vorschlagsliste beim Setzen von Hand (Reihenfolge des ersten Auftretens).
  const bekannteSprecher = React.useMemo(() => {
    const out: string[] = []
    for (const s of bewertung.saetze) if (s.segment.speaker && !out.includes(s.segment.speaker)) out.push(s.segment.speaker)
    for (const r of ['Publikum', 'Moderation']) if (!out.includes(r)) out.push(r)
    return out
  }, [bewertung])
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

  const springeZurNaechsten = () => {
    if (offeneIndizes.length === 0) return
    const index = offeneIndizes[naechsteRef.current % offeneIndizes.length]
    naechsteRef.current += 1
    document.getElementById(satzId(index))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const sichtbar = filter === 'offen'
    ? bewertung.saetze.filter((s) => offen(s.index, s.befunde.length > 0) || s.lueckeDavor !== null)
    : bewertung.saetze

  return (
    <div className="space-y-2">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background py-2 text-xs">
        <span className="truncate text-muted-foreground">
          {bewertung.saetze.length} Saetze · <span className="font-medium text-amber-700 dark:text-amber-400">{bewertung.gelb} gelb</span>
          {' · '}<span className="font-medium text-sky-700 dark:text-sky-400">{vorschlaege} Vorschlaege</span> · {bewertung.luecken} Luecken
          {!bewertung.sprachpruefung && ' · Sprachpruefung aus'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setFilter((f) => (f === 'alle' ? 'offen' : 'alle'))} title="Nur gelbe Stellen, Vorschlaege und Luecken zeigen">
            {filter === 'alle' ? 'Nur offene' : 'Alle'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={springeZurNaechsten} disabled={offeneIndizes.length === 0} title="Zur naechsten gelben Stelle oder zum naechsten Vorschlag">
            <ChevronDown className="h-3.5 w-3.5" /><span className="ml-1 hidden lg:inline">Naechste</span>
          </Button>
          {p.kopfAktion}
        </div>
      </div>
      {bewertung.mitWerten === 0 && (
        <p className="text-xs text-muted-foreground">Dieser Lauf hat keine Verlaesslichkeitswerte geliefert — ohne Gelb heisst hier nichts.</p>
      )}
      <div className="space-y-1 text-sm leading-relaxed">
        {sichtbar.map((s) => (
          <React.Fragment key={s.index}>
            {s.lueckeDavor !== null && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded border border-dashed border-amber-400 px-2 py-1 text-left text-xs text-amber-700 dark:text-amber-400"
                onClick={() => p.onSpringe(s.segment.start - (s.lueckeDavor ?? 0))}
                title="Anhoeren: Ist hier wirklich niemand zu hoeren?"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> {Math.round(s.lueckeDavor)} s ohne Text — fehlt hier Rede?
              </button>
            )}
            <AudioCorrectionSatz
              satz={s}
              domId={satzId(s.index)}
              laeuft={laufender === s.index}
              mehrdeutig={mehrdeutig.has(s.segment.text)}
              zeitenGeschaetzt={p.zeitenGeschaetzt}
              korrekturen={korrekturenJeSatz.get(s.index) ?? []}
              sprecherVorschlag={sprecherJeSatz.get(s.index)}
              aktionen={p.aktionen}
              onSpringe={p.onSpringe}
              onKorrigiere={(neu) => p.onKorrigiere(s.index, neu)}
              onSprecher={(name) => p.onSprecher(s.index, name)}
              bekannteSprecher={bekannteSprecher}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
