'use client'

/**
 * Kopf des Story-Modus fuer Montagepunkte ohne eigenen Story-Kopf (D6b, Embed):
 * Zurueck zu den Inhalten, mobil der Knopf fuer die Chronik (Sheet, D4),
 * optional Ueberschrift und Einleitung aus der Konfig. Die Perspektive hat
 * hier keinen Knopf — im Embed kommt sie aus der Konfig der Library.
 */

import { ChevronLeft, PanelLeft } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'

export interface StoryKopfzeileProps {
  onBackToGallery: () => void
  onOpenChronik?: () => void
  ueberschrift?: string
  einleitung?: string
}

export function StoryKopfzeile({ onBackToGallery, onOpenChronik, ueberschrift, einleitung }: StoryKopfzeileProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2 border-b py-2" data-story-kopfzeile>
      {(ueberschrift || einleitung) && (
        <div className="space-y-1">
          {ueberschrift && <h2 className="text-2xl font-bold">{ueberschrift}</h2>}
          {einleitung && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{einleitung}</p>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {onOpenChronik && (
          <Button variant="outline" size="sm" onClick={onOpenChronik} className="gap-2 lg:hidden" aria-label={t('story.chronik.open')}>
            <PanelLeft className="h-4 w-4" />
            <span className="whitespace-nowrap">{t('story.chronik.open')}</span>
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onBackToGallery} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          <span className="whitespace-nowrap">{t('gallery.backToGallery')}</span>
        </Button>
      </div>
    </div>
  )
}
