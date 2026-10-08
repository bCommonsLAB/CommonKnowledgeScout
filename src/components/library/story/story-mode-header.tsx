'use client'

import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { AnsichtsZeile, useAnsichtErklaerung } from '@ks/ui'
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
 * Kopf des Story-Modus (D10b nach Figma „Schritt 7"; D12p, Owner 04.10.):
 * nur die Ansichtszeile „Story-Modus" mit ⓘ und rechts den Knoepfen des
 * `StoryHeader` (Themen und Fragen, Quellen, Zurueck, Perspektive). ⓘ klappt
 * die Erklaerung der Ansicht auf (Konfig `story.headline/intro`, sonst
 * Uebersetzung); beim ersten Besuch ist sie offen, der Browser merkt sich „zu".
 *
 * Den Kopf der Seite (Titel und Zweizeiler der Library) gibt es im
 * Story-Modus NICHT mehr: Die Themenuebersicht bringt ihren eigenen Titel
 * mit, und ueber allem steht ohnehin der Kopf der Erkunden-Seite — drei
 * Ueberschriften uebereinander. Mit dem Kopf faellt auch das Ein- und
 * Ausblenden beim Scrollen weg (und der Rand unten, den es hinterliess).
 */
export function StoryModeHeader({ libraryId, onBackToGallery, onOpenChronik, onOpenQuellen }: StoryModeHeaderProps) {
  const { t } = useTranslation()
  const libraries = useLibraries()
  const erklaerung = useAnsichtErklaerung('story')

  const texte = useMemo(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    const pub = library?.config?.publicPublishing
    return {
      erklaerungTitel: pub?.story?.headline || t('ansicht.storyErklaerungTitel'),
      erklaerungText: pub?.story?.intro || t('gallery.storyMode.description'),
    }
  }, [libraries, libraryId, t])

  return (
    <div className="sticky top-0 z-20 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b">
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
        werkzeuge={<StoryHeader compact onBackToGallery={onBackToGallery} onOpenChronik={onOpenChronik} onOpenQuellen={onOpenQuellen} />}
      />
    </div>
  )
}
