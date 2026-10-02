'use client'

/**
 * Kopf des Story-Modus fuer Montagepunkte ohne eigenen Story-Kopf (D6b, Embed;
 * D10b nach Figma „Schritt 7"): Kopf der Seite (Ueberschrift und Einleitung
 * der Library aus der Konfig), darunter die Ansichtszeile „Story-Modus" mit
 * ⓘ-Erklaerung, rechts „Zurueck zu den Inhalten" und mobil der Knopf fuer
 * die Chronik (Sheet, D4). Die Perspektive hat hier keinen Knopf — im Embed
 * kommt sie aus der Konfig der Library.
 */

import { ChevronLeft, PanelLeft, Sparkles } from 'lucide-react'
import { AnsichtsZeile, Button, useAnsichtErklaerung } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'

export interface StoryKopfzeileProps {
  onBackToGallery: () => void
  onOpenChronik?: () => void
  ueberschrift?: string
  einleitung?: string
  /** Erklaerung der Ansicht (Konfig `story.headline/intro` der Library); sonst die Uebersetzung. */
  erklaerung?: { titel?: string; text?: string }
}

export function StoryKopfzeile({ onBackToGallery, onOpenChronik, ueberschrift, einleitung, erklaerung }: StoryKopfzeileProps) {
  const { t } = useTranslation()
  const zustand = useAnsichtErklaerung('story')
  const werkzeuge = (
    <>
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
    </>
  )
  return (
    <div className="space-y-2 border-b py-2" data-story-kopfzeile>
      {(ueberschrift || einleitung) && (
        <div className="space-y-1" data-seitenkopf>
          {ueberschrift && <h2 className="text-2xl font-bold leading-tight">{ueberschrift}</h2>}
          {einleitung && <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{einleitung}</p>}
        </div>
      )}
      <AnsichtsZeile
        name={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t('ansicht.story')}
          </span>
        }
        erklaerung={{
          titel: erklaerung?.titel || t('ansicht.storyErklaerungTitel'),
          text: erklaerung?.text || t('gallery.storyMode.description'),
          offen: zustand.offen,
          onToggle: zustand.toggle,
          labels: { oeffnen: t('ansicht.erklaerungOeffnen'), schliessen: t('ansicht.erklaerungSchliessen') },
        }}
        werkzeuge={werkzeuge}
      />
    </div>
  )
}
