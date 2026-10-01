'use client'

/**
 * Die zitierten Textstellen eines Belegs (D7): je Stelle ein Zitat (gekuerzt)
 * und — wenn die Quelle Seitenanker hat — die Seite als Knopf, der das
 * Original dort aufschlaegt. Ohne Seite bleibt nur das Zitat.
 */

import { useTranslation } from '@ks/i18n/react'
import type { DocPassage } from '@ks/contracts'

export interface BelegTextstellenProps {
  passages: DocPassage[]
  onSeite: (page: number) => void
}

export function BelegTextstellen({ passages, onSeite }: BelegTextstellenProps) {
  const { t } = useTranslation()
  return (
    <ul className="space-y-1" data-beleg-textstellen>
      {passages.map((p, i) => (
        <li key={`${p.chunkIndex ?? i}-${p.page ?? ''}`} className="flex items-start gap-1.5 text-xs text-muted-foreground">
          {typeof p.page === 'number' ? (
            <button
              type="button"
              onClick={() => onSeite(p.page as number)}
              title={t('story.beleg.openAtPage', { page: p.page })}
              aria-label={t('story.beleg.openAtPage', { page: p.page })}
              className="shrink-0 rounded border px-1 font-medium text-foreground hover:bg-muted"
            >
              {t('story.beleg.pageShort', { page: p.page })}
            </button>
          ) : null}
          <span className="line-clamp-2 italic">{p.excerpt}</span>
        </li>
      ))}
    </ul>
  )
}
