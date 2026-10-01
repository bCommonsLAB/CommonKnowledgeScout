'use client'

/**
 * Die Mitte des Story-Modus, solange keine Konversation gewaehlt ist (D1):
 * Kopf des Ganzen mit Themenkarten oder die Seite eines Themas.
 *
 * Die Bausteine kommen aus `@ks/module-story/react`; hier haengt die App
 * an, was das Paket nicht kennt: Konfig-Texte aus der Library, den
 * Rechen-Status der Themenuebersicht, „neu berechnen", KI-Hinweis,
 * Konfig-Anzeige und den Quellen-Knopf fuer Mobil. Ersetzt `StoryTopics`
 * im eingebetteten Chat-Panel; die alte Komponente faellt in D6.
 */

import { useEffect, useMemo } from 'react'
import { BookOpen, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { useLibraries } from '@ks/shell/react'
import type { StoryQuestion, StoryTopicsData } from '@ks/contracts'
import { STORY_UEBERSICHT, StoryThema, StoryUebersicht, type StoryAuswahl } from '@ks/module-story/react'
import { AIGeneratedNotice } from '@/components/shared/ai-generated-notice'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { ProcessingStatus } from '@/components/library/chat/processing-status'
import type { CachedTOC } from '@/components/library/chat/hooks/use-chat-toc/types'
import type { ChatProcessingStep } from '@/types/chat-processing'
import type { LlmModelId } from '@/lib/chat/constants'

export interface StoryMitteProps {
  libraryId: string
  gliederung: StoryTopicsData | null
  auswahl: StoryAuswahl
  setAuswahl: (auswahl: StoryAuswahl) => void
  dokumente: number
  isLoading: boolean
  isRegenerating: boolean
  processingSteps: ChatProcessingStep[]
  showReloadButton: boolean
  onRegenerate: () => Promise<void>
  cachedTOC: CachedTOC | null
  llmModel: LlmModelId
  /** Frage aus einem Thema gewaehlt — der Chat uebernimmt sie ins Eingabefeld. */
  onSelectQuestion: (frage: StoryQuestion) => void
}

export function StoryMitte({
  libraryId,
  gliederung,
  auswahl,
  setAuswahl,
  dokumente,
  isLoading,
  isRegenerating,
  processingSteps,
  showReloadButton,
  onRegenerate,
  cachedTOC,
  llmModel,
  onSelectQuestion,
}: StoryMitteProps) {
  const { t } = useTranslation()
  const libraries = useLibraries()

  // Konfig (publicPublishing): Label und Beschreibung fuer den Kopf, die
  // Story-Texte fuer die Karten. Fehlt ein Feld, faellt der Block weg.
  const kopf = useMemo(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    const pub = library?.config?.publicPublishing
    return {
      titel: pub?.publicName || library?.label || '',
      beschreibung: pub?.description || undefined,
      themenTitel: pub?.story?.topicsTitle || undefined,
      themenIntro: pub?.story?.topicsIntro || undefined,
    }
  }, [libraries, libraryId])

  const thema = auswahl.art === 'thema' ? gliederung?.topics.find((th) => th.id === auswahl.themaId) ?? null : null

  // Thema gewaehlt, aber nicht (mehr) in der Gliederung — etwa nach einer
  // Neuberechnung: zurueck zur Uebersicht, sichtbar statt leer.
  useEffect(() => {
    if (auswahl.art === 'thema' && gliederung && !thema) setAuswahl(STORY_UEBERSICHT)
  }, [auswahl, gliederung, thema, setAuswahl])

  if (thema) {
    return <StoryThema thema={thema} onFrageWaehlen={onSelectQuestion} onZurueck={() => setAuswahl(STORY_UEBERSICHT)} />
  }

  const rechnet = isLoading || isRegenerating || !gliederung
  const status = rechnet ? (
    <div className="bg-muted/30 border rounded-lg p-3">
      <div className="text-sm text-muted-foreground">{t('gallery.storyMode.generatingTopics')}</div>
      {processingSteps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <ProcessingStatus steps={processingSteps} isActive={isLoading || isRegenerating} einfach />
        </div>
      )}
    </div>
  ) : undefined

  const aktionen =
    showReloadButton && gliederung ? (
      <Button
        variant="outline"
        size="sm"
        onClick={() => void onRegenerate()}
        disabled={isRegenerating || isLoading}
        className="gap-2"
        title={t('gallery.storyMode.reloadTooltip')}
      >
        {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        <span className="hidden sm:inline">{isRegenerating ? t('story.recomputing') : t('story.recompute')}</span>
      </Button>
    ) : undefined

  const fuss = gliederung ? (
    <div className="space-y-4">
      <AIGeneratedNotice compact />
      <div className="pt-4 border-t border-border/50">
        <ChatConfigDisplay
          libraryId={libraryId}
          queryId={cachedTOC?.queryId}
          answerLength={cachedTOC?.answerLength}
          retriever={cachedTOC?.retriever}
          targetLanguage={cachedTOC?.targetLanguage}
          character={cachedTOC?.character}
          accessPerspective={cachedTOC?.accessPerspective}
          socialContext={cachedTOC?.socialContext}
          llmModel={cachedTOC?.llmModel ?? llmModel}
          filters={cachedTOC?.facetsSelected}
        />
      </div>
      {/* Quellenverzeichnis — nur auf Mobil, die Spalte rechts gibt es dort nicht (D4 ordnet das neu). */}
      <div className="lg:hidden">
        <Button
          variant="default"
          size="sm"
          className="w-full gap-2"
          onClick={() => window.dispatchEvent(new CustomEvent('show-toc-references', { detail: { libraryId } }))}
        >
          <BookOpen className="h-4 w-4" />
          {t('gallery.tocReferences')}
        </Button>
      </div>
    </div>
  ) : undefined

  return (
    <StoryUebersicht
      kopf={{ titel: kopf.titel, beschreibung: kopf.beschreibung }}
      gliederung={gliederung}
      dokumente={dokumente}
      themenTitel={kopf.themenTitel}
      themenIntro={kopf.themenIntro}
      onThemaWaehlen={(themaId) => setAuswahl({ art: 'thema', themaId })}
      status={status}
      aktionen={aktionen}
      fuss={fuss}
    />
  )
}
