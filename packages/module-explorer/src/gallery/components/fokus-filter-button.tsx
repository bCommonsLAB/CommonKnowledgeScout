'use client'

import { Button } from '@ks/ui'
import { Star } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { cn } from '@ks/util'
import { useGalleryNavigation } from '../contexts/gallery-navigation-context'
import { useSterneSichtbar } from '../hooks/use-star-counts-public'

export interface FokusFilterButtonProps {
  libraryId?: string
}

/** Liest aus der Adresse, ob „Im Fokus" aktiv ist (`starred=1`). */
export function fokusAktiv(params: URLSearchParams | null | undefined): boolean {
  return params?.get('starred') === '1'
}

/**
 * Naechste Adresse beim Klick: an = `starred=1` und `sort=stars` zusammen
 * (die Rangliste, nicht nur die Menge); aus = beides weg, aber nur das
 * `sort=stars`, das der Knopf gesetzt hat — eine andere Sortierung bleibt.
 */
export function fokusUmschalten(params: URLSearchParams | null | undefined): URLSearchParams {
  const next = new URLSearchParams(params?.toString() ?? '')
  if (fokusAktiv(params)) {
    next.delete('starred')
    if (next.get('sort') === 'stars') next.delete('sort')
  } else {
    next.set('starred', '1')
    next.set('sort', 'stars')
  }
  return next
}

/**
 * Knopf „Im Fokus" (Welle F2, ADR 0012): zeigt alle Eintraege mit mindestens
 * einem Stern, absteigend nach Sternezahl — der Server filtert und sortiert
 * (`starred=1&sort=stars`). Sichtbar fuer Mitglieder immer, fuer Besucher
 * nur bei `starCountsPublic`. Owner-Regel 08.10.: unter lg nur Symbol.
 */
export function FokusFilterButton({ libraryId }: FokusFilterButtonProps) {
  const { t } = useTranslation()
  const { params, pushParams } = useGalleryNavigation()
  const { sterneSichtbar } = useSterneSichtbar(libraryId)
  if (!sterneSichtbar) return null

  const aktiv = fokusAktiv(params)
  const label = t('gallery.favorites.fokusFilter', { defaultValue: 'Im Fokus' })
  return (
    <Button
      variant={aktiv ? 'secondary' : 'ghost'}
      size="sm"
      type="button"
      onClick={() => pushParams(fokusUmschalten(params))}
      aria-pressed={aktiv}
      className={cn('h-7 px-2 shrink-0', aktiv && 'text-amber-700 dark:text-amber-300')}
      title={t('gallery.favorites.fokusFilterTooltip', {
        defaultValue: 'Einträge mit mindestens einem Stern, die meisten zuerst',
      })}
    >
      <Star className={cn('h-3.5 w-3.5 lg:mr-1', aktiv && 'fill-current')} aria-hidden />
      <span className="hidden lg:inline">{label}</span>
    </Button>
  )
}
