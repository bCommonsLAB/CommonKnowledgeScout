'use client'

/**
 * Kopf des Story-Modus fuer Montagepunkte ohne eigenen Story-Kopf (D6b, Embed;
 * D10b nach Figma „Schritt 7"; D12p): nur die Ansichtszeile „Story-Modus"
 * mit ⓘ-Erklaerung, rechts „Zurueck zu den Inhalten", die Knoepfe fuer
 * Chronik (Sheet, D4) und Quellen (Telefon, D12r). Kein Kopf der Seite mehr:
 * Die Themenuebersicht bringt ihren eigenen Titel mit (Owner 04.10.). Die
 * Perspektive bekommt einen Knopf, wenn der Montagepunkt sie zur Wahl stellt
 * (`perspektive`, Embed mit `enablePerspective`, 09.10.); sonst gilt die
 * Konfig der Library.
 */

import { BookOpen, ChevronLeft, PanelLeft, Settings2, Sparkles } from 'lucide-react'
import { AnsichtsZeile, Button, useAnsichtErklaerung } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { PerspektivePlaketten } from './perspektive/perspektive-plaketten'
import type { PerspektivWahl } from './perspektive/regeln'

export interface StoryKopfzeileProps {
  onBackToGallery: () => void
  onOpenChronik?: () => void
  /** D12r: oeffnet auf dem Telefon die Quellen (Blatt); ab md steht die Leiste rechts. */
  onOpenQuellen?: () => void
  /** Erklaerung der Ansicht (Konfig `story.headline/intro` der Library); sonst die Uebersetzung. */
  erklaerung?: { titel?: string; text?: string }
  /** Perspektive zur Wahl: Knopf „Perspektive anpassen" und die Wahl als Plaketten (ab xl). */
  perspektive?: { wahl: PerspektivWahl; onOpen: () => void }
}

export function StoryKopfzeile({ onBackToGallery, onOpenChronik, onOpenQuellen, erklaerung, perspektive }: StoryKopfzeileProps) {
  const { t } = useTranslation()
  const zustand = useAnsichtErklaerung('story')
  const werkzeuge = (
    <>
      {onOpenChronik && (
        <Button variant="outline" size="sm" onClick={onOpenChronik} className="gap-2 lg:hidden" aria-label={t('story.chronik.open')} title={t('story.chronik.open')}>
          <PanelLeft className="h-4 w-4" />
          <span className="hidden whitespace-nowrap md:inline">{t('story.chronik.open')}</span>
        </Button>
      )}
      {onOpenQuellen && (
        <Button variant="outline" size="sm" onClick={onOpenQuellen} className="gap-2 md:hidden" aria-label={t('gallery.sources')} title={t('gallery.sources')}>
          <BookOpen className="h-4 w-4" />
          <span className="hidden whitespace-nowrap md:inline">{t('gallery.sources')}</span>
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={onBackToGallery} className="gap-2" aria-label={t('gallery.backToGallery')} title={t('gallery.backToGallery')}>
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden whitespace-nowrap md:inline">{t('gallery.backToGallery')}</span>
      </Button>
      {perspektive && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={perspektive.onOpen}
            className="gap-2"
            aria-label={t('gallery.storyMode.perspective.adjustPerspective')}
            title={t('gallery.storyMode.perspective.adjustPerspective')}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden whitespace-nowrap lg:inline">{t('gallery.storyMode.perspective.adjustPerspective')}</span>
          </Button>
          <PerspektivePlaketten wahl={perspektive.wahl} className="hidden max-w-[18rem] xl:flex" />
        </>
      )}
    </>
  )
  return (
    <div className="border-b py-2" data-story-kopfzeile>
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
