'use client'

/**
 * Linke Spalte, obere Ebene: die Gliederung aus der Themenuebersicht.
 *
 * Beim Einstieg ZU (die Themen stehen in der Mitte). Sobald in der Mitte ein
 * Thema gewaehlt ist, klappt sie auf und markiert es — das ist die
 * Orientierung. Die Fragen stehen NUR in der Mitte, nie hier (Owner 01.10.).
 */

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, LayoutList } from 'lucide-react'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import type { StoryAuswahl } from './types'

export interface GliederungProps {
  gliederung: StoryTopicsData | null
  auswahl: StoryAuswahl
  onUebersicht: () => void
  onThema: (themaId: string) => void
}

/** Thema, das die Auswahl markiert — direkt gewaehlt oder Herkunft einer Frage. */
export function aktivesThema(auswahl: StoryAuswahl): string | null {
  if (auswahl.art === 'thema') return auswahl.themaId
  if (auswahl.art === 'konversation') return auswahl.themaId ?? null
  return null
}

export function Gliederung({ gliederung, auswahl, onUebersicht, onThema }: GliederungProps) {
  const { t } = useTranslation()
  const [offen, setOffen] = useState(false)
  const aktiv = aktivesThema(auswahl)

  useEffect(() => {
    if (aktiv !== null) setOffen(true)
  }, [aktiv])

  const themen = gliederung?.topics ?? []
  const Pfeil = offen ? ChevronDown : ChevronRight

  return (
    <nav aria-label={t('story.topicsOverview')} className="space-y-1">
      <button
        type="button"
        onClick={onUebersicht}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted',
          auswahl.art === 'uebersicht' && 'bg-muted text-foreground',
        )}
        aria-current={auswahl.art === 'uebersicht' ? 'page' : undefined}
      >
        <LayoutList className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{t('story.topicsOverview')}</span>
      </button>

      {themen.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            aria-expanded={offen}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs uppercase tracking-wide text-muted-foreground hover:bg-muted"
          >
            <Pfeil className="h-3.5 w-3.5 shrink-0" />
            <span>{t('story.topics')}</span>
            <span className="ml-auto tabular-nums">{themen.length}</span>
          </button>
          {offen && (
            <ul className="ml-3 space-y-0.5 border-l pl-2">
              {themen.map((thema) => {
                const istAktiv = thema.id === aktiv
                return (
                  <li key={thema.id}>
                    <button
                      type="button"
                      onClick={() => onThema(thema.id)}
                      aria-current={istAktiv ? 'true' : undefined}
                      className={cn(
                        'w-full truncate rounded-md px-2 py-1 text-left text-sm hover:bg-muted',
                        istAktiv ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground',
                      )}
                      title={thema.title}
                    >
                      {thema.title}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </nav>
  )
}
