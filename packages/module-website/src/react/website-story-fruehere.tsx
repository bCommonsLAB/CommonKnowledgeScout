'use client'

/**
 * Verweis unter der Antwort der Story-Sektion: „N fruehere Fragen dieser
 * Sitzung im Story-Modus" (Owner 08.11.2026 — die Startseite zeigt nur das
 * juengste Paar, die Chronik liegt im Story-Modus). Das Ziel loest
 * die Navigation-Schnittstelle (Ziel `story` mit `frage`) wie bei den
 * Kacheln: in der App Site-Modus Rueckruf ohne Neuladen, Root-Modus Adresse;
 * Mittelklick und Kontextmenue folgen dem `href`.
 *
 * Der Story-Modus zeigt ohne `q` in der Adresse die Themenuebersicht
 * (`StoryAuswahlUrl`, D2). Damit der Leser bei der zuletzt verdeckten Frage
 * landet, traegt der Verweis `q=<queryId>` der juengsten frueheren,
 * beantworteten Frage — im `href` und im Site-Modus als `extra` an
 * `onShowStory` (ein Adresswechsel, kein zweiter Schreiber neben dem Modus).
 */

import { useTranslation } from '@ks/i18n/react'
import type { FrageAntwort } from '@ks/module-story/react'
import { juengsteFruehereKennung, sichtbaresPaar, wegFehltMelden, type WebsiteNavigation } from '..'
import { WegLink } from './weg-link'

export interface StoryFruehereFragenProps {
  /** Alle Paare der Sitzung (aelteste zuerst); bei hoechstens einem wird nichts gezeigt. */
  paare: FrageAntwort[]
  navigation: WebsiteNavigation
}

export function StoryFruehereFragen({ paare, navigation }: StoryFruehereFragenProps) {
  const { t } = useTranslation()
  const { fruehere } = sichtbaresPaar(paare)
  if (fruehere <= 0) return null
  const kennung = juengsteFruehereKennung(paare)
  const weg = navigation.weg({ art: 'story', frage: kennung ?? undefined })
  if (weg === null) {
    wegFehltMelden('Story-Modus hat in dieser Seite keine Adresse — Verweis „fruehere Fragen" entfaellt')
    return null
  }
  return (
    <p className="mt-3 text-xs text-neutral-500" data-story-fruehere-fragen>
      <WegLink
        weg={weg}
        className="underline decoration-neutral-300 underline-offset-2 hover:text-[color:var(--site-accent-strong)]"
      >
        {fruehere === 1 ? t('website.story.fruehereFragen.one') : t('website.story.fruehereFragen.many', { count: fruehere })}
      </WegLink>
    </p>
  )
}
