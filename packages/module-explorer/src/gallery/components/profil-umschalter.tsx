'use client'

import { Sparkles, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { cn } from '@ks/util'
import { useGalerieProfil } from '../hooks/use-galerie-profil'
import type { GalerieProfil } from '../lib/galerie-profil'

export interface ProfilUmschalterProps {
  libraryId?: string
}

/**
 * Umschalter „Einfach | Experte" (Plan galerie-buergeransicht, G1), für alle
 * sichtbar. Schreibt `?ansicht=` in die Adresse. Owner-Regel 08.10.: unter
 * lg nur Symbol, Text im Tooltip.
 */
export function ProfilUmschalter({ libraryId }: ProfilUmschalterProps) {
  const { t } = useTranslation()
  const { profil, setzen } = useGalerieProfil(libraryId)
  const segmente: Array<{ wert: GalerieProfil; label: string; Icon: typeof Sparkles }> = [
    { wert: 'gefuehrt', label: t('gallery.profil.einfach', { defaultValue: 'Einfach' }), Icon: Sparkles },
    { wert: 'experte', label: t('gallery.profil.experte', { defaultValue: 'Experte' }), Icon: SlidersHorizontal },
  ]
  return (
    <div
      role="group"
      aria-label={t('gallery.profil.umschalter', { defaultValue: 'Ansicht: einfach oder für Experten' })}
      className="inline-flex shrink-0 items-center rounded-full border bg-background p-0.5"
    >
      {segmente.map(({ wert, label, Icon }) => {
        const aktiv = profil === wert
        return (
          <button
            key={wert}
            type="button"
            onClick={() => { if (!aktiv) setzen(wert) }}
            aria-pressed={aktiv}
            title={label}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors',
              aktiv ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden lg:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
