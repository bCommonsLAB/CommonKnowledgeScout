'use client'

/**
 * Abschnitt „Antwortlaenge" im Dialog „Antworten anpassen" (Owner 24.11.2026): Die Laenge gehoert
 * zu dem, wie eine Antwort formuliert ist — sie steht deshalb hier und nicht mehr als eigene
 * Auswahl in der Fragebox der Startseite. Nur Gastgeber, die die Laenge fuehren, reichen sie herein.
 */

import { AlignLeft } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { ANTWORT_LAENGEN, type AntwortLaenge } from '../konversation/types'
import { Abschnitt, PlakettenWahl } from './abschnitt'

/** Gewaehlte Laenge und der Weg, sie zu aendern (wirksam beim Speichern des Dialogs). */
export interface AntwortLaengeWahl {
  wert: AntwortLaenge
  onWahl: (laenge: AntwortLaenge) => void
}

export function AntwortLaengeAbschnitt({ wert, onWahl }: AntwortLaengeWahl) {
  const { t } = useTranslation()
  return (
    <Abschnitt symbol={AlignLeft} titel={t('chat.perspectivePage.answerLengthSectionTitle')} hilfe={t('chat.perspectivePage.answerLengthSectionHelp')}>
      <div data-perspektive-antwortlaenge>
        <PlakettenWahl
          werte={ANTWORT_LAENGEN}
          label={(v) => t(`chat.answerLengthLabels.${v}`)}
          tooltip={(v) => t(`chat.answerLengthTooltips.${v}`)}
          gewaehlt={(v) => v === wert}
          onWahl={onWahl}
        />
      </div>
    </Abschnitt>
  )
}
