'use client'

/**
 * Linke Spalte, untere Ebene: „Meine Fragen", nach Sitzungen gegliedert.
 *
 * Die aktive Sitzung zeigt ihre Fragen live (aus dem Chat-Verlauf der App,
 * `storyAktiveSitzungAtom`); aeltere Sitzungen laden ihre Fragen beim
 * Aufklappen nach. „Neue Sitzung" loest die aktive Sitzung — die naechste
 * Frage eroeffnet eine neue.
 *
 * D10c (Owner 02.10.): Hervorgehoben und von selbst offen ist nur die
 * Sitzung, deren Frage in der Mitte steht oder gerade laeuft. Beim Einstieg
 * mit der Themenuebersicht ist nichts markiert — die aktive Sitzung bleibt
 * im Hintergrund die, in der die naechste Frage landet.
 *
 * D2: Die erste Frage einer neuen Sitzung laeuft, bevor der Server eine
 * Sitzungskennung vergeben hat. Damit sie sofort als „laeuft" in der Chronik
 * steht, zeigt die Liste bis dahin eine vorlaeufige Sitzung („Neue Sitzung",
 * nicht umbenennbar); sobald die Kennung da ist, laedt die App die Liste
 * nach und die echte Sitzung tritt an ihre Stelle.
 */

import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { SitzungEintrag, istGewaehlt } from './sitzung-eintrag'
import type { AktiveSitzung, ChronikFrage, ChronikSitzung, StoryAuswahl } from './types'

/** Kennung der vorlaeufigen Sitzung — kein Chat auf dem Server, nur Darstellung. */
export const VORLAEUFIGE_SITZUNG = 'vorlaeufig'

export interface SitzungenListeProps {
  sitzungen: ChronikSitzung[]
  aktiveSitzung: AktiveSitzung
  auswahl: StoryAuswahl
  ladend: boolean
  fehler: string | null
  onFragenLaden: (chatId: string) => void
  onFrageWaehlen: (chatId: string, frage: ChronikFrage) => void
  onUmbenennen: (chatId: string, titel: string) => Promise<void>
  onNeueSitzung: () => void
}

export function SitzungenListe({
  sitzungen,
  aktiveSitzung,
  auswahl,
  ladend,
  fehler,
  onFragenLaden,
  onFrageWaehlen,
  onUmbenennen,
  onNeueSitzung,
}: SitzungenListeProps) {
  const { t } = useTranslation()
  // Von Hand auf- oder zugeklappte Sitzungen; von selbst offen ist nur die hervorgehobene.
  const [geklappt, setGeklappt] = useState<Record<string, boolean>>({})

  function fragenVon(sitzung: ChronikSitzung): ChronikFrage[] {
    return sitzung.chatId === aktiveSitzung.chatId ? aktiveSitzung.fragen : (sitzung.fragen ?? [])
  }

  /** Eine Frage der Sitzung steht in der Mitte oder laeuft gerade. */
  function istHervorgehoben(sitzung: ChronikSitzung): boolean {
    return fragenVon(sitzung).some((frage) => frage.offen || istGewaehlt(auswahl, frage))
  }

  function istOffen(sitzung: ChronikSitzung): boolean {
    return geklappt[sitzung.chatId] ?? istHervorgehoben(sitzung)
  }

  function oeffnen(chatId: string, offen: boolean) {
    setGeklappt((v) => ({ ...v, [chatId]: offen }))
    if (offen && chatId !== aktiveSitzung.chatId) onFragenLaden(chatId)
  }

  const vorlaeufig: ChronikSitzung | null =
    aktiveSitzung.chatId === null && aktiveSitzung.fragen.length > 0
      ? { chatId: VORLAEUFIGE_SITZUNG, titel: t('story.newSession'), createdAt: aktiveSitzung.fragen[0].createdAt, fragen: aktiveSitzung.fragen }
      : null

  return (
    <section aria-label={t('story.myQuestions')} className="space-y-1">
      <div className="flex items-center justify-between px-2 pt-2">
        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{t('story.myQuestions')}</h3>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onNeueSitzung}>
          <Plus className="h-3.5 w-3.5" />
          {t('story.newSession')}
        </Button>
      </div>

      {fehler && <p className="px-2 text-xs text-destructive">{t('story.sessionsLoadError', { error: fehler })}</p>}
      {ladend && sitzungen.length === 0 && (
        <p className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> {t('common.loading')}
        </p>
      )}
      {!ladend && !fehler && sitzungen.length === 0 && !vorlaeufig && (
        <p className="px-2 text-xs text-muted-foreground">{t('story.noSessions')}</p>
      )}

      <ul className="space-y-0.5">
        {vorlaeufig && (
          <SitzungEintrag
            sitzung={vorlaeufig}
            hervorgehoben
            offen
            auswahl={auswahl}
            onOeffnen={() => undefined}
            onFrageWaehlen={onFrageWaehlen}
            onUmbenennen={onUmbenennen}
            umbenennbar={false}
          />
        )}
        {sitzungen.map((sitzung) => {
          const istAktiv = sitzung.chatId === aktiveSitzung.chatId
          const anzeige = istAktiv ? { ...sitzung, fragen: aktiveSitzung.fragen } : sitzung
          return (
            <SitzungEintrag
              key={sitzung.chatId}
              sitzung={anzeige}
              hervorgehoben={istHervorgehoben(sitzung)}
              offen={istOffen(sitzung)}
              auswahl={auswahl}
              onOeffnen={oeffnen}
              onFrageWaehlen={onFrageWaehlen}
              onUmbenennen={onUmbenennen}
            />
          )
        })}
      </ul>
    </section>
  )
}
