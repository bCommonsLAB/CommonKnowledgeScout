'use client'

import { Star } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { cn } from '@ks/util'
import { useGalleryNavigation } from '../contexts/gallery-navigation-context'
import { useFokusZahlen } from '../hooks/use-fokus-zahlen'
import { fokusAktiv, fokusUmschalten } from './fokus-filter-button'

export interface FokusUmschalterProps {
  libraryId?: string
  /** Typ, der aus Liste und Zahlen bleibt (oeffentliche Slug-Galerie: `website`). */
  excludeDetailViewType?: string
}

/**
 * Umschalter „Im Fokus · N | Alle · M“ (G2) fuer das geführte Profil. Beide
 * Segmente sind echte Adressen: Fokus setzt `starred=1&sort=stars`, Alle
 * nimmt beides weg (dieselbe Logik wie der Knopf „Im Fokus“ der Experten).
 */
export function FokusUmschalter({ libraryId, excludeDetailViewType }: FokusUmschalterProps) {
  const { t } = useTranslation()
  const { params, pushParams } = useGalleryNavigation()
  const aktiv = fokusAktiv(params)
  const zahlen = useFokusZahlen(libraryId, { enabled: Boolean(libraryId), excludeDetailViewType })
  const wechseln = (zielFokus: boolean) => {
    if (zielFokus === aktiv) return
    pushParams(fokusUmschalten(params))
  }
  const segment = (label: string, zahl: number | null, istFokus: boolean) => {
    const an = istFokus === aktiv
    return (
      <button
        type="button"
        onClick={() => wechseln(istFokus)}
        aria-pressed={an}
        title={label}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
          an ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {istFokus && <Star className={cn('h-3.5 w-3.5', an && 'fill-current')} aria-hidden />}
        <span>{label}</span>
        {zahl !== null && (
          <span className={cn('rounded-full px-1.5 text-xs tabular-nums', an ? 'bg-primary-foreground/20' : 'bg-muted')}>{zahl}</span>
        )}
      </button>
    )
  }
  return (
    <div
      role="group"
      aria-label={t('gallery.fokus.umschalter', { defaultValue: 'Im Fokus oder alle Einträge' })}
      className="inline-flex shrink-0 items-center rounded-full border bg-background p-0.5"
    >
      {segment(t('gallery.favorites.fokusFilter', { defaultValue: 'Im Fokus' }), zahlen.fokus, true)}
      {segment(t('gallery.fokus.alle', { defaultValue: 'Alle' }), zahlen.alle, false)}
    </div>
  )
}
