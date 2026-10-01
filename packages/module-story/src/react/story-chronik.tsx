'use client'

/**
 * Die linke Spalte des Story-Modus: Gliederung (Themen) und „Meine Fragen"
 * (Sitzungen). Montiert ueber den Slot `storyChronik` des Story-Reiters.
 *
 * Spricht nur ueber die Instanz und die drei Story-Atome. Was sie nicht kennen
 * darf, kommt als Prop: Anmeldezustand (`viewer`), die aktive Sitzung der App
 * und die Rueckrufe, mit denen die App ihren Chat auf eine Sitzung umstellt.
 */

import { useCallback } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { ScrollArea } from '@ks/ui'
import type { InstanceApi } from '@ks/api-client'
import { storyAktiveSitzungAtom, storyAuswahlAtom, storyGliederungAtom } from './atoms'
import { Gliederung } from './gliederung'
import { SitzungenListe } from './sitzungen-liste'
import { themaZuFrage } from './thema-zu-frage'
import { STORY_UEBERSICHT, type ChronikFrage } from './types'
import { useStorySitzungen } from './use-story-sitzungen'

export interface StoryChronikProps {
  libraryId: string
  instanz: InstanceApi
  viewer: { isSignedIn: boolean }
  /** Die Person waehlt eine andere Sitzung — die App stellt ihren Chat darauf um. */
  onSitzungWaehlen: (chatId: string) => void
  /** „Neue Sitzung": die App loest die aktive Sitzung, die naechste Frage eroeffnet eine neue. */
  onNeueSitzung: () => void
}

export function StoryChronik({ libraryId, instanz, viewer, onSitzungWaehlen, onNeueSitzung }: StoryChronikProps) {
  const [auswahl, setAuswahl] = useAtom(storyAuswahlAtom)
  const gliederung = useAtomValue(storyGliederungAtom)
  const aktiveSitzung = useAtomValue(storyAktiveSitzungAtom)
  const { sitzungen, ladend, fehler, fragenLaden, umbenennen } = useStorySitzungen({
    libraryId,
    instanz,
    isSignedIn: viewer.isSignedIn,
    aktiveChatId: aktiveSitzung.chatId,
  })

  const frageWaehlen = useCallback(
    (chatId: string, frage: ChronikFrage) => {
      if (chatId !== aktiveSitzung.chatId) onSitzungWaehlen(chatId)
      setAuswahl({
        art: 'konversation',
        queryId: frage.queryId,
        frageId: frage.frageId,
        themaId: themaZuFrage(gliederung, frage.text) ?? undefined,
      })
    },
    [aktiveSitzung.chatId, gliederung, onSitzungWaehlen, setAuswahl],
  )

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="space-y-3 p-2">
        <Gliederung
          gliederung={gliederung}
          auswahl={auswahl}
          onUebersicht={() => setAuswahl(STORY_UEBERSICHT)}
          onThema={(themaId) => setAuswahl({ art: 'thema', themaId })}
        />
        <SitzungenListe
          sitzungen={sitzungen}
          aktiveSitzung={aktiveSitzung}
          auswahl={auswahl}
          ladend={ladend}
          fehler={fehler}
          onFragenLaden={(chatId) => void fragenLaden(chatId)}
          onFrageWaehlen={frageWaehlen}
          onUmbenennen={umbenennen}
          onNeueSitzung={() => {
            onNeueSitzung()
            setAuswahl(STORY_UEBERSICHT)
          }}
        />
      </div>
    </ScrollArea>
  )
}
