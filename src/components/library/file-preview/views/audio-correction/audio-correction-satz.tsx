'use client'

/**
 * Ein Satz in der Korrektur-Ansicht — eine Zeile mit drei Spalten:
 * Zeitmarke (anhoeren) | Text (Doppelklick oder Stift = bearbeiten, offene
 * Vorschlaege als Revision im Text) | Rand mit Vorschlagskarten des
 * Assistenten. Darueber ggf. der Sprecher: uebernommen als Zwischenzeile,
 * vorgeschlagen hellblau gestrichelt. Speichern geschieht sofort.
 */

import * as React from 'react'
import { Button, Textarea } from '@ks/ui'
import { Check, Loader2, Pencil, Play, UserRound, X } from 'lucide-react'
import type { KorrekturVorschlag, SprecherVorschlag } from '@/lib/transkript-korrektur/assistent-pruefung'
import { formatZeit, type BewerteterSatz } from '@/lib/transkript-verlaesslichkeit/befunde'
import { KorrekturKarte, SprecherKarte } from './assistent-karten'
import { SatzText } from './satz-text'

export interface SatzVorschlagAktionen {
  korrekturAnnehmen: (v: KorrekturVorschlag) => Promise<string | null>
  korrekturVerwerfen: (v: KorrekturVorschlag) => void
  sprecherAnnehmen: (v: SprecherVorschlag) => Promise<string | null>
  sprecherVerwerfen: (v: SprecherVorschlag) => void
}

interface Props {
  satz: BewerteterSatz
  domId: string
  laeuft: boolean
  /** Satztext kommt im Transkript mehrfach vor — ganze-Satz-Ersetzung waere nicht eindeutig. */
  mehrdeutig: boolean
  zeitenGeschaetzt: boolean
  korrekturen: readonly KorrekturVorschlag[]
  sprecherVorschlag: SprecherVorschlag | undefined
  aktionen: SatzVorschlagAktionen
  onSpringe: (sekunden: number) => void
  /** Speichert sofort; null = gespeichert, sonst Fehlermeldung. */
  onKorrigiere: (neu: string) => Promise<string | null>
}

export function AudioCorrectionSatz(p: Props) {
  const { satz, korrekturen, sprecherVorschlag, aktionen } = p
  const [bearbeiten, setBearbeiten] = React.useState(false)
  const [entwurf, setEntwurf] = React.useState('')
  const [speichert, setSpeichert] = React.useState(false)
  const [fehler, setFehler] = React.useState<string | null>(null)
  const gelb = satz.befunde.length > 0
  const text = satz.segment.text
  const hatRand = korrekturen.length > 0 || !!sprecherVorschlag

  const oeffnen = () => { setEntwurf(text); setFehler(null); setBearbeiten(true) }
  const uebernehmen = async () => {
    if (entwurf.trim() === text) { setBearbeiten(false); return }
    setSpeichert(true)
    setFehler(null)
    const ergebnis = await p.onKorrigiere(entwurf)
    setSpeichert(false)
    if (ergebnis) { setFehler(ergebnis); return }
    setBearbeiten(false)
  }

  return (
    <div id={p.domId} className="space-y-1">
      {satz.segment.speaker && (
        <div className="flex items-center gap-1.5 pt-2 text-sm font-semibold"><UserRound className="h-4 w-4" /> {satz.segment.speaker}</div>
      )}
      {sprecherVorschlag && (
        <div className="flex items-center gap-1.5 rounded border border-dashed border-sky-400 px-2 py-0.5 text-xs text-sky-800 dark:text-sky-300">
          <UserRound className="h-3.5 w-3.5" /> Vorschlag: ab hier spricht {sprecherVorschlag.name}
        </div>
      )}
      <div className="grid grid-cols-[3.5rem_1fr] gap-2 lg:grid-cols-[3.5rem_1fr_18rem]">
        <button
          type="button"
          className="flex items-start gap-1 pt-0.5 text-xs tabular-nums text-muted-foreground hover:text-foreground"
          onClick={() => p.onSpringe(satz.segment.start)}
          title={p.zeitenGeschaetzt ? 'Anhoeren (Zeit geschaetzt, startet etwas frueher)' : 'Anhoeren ab hier'}
        >
          <Play className="mt-0.5 h-3 w-3" /> {formatZeit(satz.segment.start)}
        </button>

        <div className={`group flex gap-1 rounded px-1 py-0.5 ${gelb ? 'bg-amber-100 dark:bg-amber-900/40' : ''} ${p.laeuft ? 'ring-1 ring-primary' : ''}`}
          title={gelb && !bearbeiten ? satz.befunde.map((b) => b.text).join('\n') : undefined}>
          {bearbeiten ? (
            <div className="flex-1 space-y-1">
              <Textarea value={entwurf} rows={Math.min(6, Math.max(2, Math.ceil(entwurf.length / 90)))} autoFocus disabled={speichert} className="text-sm"
                onChange={(e) => setEntwurf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && !speichert) setBearbeiten(false)
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void uebernehmen() }
                }} />
              <div className="flex items-center gap-2">
                <Button size="sm" className="h-7 px-2 text-xs" onClick={() => void uebernehmen()} disabled={speichert}>
                  {speichert ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />} Uebernehmen
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setBearbeiten(false)} disabled={speichert}><X className="mr-1 h-3.5 w-3.5" /> Abbrechen</Button>
                <span className="text-[11px] text-muted-foreground">Enter speichert, Esc bricht ab</span>
              </div>
              {fehler && <p className="text-xs text-destructive">Nicht gespeichert: {fehler}</p>}
            </div>
          ) : (
            <div className="flex-1" onDoubleClick={p.mehrdeutig ? undefined : oeffnen}>
              <SatzText text={text} vorschlaege={korrekturen} />
              {gelb && <span className="block text-[11px] text-amber-800 dark:text-amber-300">{satz.befunde.map((b) => b.text).join(' · ')}</span>}
            </div>
          )}
          {!bearbeiten && (
            <button type="button" onClick={oeffnen} disabled={p.mehrdeutig} aria-label="Satz korrigieren"
              className="h-6 w-6 shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed"
              title={p.mehrdeutig ? 'Dieser Satz kommt im Transkript mehrfach vor und laesst sich hier nicht eindeutig korrigieren' : 'Satz korrigieren (oder Doppelklick auf den Text)'}>
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hatRand && (
          <div className="col-start-2 space-y-1 lg:col-start-3">
            {sprecherVorschlag && (
              <SprecherKarte v={sprecherVorschlag} onAnnehmen={() => aktionen.sprecherAnnehmen(sprecherVorschlag)} onVerwerfen={() => aktionen.sprecherVerwerfen(sprecherVorschlag)} />
            )}
            {korrekturen.map((k) => (
              <KorrekturKarte key={k.id} v={k} onAnnehmen={() => aktionen.korrekturAnnehmen(k)} onVerwerfen={() => aktionen.korrekturVerwerfen(k)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
