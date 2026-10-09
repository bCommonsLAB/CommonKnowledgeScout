'use client'

/**
 * Die gewaehlte Perspektive als Plaketten in einer Zeile — Interessen,
 * Zugaenge, Sprachstil; „nicht festgelegt" erscheint nicht. Die Zeile bricht
 * nie um (Owner-Regel 08.10.): Was nicht passt, wird abgeschnitten, der
 * vollstaendige Text steht im `title`.
 */

import { Badge } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { gewaehlt, type PerspektivWahl } from './regeln'

export function PerspektivePlaketten({ wahl, className }: { wahl: PerspektivWahl; className?: string }) {
  const { t } = useTranslation()
  const texte = [
    ...gewaehlt(wahl.character).map((v) => t(`chat.characterLabels.${v}`)),
    ...gewaehlt(wahl.accessPerspective).map((v) => t(`chat.accessPerspectiveLabels.${v}`)),
    ...(wahl.socialContext !== 'undefined' ? [t(`chat.socialContextLabels.${wahl.socialContext}`)] : []),
  ]
  if (texte.length === 0) return null
  return (
    <span className={`flex min-w-0 items-center gap-1 overflow-hidden ${className ?? ''}`} title={texte.join(' · ')}>
      {texte.map((text) => (
        <Badge key={text} variant="secondary" className="shrink-0 whitespace-nowrap font-normal">
          {text}
        </Badge>
      ))}
    </span>
  )
}
