'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { AnsichtsZeile, useAnsichtErklaerung, useScrollVisibility } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { useLibraries } from '@ks/shell/react'
import { StoryHeader } from './story-header'

interface StoryModeHeaderProps {
  libraryId: string
  onBackToGallery?: () => void
  /** D4: oeffnet mobil die Chronik (Sheet); ohne Rueckruf kein Knopf. */
  onOpenChronik?: () => void
  /** D12r: oeffnet auf dem Telefon die Quellen (Blatt). */
  onOpenQuellen?: () => void
}

/**
 * Kopf der Seite im Story-Modus (Figma „Schritt 7 · Kopf fuer beide Ansichten", D10b).
 *
 * - Kopf der Seite: Titel und Zweizeiler der Library aus `publicPublishing`
 *   (`publicName`/`description`, sonst das Label) — in Galerie und Story gleich,
 *   beim Scrollen ausgeblendet (gleiche Scroll-Logik wie TopNav und Galerie).
 * - Ansichtszeile: „Story-Modus" mit ⓘ, rechts die Knoepfe des `StoryHeader`
 *   (Zurueck, Perspektive anpassen, Plaketten). ⓘ klappt die Erklaerung der
 *   Ansicht auf (Konfig `story.headline/intro`, sonst Uebersetzung); beim
 *   ersten Besuch ist sie offen, der Browser merkt sich „zu".
 */
export function StoryModeHeader({ libraryId, onBackToGallery, onOpenChronik, onOpenQuellen }: StoryModeHeaderProps) {
  const { t } = useTranslation()
  const libraries = useLibraries()
  const erklaerung = useAnsichtErklaerung('story')

  const texte = useMemo(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    const pub = library?.config?.publicPublishing
    return {
      titel: pub?.publicName || library?.label || '',
      zweizeiler: pub?.description || undefined,
      erklaerungTitel: pub?.story?.headline || t('ansicht.storyErklaerungTitel'),
      erklaerungText: pub?.story?.intro || t('gallery.storyMode.description'),
    }
  }, [libraries, libraryId, t])

  // isVisible === false bedeutet: Kopf der Seite ausblenden (condensed)
  const isVisible = useScrollVisibility()
  const isCondensed = !isVisible

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
      {/* Kopf der Seite - wird beim Scrollen ausgeblendet */}
      <div
        className={`transition-all duration-300 overflow-hidden ${
          isCondensed ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-96 opacity-100'
        }`}
        style={{
          willChange: isCondensed ? 'max-height, opacity' : 'auto',
          // Verhindere Layout-Shifts während Transition (robuster für ältere Geräte)
          contain: 'layout style paint',
        }}
      >
        <div className="py-4 space-y-1" data-story-seitenkopf>
          {texte.titel && <h2 className="text-2xl font-bold leading-tight">{texte.titel}</h2>}
          {texte.zweizeiler && <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{texte.zweizeiler}</p>}
        </div>
      </div>

      <AnsichtsZeile
        className="py-2"
        name={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t('ansicht.story')}
          </span>
        }
        erklaerung={{
          titel: texte.erklaerungTitel,
          text: texte.erklaerungText,
          offen: erklaerung.offen,
          onToggle: erklaerung.toggle,
          labels: { oeffnen: t('ansicht.erklaerungOeffnen'), schliessen: t('ansicht.erklaerungSchliessen') },
        }}
        werkzeuge={<StoryHeader compact onBackToGallery={onBackToGallery} onOpenChronik={onOpenChronik} onOpenQuellen={onOpenQuellen} libraryId={libraryId} />}
        eingeklappt={isCondensed}
      />
    </div>
  )
}
