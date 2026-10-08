'use client'

/**
 * Reiter „Korrektur" am Audio-Transkript (P3b). Aufbau wie der Reiter
 * „Transformation": Kopfzeile mit Hinweis links und Knoepfen rechts, Inhalt in
 * Rahmen. Drei Bloecke (Begleitdokumente, Ersetzungen, Sprecher) und die
 * Fusszeile mit Begruendung, Vorschau und „Bestaetigen und schreiben".
 */

import * as React from 'react'
import { Alert, AlertDescription, Button, Input } from '@ks/ui'
import { Check, Eye } from 'lucide-react'
import { toast } from 'sonner'
import type { StorageProvider } from '@/lib/storage/types'
import { ErsetzungenListe, SprecherListe } from './audio-correction-lists'
import { AudioCorrectionSources } from './audio-correction-sources'
import { anzahlAktiv } from './audio-correction-types'
import { useAudioCorrection } from './use-audio-correction'

interface Props {
  libraryId: string
  sourceId: string
  parentId: string
  provider: StorageProvider | null
  enabled: boolean
  /** Nach erfolgreichem Schreiben: z. B. in den Reiter „Transformation" springen. */
  onGeschrieben?: (ueberholteTransformationen: number) => void
}

export function AudioCorrectionTab(props: Props) {
  const k = useAudioCorrection(props)
  const aktiv = anzahlAktiv(k.ersetzungen, k.sprecher)
  const nichtsGewaehlt = aktiv.ersetzungen + aktiv.sprecher === 0
  const gesperrt = k.laeuft !== null || !k.zustand

  const schreiben = async () => {
    const antwort = await k.anwenden(false)
    if (!antwort) return
    toast.success('Transkript korrigiert', {
      description: `${antwort.belege.length} Stellen ersetzt, ${antwort.speakerNames.length} Sprecher zugeordnet.`,
    })
    props.onGeschrieben?.(antwort.transformationen.length)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Hoerfehler und Sprecher bestaetigen, dann schreiben. Geschrieben wird nur der Text; vorhandene
          Transformationen gelten danach als ueberholt.
          {k.zustand?.revisedAt && (
            <> · zuletzt korrigiert {new Date(k.zustand.revisedAt).toLocaleString('de-DE')} von {k.zustand.revisedBy}</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void k.anwenden(true)} disabled={gesperrt || nichtsGewaehlt}>
            <Eye className="h-4 w-4 mr-2" /> Vorschau
          </Button>
          <Button size="sm" onClick={() => void schreiben()} disabled={gesperrt || nichtsGewaehlt || k.begruendung.trim() === ''}>
            <Check className="h-4 w-4 mr-2" /> {k.laeuft === 'schreiben' ? 'Schreibt …' : 'Bestaetigen und schreiben'}
          </Button>
        </div>
      </div>

      {k.ladeFehler && (
        <Alert variant="destructive"><AlertDescription>{k.ladeFehler}</AlertDescription></Alert>
      )}
      {k.aktionsFehler && (
        <Alert variant="destructive"><AlertDescription>{k.aktionsFehler}</AlertDescription></Alert>
      )}

      {k.zustand && (
        <>
          <AudioCorrectionSources
            quellen={k.quellen}
            onToggle={(id, gewaehlt) => k.setQuellen(k.quellen.map((q) => (q.id === id ? { ...q, gewaehlt } : q)))}
            onHolen={() => void k.holeVorschlaege()}
            laeuft={k.laeuft === 'vorschlag'}
            disabled={k.laeuft !== null}
            vorschlag={k.vorschlag}
          />
          <ErsetzungenListe zeilen={k.ersetzungen} onChange={k.setErsetzungen} disabled={k.laeuft !== null} />
          <SprecherListe zeilen={k.sprecher} onChange={k.setSprecher} disabled={k.laeuft !== null} hatPraefixe={k.zustand.hatPraefixe} />
          <div className="rounded border p-3 space-y-2">
            <div className="text-sm font-medium">Begruendung (wird als revision_note gespeichert)</div>
            <Input
              value={k.begruendung}
              onChange={(e) => k.setBegruendung(e.target.value)}
              placeholder="z. B. Namen laut Einladung und Folien bestaetigt"
              className="h-8 text-xs"
              disabled={k.laeuft !== null}
            />
            <p className="text-[11px] text-muted-foreground">
              Aktiv: {aktiv.ersetzungen} Ersetzungen, {aktiv.sprecher} Sprecher. Stand {k.zustand.updatedAt}.
            </p>
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
      )}
    </div>
  )
}
