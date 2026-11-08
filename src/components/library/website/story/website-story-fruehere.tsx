'use client'

/**
 * Verweis unter der Antwort der Story-Sektion: „N fruehere Fragen dieser
 * Sitzung im Story-Modus" (Owner 08.11.2026 — die Startseite zeigt nur das
 * juengste Paar, die Chronik liegt im Story-Modus). Das Ziel loest
 * `kartenaktion` wie bei den Kacheln: Site-Modus Rueckruf ohne Neuladen,
 * Root-Modus Adresse; Mittelklick und Kontextmenue folgen dem `href`.
 *
 * Der Story-Modus zeigt ohne `q` in der Adresse die Themenuebersicht
 * (`StoryAuswahlUrl`, D2). Damit der Leser bei der zuletzt verdeckten Frage
 * landet, traegt der Verweis `q=<queryId>` der juengsten frueheren,
 * beantworteten Frage — als Adresse und im Site-Modus ueber `nuqs`, bevor
 * der Modus wechselt.
 */

import { parseAsString, useQueryState } from 'nuqs'
import { useTranslation } from '@ks/i18n/react'
import type { FrageAntwort } from '@ks/module-story/react'
import { kartenaktion } from '@/lib/website/kartenziel'
import { juengsteFruehereKennung, sichtbaresPaar } from '@/lib/website/story-sichtbares-paar'
import { istPlainClick } from '@/components/library/website/section-cards'
import type { WebsiteStoryNavigation } from './website-story-belege'

export interface StoryFruehereFragenProps {
  /** Alle Paare der Sitzung (aelteste zuerst); bei hoechstens einem wird nichts gezeigt. */
  paare: FrageAntwort[]
  navigation: WebsiteStoryNavigation
}

export function StoryFruehereFragen({ paare, navigation }: StoryFruehereFragenProps) {
  const { t } = useTranslation()
  const [, setQ] = useQueryState('q', parseAsString)
  const { fruehere } = sichtbaresPaar(paare)
  if (fruehere <= 0) return null
  const kennung = juengsteFruehereKennung(paare)
  const ziel = kartenaktion({ art: 'story' }, navigation)
  const href = kennung ? `${ziel.href}${ziel.href.includes('?') ? '&' : '?'}q=${encodeURIComponent(kennung)}` : ziel.href
  const wechsel = ziel.ausfuehren
  return (
    <p className="mt-3 text-xs text-neutral-500" data-story-fruehere-fragen>
      <a
        href={href}
        className="underline decoration-neutral-300 underline-offset-2 hover:text-[color:var(--site-accent-strong)]"
        onClick={
          wechsel
            ? (e) => {
                if (!istPlainClick(e)) return
                e.preventDefault()
                if (kennung) void setQ(kennung, { history: 'push' })
                wechsel()
              }
            : undefined
        }
      >
        {fruehere === 1 ? t('website.story.fruehereFragen.one') : t('website.story.fruehereFragen.many', { count: fruehere })}
      </a>
    </p>
  )
}
