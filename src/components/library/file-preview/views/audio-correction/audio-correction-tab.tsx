'use client'

/**
 * Reiter „Korrektur" am Audio-Transkript (P3b). Zwei Spalten: links der
 * Text Absatz fuer Absatz mit farbigen Sprechern, rechts die Arbeit in zwei
 * Schritten — (1) Begleitdokumente waehlen und Vorschlaege holen, (2) erst
 * danach Sprecher und Ersetzungen bestaetigen und schreiben. Schritt 2 ist
 * vorher bewusst nicht sichtbar: der Mensch soll der KI die Erkennung nicht
 * vorwegnehmen; „Ohne Vorschlag weiter" oeffnet ihn trotzdem.
 */

import * as React from 'react'
import { Alert, AlertDescription, Button } from '@ks/ui'
import { toast } from 'sonner'
import type { StorageProvider } from '@/lib/storage/types'
import { AudioCorrectionSources } from './audio-correction-sources'
import { AudioCorrectionStep2 } from './audio-correction-step2'
import { AudioCorrectionText } from './audio-correction-text'
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
  const [ohneVorschlag, setOhneVorschlag] = React.useState(false)
  const schritt2 = ohneVorschlag || k.vorschlag !== null

  const schreiben = async () => {
    const antwort = await k.anwenden(false)
    if (!antwort) return
    toast.success('Transkript korrigiert', {
      description: `${antwort.belege.length} Stellen ersetzt, ${antwort.speakerNames.length} Sprecher zugeordnet.`,
    })
    setOhneVorschlag(false)
    props.onGeschrieben?.(antwort.transformationen.length)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="text-xs text-muted-foreground">
        Links der Text, rechts die Arbeit: erst Vorschlaege holen, dann Sprecher und Hoerfehler bestaetigen und schreiben.
        {k.zustand?.revisedAt && (
          <> · zuletzt korrigiert {new Date(k.zustand.revisedAt).toLocaleString('de-DE')} von {k.zustand.revisedBy}</>
        )}
      </div>

      {k.ladeFehler && (
        <Alert variant="destructive"><AlertDescription>{k.ladeFehler}</AlertDescription></Alert>
      )}
      {k.aktionsFehler && (
        <Alert variant="destructive"><AlertDescription>{k.aktionsFehler}</AlertDescription></Alert>
      )}

      {k.zustand && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
          <div className="min-h-0 overflow-auto rounded border p-3">
            <AudioCorrectionText absaetze={k.zustand.absaetze} sprecher={k.sprecher} />
          </div>
          <div className="min-h-0 space-y-3 overflow-auto">
            <AudioCorrectionSources
              quellen={k.quellen}
              onToggle={(id, gewaehlt) => k.setQuellen(k.quellen.map((q) => (q.id === id ? { ...q, gewaehlt } : q)))}
              onHolen={() => void k.holeVorschlaege()}
              laeuft={k.laeuft === 'vorschlag'}
              disabled={k.laeuft !== null}
              vorschlag={k.vorschlag}
            />
            {!schritt2 && (
              <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
                Sprecher und Hoerfehler erscheinen hier, sobald der Vorschlag da ist.{' '}
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setOhneVorschlag(true)} disabled={k.laeuft !== null}>
                  Ohne Vorschlag weiter
                </Button>
              </div>
            )}
            {schritt2 && <AudioCorrectionStep2 k={k} onSchreiben={() => void schreiben()} />}
          </div>
        </div>
      )}
    </div>
  )
}
