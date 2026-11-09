'use client'

/**
 * Kopfzeile der Story-Karte links: Plakette mit dem Stand der Sitzung
 * („Bereit" / „N Fragen in dieser Sitzung") und daneben — wenn die Sektion
 * einen Facettenfilter traegt (`filter="year=2026"`) — der Filter-Chip. Der
 * Chip ist Information, kein Schalter: Besucher sollen sehen, dass der Chat
 * nur einen Ausschnitt der Library befragt (Owner 09.11.2026, SFSCON).
 */

import { Filter } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import type { GalleryFilters } from '@ks/contracts'
import { storyFilterBeschriftung } from '@/lib/website/story-filter'

export interface StoryStatusProps {
  /** Zahl der Frage-Antwort-Paare der Sitzung. */
  anzahl: number
  filter?: GalleryFilters
}

export function StoryStatus({ anzahl, filter }: StoryStatusProps) {
  const { t } = useTranslation()
  const stand = anzahl === 0 ? t('website.story.bereit') : anzahl === 1 ? t('website.story.fragenInSitzung.one') : t('website.story.fragenInSitzung.many', { count: anzahl })
  const beschriftung = filter && Object.keys(filter).length > 0 ? storyFilterBeschriftung(filter) : null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--site-accent)]" aria-hidden="true" />
        {stand}
      </span>
      {beschriftung && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--site-accent)] bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700"
          data-story-filter={beschriftung}
          title={t('website.story.filterHinweis')}
        >
          <Filter className="h-3 w-3 text-[color:var(--site-accent-strong)]" aria-hidden="true" />
          {t('website.story.filterNur', { filter: beschriftung })}
        </span>
      )}
    </div>
  )
}
