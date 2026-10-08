'use client'

import { Button } from '@ks/ui'
import { Settings2, ChevronLeft, PanelLeft, BookOpen } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { PerspectiveDisplay } from '@/components/library/shared/perspective-display'
import { useSetAtom } from 'jotai'
import { storyPerspektiveDialogOffenAtom } from '@/atoms/story-perspektive-dialog-atom'

interface StoryHeaderProps {
  /** Wenn true, werden Border und Padding entfernt (für sticky Header) */
  compact?: boolean
  /** Callback für Zurück-zur-Gallery Button */
  onBackToGallery?: () => void
  /** D4: Menue-Knopf unter `lg`, oeffnet die Chronik als Sheet; ohne Rueckruf kein Knopf. */
  onOpenChronik?: () => void
  /** D12r: oeffnet auf dem Telefon die Quellen (Blatt); ab md steht die Leiste rechts. */
  onOpenQuellen?: () => void
}

/**
 * Header-Komponente für den Story-Modus.
 * 
 * Enthält:
 * - Button "Eigene Perspektive anpassen" und daneben die Perspektive als Plaketten (D9);
 *   beide oeffnen den Perspektiv-Dialog (09.10.2026, vorher eine eigene Seite)
 * - Button "Zurück zur Gallery" (optional)
 */
export function StoryHeader({ compact = false, onBackToGallery, onOpenChronik, onOpenQuellen }: StoryHeaderProps) {
  const { t } = useTranslation()
  const perspektiveOeffnen = useSetAtom(storyPerspektiveDialogOffenAtom)

  function handleAdjustPerspective() {
    perspektiveOeffnen(true)
  }

  return (
    <div className={`flex flex-col gap-2 flex-shrink-0 min-w-0 ${compact ? '' : 'pb-4 border-b'}`}>

      {/* Knoepfe: unter md nur Symbole, der Text als Tooltip (D12s, Owner 04.10.: die Zeile wurde rechts abgeschnitten). */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 min-w-0 w-full">
        {/* D4: Chronik (Themen, Meine Fragen) mobil als Sheet — nur unter lg,
            auf dem Desktop steht sie als Spalte links. */}
        {onOpenChronik && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenChronik}
            className="flex items-center gap-2 shrink-0 lg:hidden"
            aria-label={t('story.chronik.open')}
            title={t('story.chronik.open')}
          >
            <PanelLeft className="h-4 w-4" />
            <span className="hidden whitespace-nowrap md:inline">{t('story.chronik.open')}</span>
          </Button>
        )}
        {/* D12r: Quellen auf dem Telefon als Blatt — ab md steht die Leiste rechts. */}
        {onOpenQuellen && (
          <Button variant="outline" size="sm" onClick={onOpenQuellen} className="flex items-center gap-2 shrink-0 md:hidden" aria-label={t('gallery.sources')} title={t('gallery.sources')}>
            <BookOpen className="h-4 w-4" />
            <span className="hidden whitespace-nowrap md:inline">{t('gallery.sources')}</span>
          </Button>
        )}
        {/* Zurück-Button - vor Perspektive-Button */}
        {onBackToGallery && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBackToGallery}
            className="flex items-center gap-2 shrink-0"
            aria-label={t('gallery.backToGallery')}
            title={t('gallery.backToGallery')}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden whitespace-nowrap md:inline">{t('gallery.backToGallery')}</span>
          </Button>
        )}

        {/* Perspektive-Button - oeffnet den Perspektiv-Dialog */}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 shrink-0"
          onClick={handleAdjustPerspective}
          aria-label={t('gallery.storyMode.perspective.adjustPerspective')}
          title={t('gallery.storyMode.perspective.adjustPerspective')}
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <span className="hidden whitespace-nowrap md:inline">{t('gallery.storyMode.perspective.adjustPerspective')}</span>
        </Button>
        {/* D9: Perspektive als Plaketten, Klick oeffnet wie der Knopf den Dialog */}
        <PerspectiveDisplay variant="header" onClick={handleAdjustPerspective} />
      </div>
    </div>
  )
}

