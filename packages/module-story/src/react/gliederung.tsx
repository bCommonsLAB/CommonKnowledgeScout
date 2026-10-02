'use client'

/**
 * Linke Spalte, obere Ebene: die Gliederung aus der Themenuebersicht.
 *
 * Beim Einstieg ZU (die Themen stehen in der Mitte). Sobald in der Mitte ein
 * Thema gewaehlt ist, klappt sie auf und markiert es — das ist die
 * Orientierung. Die Fragen stehen NUR in der Mitte, nie hier (Owner 01.10.).
 */

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, LayoutList, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import type { StoryAuswahl } from './types'
import type { UebersichtAktion } from './atoms'

export interface GliederungProps {
  gliederung: StoryTopicsData | null
  auswahl: StoryAuswahl
  onUebersicht: () => void
  onThema: (themaId: string) => void
  /** D11a: „Themenuebersicht neu berechnen" als dezenter Knopf rechts in der Zeile; ohne Angabe kein Knopf. */
  neuBerechnen?: UebersichtAktion | null
}

/** Thema, das die Auswahl markiert — direkt gewaehlt oder Herkunft einer Frage. */
export function aktivesThema(auswahl: StoryAuswahl): string | null {
  if (auswahl.art === 'thema') return auswahl.themaId
  if (auswahl.art === 'konversation') return auswahl.themaId ?? null
  return null
}

export function Gliederung({ gliederung, auswahl, onUebersicht, onThema, neuBerechnen }: GliederungProps) {
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
      <div className={cn('flex items-center gap-1 rounded-md pr-1', auswahl.art === 'uebersicht' && 'bg-muted text-foreground')}>
        <button
          type="button"
          onClick={onUebersicht}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium hover:bg-muted"
          aria-current={auswahl.art === 'uebersicht' ? 'page' : undefined}
        >
          <LayoutList className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{t('story.topicsOverview')}</span>
        </button>
        {neuBerechnen && (
          <button
            type="button"
            onClick={neuBerechnen.neuBerechnen}
            disabled={neuBerechnen.laeuft}
            aria-label={neuBerechnen.laeuft ? t('story.recomputing') : t('story.recompute')}
            title={neuBerechnen.laeuft ? t('story.recomputing') : t('story.recompute')}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-60"
          >
            {neuBerechnen.laeuft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

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
