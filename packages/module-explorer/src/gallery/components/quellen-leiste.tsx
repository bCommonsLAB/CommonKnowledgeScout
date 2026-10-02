'use client'

/**
 * Quellen als fliegendes Verzeichnis (D11b, Figma „Schritt 8"): Eingeklappt
 * ist die rechte Spalte eine schmale Leiste mit Pfeil, Symbol und Zaehler —
 * „610 Quellen" ohne Antwort, nach einer Antwort der blaue Zaehler der
 * Belege („4"), der aufmerksam macht, ohne sich aufzudraengen. Ein Klick
 * klappt die Spalte auf; der Browser merkt sich auf/zu (`useQuellenOffen`).
 * Beim Einstieg ist sie zu (Owner 02.10.: „nimmt ungefragt Platz weg").
 */

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'

export const QUELLEN_OFFEN_KEY = 'story-quellen-offen'

export interface QuellenOffenZustand {
  offen: boolean
  toggle: () => void
}

/** Ob die Quellenspalte offen ist; beim Einstieg zu, der Browser merkt sich „auf". */
export function useQuellenOffen(): QuellenOffenZustand {
  const [offen, setOffen] = useState(false)
  useEffect(() => {
    try {
      setOffen(localStorage.getItem(QUELLEN_OFFEN_KEY) === 'true')
    } catch (error) {
      console.warn('[useQuellenOffen] localStorage nicht lesbar, Quellen bleiben zu:', error)
    }
  }, [])
  const toggle = useCallback(() => {
    setOffen((vorher) => {
      const neu = !vorher
      try {
        if (neu) localStorage.setItem(QUELLEN_OFFEN_KEY, 'true')
        else localStorage.removeItem(QUELLEN_OFFEN_KEY)
      } catch (error) {
        console.warn('[useQuellenOffen] localStorage nicht schreibbar, Zustand gilt nur fuer diese Seite:', error)
      }
      return neu
    })
  }, [])
  return { offen, toggle }
}

export interface QuellenLeisteProps {
  /** Zahl auf der Leiste: Belege der aktiven Antwort oder Quellen im Bestand. */
  zaehler: number
  /** `true`: der Zaehler meint Belege einer Antwort (blau, macht aufmerksam). */
  belege: boolean
  onOeffnen: () => void
  /** Offen: die Leiste bleibt unsichtbar stehen, damit die Spaltenbreiten exakt gleich bleiben. */
  unsichtbar?: boolean
}

const rund =
  'inline-flex h-7 w-7 items-center justify-center rounded-full border border-input bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

export function QuellenLeiste({ zaehler, belege, onOeffnen, unsichtbar = false }: QuellenLeisteProps) {
  const { t } = useTranslation()
  const label = belege ? t('story.beleg.title') : t('gallery.sources')
  return (
    <aside
      className={cn('flex w-14 shrink-0 flex-col items-center gap-3 rounded-md border bg-background py-3', unsichtbar && 'invisible')}
      aria-label={`${zaehler} ${label}`}
      aria-hidden={unsichtbar || undefined}
      data-story-quellen-leiste={unsichtbar ? 'unsichtbar' : 'sichtbar'}
    >
      <button type="button" onClick={onOeffnen} className={rund} aria-label={t('story.leiste.oeffnen')} title={t('story.leiste.oeffnen')}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      {belege ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground" data-belege-zaehler>
          {zaehler}
        </span>
      ) : (
        <>
          <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-semibold tabular-nums">{zaehler}</span>
        </>
      )}
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground" style={{ writingMode: 'vertical-rl' }}>
        {label}
      </span>
    </aside>
  )
}

/** Runder Pfeil oben in der aufgeklappten Spalte: klappt sie ein. */
export function QuellenEinklappen({ onClick, className }: { onClick: () => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} className={cn(rund, className)} aria-label={t('story.leiste.schliessen')} title={t('story.leiste.schliessen')}>
      <ChevronRight className="h-4 w-4" />
    </button>
  )
}
