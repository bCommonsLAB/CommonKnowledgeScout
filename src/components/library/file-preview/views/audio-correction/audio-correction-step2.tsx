'use client'

/**
 * Schritt 2 des Reiters „Korrektur": Sprecher benennen, Ersetzungen
 * (eingeklappt), Begruendung, Vorschau und „Bestaetigen und schreiben",
 * danach das Ergebnis. Sichtbar erst nach dem Vorschlag oder auf Wunsch.
 */

import { Button, Input } from '@ks/ui'
import { Check, Eye } from 'lucide-react'
import { ErsetzungenListe, SprecherListe } from './audio-correction-lists'
import { anzahlAktiv } from './audio-correction-types'
import type { AudioCorrectionState } from './use-audio-correction'

interface Props {
  k: AudioCorrectionState
  onSchreiben: () => void
}

export function AudioCorrectionStep2({ k, onSchreiben }: Props) {
  if (!k.zustand) return null
  const aktiv = anzahlAktiv(k.ersetzungen, k.sprecher)
  const nichtsGewaehlt = aktiv.ersetzungen + aktiv.sprecher === 0
  const gesperrt = k.laeuft !== null
  const ersetzungenOffen = k.ersetzungen.length > 0

  return (
    <>
      <SprecherListe zeilen={k.sprecher} onChange={k.setSprecher} disabled={gesperrt} hatPraefixe={k.zustand.hatPraefixe} absaetze={k.zustand.absaetze} />
      <details className="rounded border" open={ersetzungenOffen}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Ersetzungen (Namen, Zahlen, Fachwoerter){k.ersetzungen.length > 0 ? ` · ${k.ersetzungen.length}` : ''}
        </summary>
        <div className="border-t">
          <ErsetzungenListe zeilen={k.ersetzungen} onChange={k.setErsetzungen} disabled={gesperrt} />
        </div>
      </details>
      <div className="rounded border p-3 space-y-2">
        <div className="text-sm font-medium">Begruendung (wird als revision_note gespeichert)</div>
        <Input
          value={k.begruendung}
          onChange={(e) => k.setBegruendung(e.target.value)}
          placeholder="z. B. Namen laut Einladung und Folien bestaetigt"
          className="h-8 text-xs"
          disabled={gesperrt}
        />
        <p className="text-[11px] text-muted-foreground">
          Aktiv: {aktiv.ersetzungen} Ersetzungen, {aktiv.sprecher} Sprecher. Geschrieben wird nur der Text; vorhandene Transformationen gelten danach als ueberholt.
        </p>
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => void k.anwenden(true)} disabled={gesperrt || nichtsGewaehlt}>
            <Eye className="h-4 w-4 mr-2" /> Vorschau
          </Button>
          <Button size="sm" onClick={onSchreiben} disabled={gesperrt || nichtsGewaehlt || k.begruendung.trim() === ''}>
            <Check className="h-4 w-4 mr-2" /> {k.laeuft === 'schreiben' ? 'Schreibt …' : 'Bestaetigen und schreiben'}
          </Button>
        </div>
      </div>
      {k.ergebnis && (
        <div className="rounded border p-3 space-y-1 text-xs">
          <div className="font-medium">{k.ergebnis.geschrieben ? 'Geschrieben' : 'Vorschau (nichts geschrieben)'}</div>
          {k.ergebnis.belege.map((b, i) => (
            <div key={i} className="grid grid-cols-[4rem_1fr] gap-2">
              <span className="text-muted-foreground">Z. {b.zeile}{b.treffer > 1 ? ` ×${b.treffer}` : ''}</span>
              <span><span className="line-through text-muted-foreground">{b.alt}</span> → <span className="font-medium">{b.neu}</span></span>
            </div>
          ))}
          {k.ergebnis.speakerNames.length > 0 && <div>Sprecher: {k.ergebnis.speakerNames.join(' · ')}</div>}
          {k.ergebnis.geschrieben && k.ergebnis.transformationen.length > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              {k.ergebnis.transformationen.length} Transformation(en) sind jetzt ueberholt &mdash; im Reiter &bdquo;Transformation&ldquo; neu generieren.
            </div>
          )}
          {k.ergebnis.geschrieben && (k.ergebnis.abhaengigeSammeldateien?.length ?? 0) > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              {k.ergebnis.abhaengigeSammeldateien?.length} Sammeldatei(en) enthalten diese Quelle und sind jetzt ueberholt:{' '}
              {k.ergebnis.abhaengigeSammeldateien?.map((a) => a.sourceName).join(', ')}
            </div>
          )}
        </div>
      )}
    </>
  )
}
