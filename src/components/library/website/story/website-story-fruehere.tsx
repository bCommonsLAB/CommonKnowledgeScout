'use client'

/**
 * Verweis unter der Antwort der Story-Sektion: „N fruehere Fragen dieser
 * Sitzung im Story-Modus" (Owner 08.11.2026 — die Startseite zeigt nur das
 * juengste Paar, die Chronik liegt im Story-Modus). Das Ziel loest
 * `kartenaktion` wie bei den Kacheln: Site-Modus Rueckruf ohne Neuladen,
 * Root-Modus Adresse; Mittelklick und Kontextmenue folgen dem `href`.
 */

import { useTranslation } from '@ks/i18n/react'
import { kartenaktion } from '@/lib/website/kartenziel'
import { istPlainClick } from '@/components/library/website/section-cards'
import type { WebsiteStoryNavigation } from './website-story-belege'

export interface StoryFruehereFragenProps {
  /** Zahl der aelteren Paare der Sitzung; bei 0 wird nichts gezeigt. */
  fruehere: number
  navigation: WebsiteStoryNavigation
}

export function StoryFruehereFragen({ fruehere, navigation }: StoryFruehereFragenProps) {
  const { t } = useTranslation()
  if (fruehere <= 0) return null
  const ziel = kartenaktion({ art: 'story' }, navigation)
  const wechsel = ziel.ausfuehren
  return (
    <p className="mt-3 text-xs text-neutral-500" data-story-fruehere-fragen>
      <a
        href={ziel.href}
        className="underline decoration-neutral-300 underline-offset-2 hover:text-[color:var(--site-accent-strong)]"
        onClick={wechsel ? (e) => { if (istPlainClick(e)) { e.preventDefault(); wechsel() } } : undefined}
      >
        {fruehere === 1 ? t('website.story.fruehereFragen.one') : t('website.story.fruehereFragen.many', { count: fruehere })}
      </a>
    </p>
  )
}
