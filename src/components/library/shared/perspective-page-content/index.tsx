'use client'

/**
 * Composer-Fassade fuer PerspectivePageContent.
 *
 * Exportiert `PerspectivePageContent` und `PerspectivePageContentProps`
 * unter denselben Namen wie das Original perspective-page-content.tsx.
 * Konsumenten muessen ihre Imports NICHT aendern.
 *
 * Struktur:
 *   index.tsx (Composer)
 *     ↓
 *   header.tsx       — Navigations-Header, Page-Header, Info-Banner
 *   body.tsx         — Auswahl-Cards + CTA
 *     ↓
 *   hooks/use-perspective-data.ts  — State- und Effekt-Logik
 *   helpers.ts                     — Pure-Helpers (localeToTargetLanguage, mapLlmModels, ...)
 */

import type { Character, AccessPerspective } from '@/lib/chat/constants'
import { PerspectiveHeader } from './header'
import { PerspectiveBody, PerspectiveCta } from './body'
import { usePerspectiveData } from './hooks/use-perspective-data'

// Props-Interface bleibt unveraendert (Abwaertskompatibilitaet)
export interface PerspectivePageContentProps {
  /** Library-Informationen */
  library: { id: string; label: string } | null
  /** Loading-Status fuer Library */
  libraryLoading: boolean
  /** Callback fuer Zurueck-Navigation */
  onBack: () => void
  /** Callback fuer Modus-Wechsel */
  onModeChange: (mode: 'gallery' | 'story') => void
  /** Callback fuer Speichern und Weiterleitung */
  onSave: () => void
  /** Ob die Seite vom Story Mode aufgerufen wurde */
  fromStoryMode?: boolean
}

/**
 * Gemeinsame Komponente fuer die Perspektivenauswahl-Seite.
 *
 * Wird sowohl von /explore/[slug]/perspective als auch von
 * /library/gallery/perspective verwendet.
 */
export function PerspectivePageContent({
  library,
  libraryLoading,
  onBack,
  onModeChange,
  onSave,
  fromStoryMode = false,
}: PerspectivePageContentProps) {
  const {
    form,
    models,
    sortedLanguages,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
    canProceed,
    handleLanguageChange,
    handleStart,
  } = usePerspectiveData()

  // Toggle-Handler fuer Interessenprofil-Auswahl (max. 5)
  function toggleInterest(value: Character) {
    if (form.localInterests.includes(value)) {
      const next = form.localInterests.filter((i) => i !== value)
      form.setLocalInterests(next.length === 0 ? ['undefined'] : next)
    } else {
      if (value === 'undefined') {
        form.setLocalInterests(['undefined'])
      } else {
        const withoutUndefined = form.localInterests.filter((i) => i !== 'undefined')
        if (withoutUndefined.length < 5) {
          form.setLocalInterests([...withoutUndefined, value])
        }
      }
    }
  }

  // Toggle-Handler fuer Zugangsperspektive-Auswahl (max. 5)
  function toggleAccessPerspective(value: AccessPerspective) {
    if (form.localAccessPerspective.includes(value)) {
      const next = form.localAccessPerspective.filter((ap) => ap !== value)
      form.setLocalAccessPerspective(next.length === 0 ? ['undefined'] : next)
    } else {
      if (value === 'undefined') {
        form.setLocalAccessPerspective(['undefined'])
      } else {
        const withoutUndefined = form.localAccessPerspective.filter((ap) => ap !== 'undefined')
        if (withoutUndefined.length < 5) {
          form.setLocalAccessPerspective([...withoutUndefined, value])
        }
      }
    }
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      <PerspectiveHeader
        library={library}
        libraryLoading={libraryLoading}
        fromStoryMode={fromStoryMode}
        onBack={onBack}
        onModeChange={onModeChange}
      />

      {/* Scrollbarer Content-Bereich */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6 md:p-10 pb-16 max-w-4xl mx-auto">
          <PerspectiveBody
            localLanguage={form.localLanguage}
            sortedLanguages={sortedLanguages}
            targetLanguageLabels={targetLanguageLabels}
            onLanguageChange={handleLanguageChange}
            localLlmModel={form.localLlmModel}
            filteredModels={models.filteredModels}
            modelsLoading={models.modelsLoading}
            modelAutoSwitched={models.modelAutoSwitched}
            onLlmModelChange={(v) => {
              form.setLocalLlmModel(v)
              // Synchron in Story Context uebernehmen (Modell-Aenderung sofort sichtbar)
            }}
            localInterests={form.localInterests}
            characterLabels={characterLabels}
            onToggleInterest={toggleInterest}
            localAccessPerspective={form.localAccessPerspective}
            accessPerspectiveLabels={accessPerspectiveLabels}
            onToggleAccessPerspective={toggleAccessPerspective}
            localLanguageStyle={form.localLanguageStyle}
            socialContextLabels={socialContextLabels}
            onLanguageStyleChange={form.setLocalLanguageStyle}
          />
          <PerspectiveCta
            canProceed={canProceed}
            onStart={() => handleStart(onSave)}
          />
        </div>
      </div>
    </div>
  )
}
