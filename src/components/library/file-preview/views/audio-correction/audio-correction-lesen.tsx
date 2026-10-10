'use client'

/**
 * Linke Spalte des Reiters „Korrektur": oben das Audio der Quelle, darunter
 * der Text. Liegen Satz-Segmente des Laufs vor, Satz fuer Satz mit gelben
 * Stellen; sonst die Absaetze des Transkripts mit Hinweis, warum keine
 * Bewertung moeglich ist (kein stiller Wechsel der Ansicht).
 */

import * as React from 'react'
import { Button } from '@ks/ui'
import { Info } from 'lucide-react'
import type { StorageProvider } from '@/lib/storage/types'
import type { TranskriptAbsatz } from '@/lib/transkript-korrektur/absaetze'
import { bewerteSegmente } from '@/lib/transkript-verlaesslichkeit/befunde'
import type { TranscriptSegment } from '@/lib/transkript-verlaesslichkeit/segmente'
import { AudioCorrectionSaetze } from './audio-correction-saetze'
import { AudioCorrectionText } from './audio-correction-text'
import type { SatzVorschlagAktionen } from './audio-correction-satz'
import type { AssistentState } from './use-assistent'
import { useAudioSprung } from './use-audio-sprung'

export interface SegmenteStand {
  segments: TranscriptSegment[]
  updatedAt: string
}

interface Props {
  provider: StorageProvider | null
  sourceId: string
  absaetze: TranskriptAbsatz[]
  segmente: SegmenteStand | null
  erlaubteSprachen: string[]
  /** Letzte Korrektur des Transkripts; liegt sie nach dem Lauf, zeigen die Saetze den Stand vor der Korrektur. */
  revisedAt: string | null
  /** Satz sofort speichern; liefert null bei Erfolg, sonst die Fehlermeldung. */
  onKorrigiere: (index: number, neu: string) => Promise<string | null>
  /** Sprecher an einem Satz setzen/umbenennen (Name) oder entfernen (null). */
  onSprecher: (index: number, name: string | null) => Promise<string | null>
  assistent: AssistentState
  aktionen: SatzVorschlagAktionen
  /** Knopf „Vorschlaege holen" fuer die Kopfzeile der Satzliste. */
  kopfAktion: React.ReactNode
}

const SPRUENGE = [-15, -5, 5, 15] as const

export function AudioCorrectionLesen(props: Props) {
  const audio = useAudioSprung(props.provider, props.sourceId)
  const segments = props.segmente?.segments ?? []
  const bewertung = React.useMemo(() => bewerteSegmente(segments, props.erlaubteSprachen), [segments, props.erlaubteSprachen])
  const zeitenGeschaetzt = segments.some((s) => s.timeSource === 'estimated')
  const korrigiertNachLauf = !!(props.revisedAt && props.segmente && props.revisedAt > props.segmente.updatedAt)

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {audio.fehler && <p className="text-xs text-destructive">Audio nicht ladbar: {audio.fehler}</p>}
      {audio.url && (
        // Eine Zeile: Player, Spul-Knoepfe, Hinweis als Symbol — Hoehe sparen (Owner 10.10.2026).
        <div className="flex shrink-0 items-center gap-1">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Das Audio IST die Quelle; der Text darunter ist das Transkript. */}
          <audio ref={audio.audioRef} controls preload="metadata" src={audio.url} className="h-8 min-w-0 flex-1" />
          {SPRUENGE.map((d) => (
            <Button key={d} size="sm" variant="outline" className="h-7 px-1.5 text-xs tabular-nums" onClick={() => audio.verschiebe(d)} title={`${d > 0 ? 'Vor' : 'Zurueck'} um ${Math.abs(d)} Sekunden`}>
              {d > 0 ? `+${d}` : d}
            </Button>
          ))}
          {zeitenGeschaetzt && (
            // Titel statt Textzeile: der Hinweis ist wichtig, aber nicht bei jedem Satz neu.
            <span className="ml-1 shrink-0 text-muted-foreground" title="Zeitmarken sind geschaetzt (15–30 s Abweichung moeglich). Der Sprung startet 5 s frueher; mit den Knoepfen nachjustieren.">
              <Info className="h-4 w-4" aria-label="Hinweis zu den Zeitmarken" />
            </span>
          )}
        </div>
      )}
      {/* Kein Innenabstand oben: die klebende Kopfzeile der Satzliste sitzt sonst ueber der ersten Zeile. */}
      <div className="min-h-0 flex-1 overflow-auto rounded border px-3 pb-3">
        {segments.length > 0 ? (
          <>
            {korrigiertNachLauf && (
              <p className="mb-2 text-xs text-muted-foreground">
                Das Transkript wurde nach diesem Lauf korrigiert — die Saetze zeigen den Text der Transkription, nicht die Korrektur.
              </p>
            )}
            <AudioCorrectionSaetze
              bewertung={bewertung}
              zeit={audio.zeit}
              onSpringe={audio.springe}
              zeitenGeschaetzt={zeitenGeschaetzt}
              onKorrigiere={props.onKorrigiere}
              onSprecher={props.onSprecher}
              korrekturenJeSatz={props.assistent.korrekturenJeSatz}
              sprecherJeSatz={props.assistent.sprecherJeSatz}
              aktionen={props.aktionen}
              kopfAktion={props.kopfAktion}
            />
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {props.segmente
                ? 'Der letzte Transkriptions-Lauf hat keine Saetze geliefert — keine Bewertung moeglich.'
                : 'Fuer dieses Transkript liegen keine Satz-Werte vor (aelterer Lauf). Neu transkribieren, um unsichere Stellen zu sehen.'}
            </p>
            <AudioCorrectionText absaetze={props.absaetze} />
          </>
        )}
      </div>
    </div>
  )
}
