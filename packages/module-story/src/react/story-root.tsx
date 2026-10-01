'use client'

/**
 * `StoryRoot` — die Mitte des Story-Modus als montierbare Wurzel (D6b):
 * Themenuebersicht, Themenseite oder genau die gewaehlte Konversation, dazu
 * die Eingabe. Montiert ueber den Slot `storyPanel` der Galerie; die Chronik
 * (`StoryChronik`) haengt daneben im Slot `storyChronik`, beide teilen sich
 * die Story-Atome und die aktive Sitzung (`useStorySitzungId`).
 *
 * Was das Paket nicht kennt, kommt als Prop oder Slot: Instanz, Anmeldung,
 * Perspektive samt Modell, Konfig-Texte, Eingabegrenze, Belege-Kanal zur
 * Galerie, KI-Hinweis.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button, ScrollArea } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { InstanceApi } from '@ks/api-client'
import type { DocReference, GalleryFilters } from '@ks/contracts'
import { StoryUebersicht } from './story-uebersicht'
import { StoryThema } from './story-thema'
import { VerarbeitungEinfach } from './verarbeitung-einfach'
import { StoryKonversation } from './konversation/story-konversation'
import { StoryEingabe } from './konversation/story-eingabe'
import type { Nachricht, Perspektive } from './konversation/types'
import { STORY_UEBERSICHT, type StoryKopf } from './types'
import { useStoryKonversation } from './story-root/use-story-konversation'

export interface StoryRootProps {
  libraryId: string
  instanz: InstanceApi
  viewer: { isSignedIn: boolean }
  perspektive: Perspektive
  kopf: StoryKopf & { themenTitel?: string; themenIntro?: string }
  /** Dokumente im (gefilterten) Bestand. */
  dokumente: number
  filter?: GalleryFilters
  eingabe?: { placeholder?: string; maxZeichen?: number; maxZeichenHinweis?: string }
  /** Belege einer frischen Antwort — der Gastgeber zeigt sie (Galerie rechts). */
  onBelege?: (belege: DocReference[], queryId: string) => void
  /** Unter jeder Antwort (KI-Hinweis). */
  antwortFuss?: (antwort: Nachricht) => ReactNode
  /** Unter den Themenkarten; bekommt die gespeicherte Kennung der Uebersicht (Konfig-Anzeige, Quellen). */
  uebersichtFuss?: (info: { queryId: string | null }) => ReactNode
  /** D6c: Fragen duerfen geloescht werden (eigene Sitzung); Standard aus. */
  loeschenErlaubt?: boolean
}

export function StoryRoot(p: StoryRootProps) {
  const { t } = useTranslation()
  const k = useStoryKonversation({
    libraryId: p.libraryId, instanz: p.instanz, isSignedIn: p.viewer.isSignedIn, perspektive: p.perspektive,
    filter: p.filter, dokumente: p.dokumente, onBelege: p.onBelege,
    maxZeichen: p.eingabe?.maxZeichen,
    maxZeichenHinweis: p.eingabe?.maxZeichenHinweis ?? (p.eingabe?.maxZeichen ? t('story.eingabe.tooLong', { max: p.eingabe.maxZeichen }) : undefined),
  })
  const [text, setText] = useState('')
  const [eingabeOffen, setEingabeOffen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const gewaehltesThema = k.auswahl.art === 'thema' ? k.auswahl.themaId : null
  const thema = gewaehltesThema ? k.gliederung?.topics.find((th) => th.id === gewaehltesThema) ?? null : null
  // Thema gewaehlt, aber nicht (mehr) in der Gliederung: zurueck zur Uebersicht, sichtbar statt leer.
  useEffect(() => {
    if (k.auswahl.art === 'thema' && k.gliederung && !thema) k.setAuswahl(STORY_UEBERSICHT)
  }, [k, thema])

  // Jede Auswahl beginnt oben — die Konversation steht allein in der Mitte.
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
    if (viewport && typeof viewport.scrollTo === 'function') viewport.scrollTo({ top: 0 })
  }, [k.auswahl])

  const frageUebernehmen = (frage: string) => {
    setText(frage)
    setEingabeOffen(true)
  }
  const senden = () => {
    const frage = text.trim()
    if (!frage) return
    setText('')
    void k.frageSenden(frage)
  }

  const status = k.uebersichtLaeuft ? (
    <div className="rounded-lg border bg-muted/30 p-3" data-uebersicht-laeuft>
      <div className="text-sm text-muted-foreground">{t('gallery.storyMode.generatingTopics')}</div>
      {k.schritte.length > 0 && <div className="mt-3 border-t border-border/50 pt-3"><VerarbeitungEinfach schritte={k.schritte} /></div>}
    </div>
  ) : !k.gliederung && p.dokumente >= 1 && !k.fehler ? (
    <p className="text-sm text-muted-foreground">{t('story.uebersicht.empty')}</p>
  ) : undefined

  const aktionen = k.gliederung ? (
    <Button variant="outline" size="sm" className="gap-2" onClick={k.uebersichtNeu} disabled={k.laeuft} title={t('gallery.storyMode.reloadTooltip')}>
      {k.uebersichtLaeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      <span className="hidden sm:inline">{k.uebersichtLaeuft ? t('story.recomputing') : t('story.recompute')}</span>
    </Button>
  ) : undefined

  let mitte: ReactNode
  if (k.auswahl.art === 'konversation') {
    mitte =
      k.paareDerAuswahl.length === 0 && !k.laeuft ? (
        <p className="text-sm text-muted-foreground" role="status">
          {k.verlaufLadend ? t('story.conversationLoading') : t('story.conversationNotInHistory')}
        </p>
      ) : (
        <StoryKonversation
          paare={k.paareDerAuswahl}
          laeuft={k.laeuft}
          schritte={k.schritte}
          fehler={k.fehler}
          onFrage={frageUebernehmen}
          fuss={p.antwortFuss}
          onErneut={frageUebernehmen}
          onLoeschen={p.loeschenErlaubt ? k.frageLoeschen : undefined}
        />
      )
  } else if (thema) {
    mitte = <StoryThema thema={thema} onFrageWaehlen={(frage) => frageUebernehmen(frage.text)} onZurueck={() => k.setAuswahl(STORY_UEBERSICHT)} />
  } else {
    mitte = (
      <>
        <StoryUebersicht
          kopf={{ titel: p.kopf.titel, beschreibung: p.kopf.beschreibung }}
          gliederung={k.gliederung}
          dokumente={p.dokumente}
          themenTitel={p.kopf.themenTitel}
          themenIntro={p.kopf.themenIntro}
          onThemaWaehlen={(themaId) => k.setAuswahl({ art: 'thema', themaId })}
          status={status}
          aktionen={aktionen}
          fuss={p.uebersichtFuss?.({ queryId: k.uebersichtQueryId })}
        />
        {k.fehler && <div role="alert" className="mt-4 rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{k.fehler}</div>}
      </>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden" data-story-root>
      <ScrollArea ref={scrollRef} className="min-h-0 flex-1">
        <div className="p-4 pb-24 sm:p-6">{mitte}</div>
      </ScrollArea>
      <StoryEingabe
        offen={eingabeOffen}
        setOffen={setEingabeOffen}
        text={text}
        setText={setText}
        onSenden={senden}
        laeuft={k.laeuft}
        antwortLaenge={k.antwortLaenge}
        setAntwortLaenge={k.setAntwortLaenge}
        placeholder={p.eingabe?.placeholder}
      />
    </div>
  )
}
