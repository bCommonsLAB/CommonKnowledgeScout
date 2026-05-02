'use client'

/**
 * Composer-Fassade fuer StoryTopics.
 *
 * Exportiert StoryTopics und StoryTopicsProps unter denselben Namen
 * wie das Original story-topics.tsx. Konsumenten muessen keine Imports aendern.
 *
 * Struktur:
 *   index.tsx (Composer)
 *     ↓
 *   topic-list.tsx  — Accordion-Liste aller Topics
 *   topic-card.tsx  — Einzelnes Topic mit Fragen-Buttons
 */

import { useMemo, useState, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, BookOpen, Bug, User } from 'lucide-react'
import type { StoryTopicsData, StoryQuestion } from '@/types/story-topics'
import { AIGeneratedNotice } from '@/components/shared/ai-generated-notice'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { useTranslation } from '@/lib/i18n/hooks'
import { librariesAtom } from '@/atoms/library-atom'
import type { AnswerLength, Retriever, TargetLanguage, SocialContext, Character, AccessPerspective, LlmModelId } from '@/lib/chat/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { QueryDetailsDialog } from '@/components/library/chat/query-details-dialog'
import { ProcessingStatus } from '@/components/library/chat/processing-status'
import { useUser } from '@clerk/nextjs'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { AppLogo } from '@/components/shared/app-logo'
import { characterColors, characterIconColors } from '@/lib/chat/constants'
import { TopicList } from './topic-list'

interface CachedTOC {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[]
  accessPerspective?: AccessPerspective[]
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
  queryId?: string
  llmModel?: LlmModelId
}

interface StoryConfig {
  headline?: string
  intro?: string
  topicsTitle?: string
  topicsIntro?: string
}

export interface StoryTopicsProps {
  libraryId: string
  data?: StoryTopicsData | null
  onSelectQuestion?: (question: StoryQuestion) => void
  visible?: boolean
  isLoading?: boolean
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[]
  accessPerspective?: AccessPerspective[]
  socialContext?: SocialContext
  queryId?: string
  filters?: Record<string, unknown>
  llmModel?: LlmModelId
  cachedTOC?: CachedTOC | null
  showReloadButton?: boolean
  onRegenerate?: () => Promise<void>
  isRegenerating?: boolean
  processingSteps?: ChatProcessingStep[]
  questionText?: string
  docCount?: number
  docType?: string
}

/**
 * Komponente fuer die Themen\u00fcbersicht im Story-Modus.
 *
 * Laedt die Story-Texte aus der Config und zeigt die Themenuebersicht
 * mit klickbaren Fragen an.
 */
export function StoryTopics({
  libraryId,
  data,
  onSelectQuestion,
  visible = true,
  isLoading = false,
  queryId,
  cachedTOC,
  showReloadButton = false,
  onRegenerate,
  isRegenerating = false,
  processingSteps = [],
  questionText,
  docCount,
  docType,
  answerLength,
  retriever,
  targetLanguage,
  character,
  accessPerspective,
  socialContext,
  filters,
  llmModel,
}: StoryTopicsProps) {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const [showDetails, setShowDetails] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const accordionRef = useRef<HTMLDivElement>(null)
  const libraries = useAtomValue(librariesAtom)

  // Verwende ersten Character-Wert fuer Farben (falls vorhanden)
  const characterValue = cachedTOC?.character && cachedTOC.character.length > 0 ? cachedTOC.character[0] : undefined
  const bgColor = characterValue ? characterColors[characterValue] : 'bg-background border'
  const iconColor = characterValue ? characterIconColors[characterValue] : 'bg-primary/10 text-primary'

  const tocQuestion = questionText || (docCount !== undefined && docType
    ? t('chatMessages.topicsOverviewIntro', { count: docCount, type: t(`gallery.${docType}`) })
    : 'Inhaltsverzeichnis')

  // Lese Story-Config direkt aus State statt API-Call
  const storyConfig = useMemo<StoryConfig | null>(() => {
    const library = libraries.find((lib) => lib.id === libraryId)
    return library?.config?.publicPublishing?.story || null
  }, [libraries, libraryId])

  const topicsData = data
  const topicsTitle = storyConfig?.topicsTitle || data?.title
  const topicsIntro = storyConfig?.topicsIntro || data?.intro

  // Bewusstes Conditional-Render: verstecktes Accordion (visible=false → null ohne Indikator)
  if (!visible) return null

  // Filtere nur TOC-relevante Processing-Steps
  const tocProcessingSteps = processingSteps.filter(
    (step) =>
      step.type === 'cache_check' ||
      step.type === 'cache_check_complete' ||
      isLoading ||
      isRegenerating,
  )

  const isProcessing = isLoading || isRegenerating || tocProcessingSteps.length > 0
  const shouldRender = topicsData || cachedTOC || isProcessing

  // Bewusstes Conditional-Render: kein TOC-Daten und keine Berechnung aktiv → null
  if (!shouldRender) return null

  const handleAccordionValueChange = (value: string | undefined) => {
    setIsOpen(value === 'toc')
  }

  const isCurrentlyOpen = isOpen || isProcessing

  if (isProcessing && !isOpen) {
    setIsOpen(true)
  }

  return (
    <div ref={accordionRef} data-conversation-id="toc" className="mb-4">
      <Accordion
        type="single"
        collapsible
        value={isCurrentlyOpen ? 'toc' : undefined}
        onValueChange={handleAccordionValueChange}
      >
        <AccordionItem value="toc" className="border-b">
          <div className="flex items-center gap-2 relative">
            <AccordionTrigger className="px-0 py-3 hover:no-underline flex-1 min-w-0 pr-10">
              <div className="flex gap-3 items-center flex-1 min-w-0">
                {/* User-Icon — blau wie bei anderen Fragen */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${iconColor} flex items-center justify-center transition-colors`}>
                    <User className="h-4 w-4" />
                  </div>
                </div>
                {/* Frage-Text */}
                <div className={`flex-1 min-w-0 ${bgColor} border rounded-lg p-3 cursor-pointer hover:opacity-80 transition-all text-left`}>
                  <div className="text-sm whitespace-pre-wrap break-words">{tocQuestion}</div>
                </div>
              </div>
            </AccordionTrigger>
          </div>

          {/* Antwort-Bereich */}
          <AccordionContent className="px-0 pb-4">
            <div className="space-y-4 pt-2">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <AppLogo
                    size={32}
                    fallback={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Processing-Status waehrend Berechnung */}
                  {isProcessing && (
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">{t('chatMessages.processing')}</div>
                      {(cachedTOC || answerLength || retriever || targetLanguage || llmModel) && (
                        <div className="mt-2">
                          <ChatConfigDisplay
                            libraryId={libraryId}
                            answerLength={cachedTOC?.answerLength || answerLength}
                            retriever={cachedTOC?.retriever || retriever}
                            targetLanguage={cachedTOC?.targetLanguage || targetLanguage}
                            character={cachedTOC?.character || character}
                            accessPerspective={cachedTOC?.accessPerspective || accessPerspective}
                            socialContext={cachedTOC?.socialContext || socialContext}
                            llmModel={cachedTOC?.llmModel || llmModel}
                            filters={cachedTOC?.facetsSelected || filters}
                          />
                        </div>
                      )}
                      {tocProcessingSteps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <ProcessingStatus steps={tocProcessingSteps} isActive={isLoading || isRegenerating} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* TOC-Inhalt */}
                  {topicsData && (
                    <div className="space-y-6">
                      <div className="prose prose-sm max-w-none space-y-4 mb-6">
                        <div className="space-y-2">
                          {topicsTitle && (
                            <div className="flex items-center justify-between gap-2">
                              <h2 className="text-2xl font-bold m-0">{topicsTitle}</h2>
                              {showReloadButton && onRegenerate && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={onRegenerate}
                                        disabled={isRegenerating || isLoading}
                                        className="flex-shrink-0 gap-2"
                                      >
                                        {isRegenerating ? (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="hidden sm:inline">Neuberechnung...</span>
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="h-4 w-4" />
                                            <span className="hidden sm:inline">TOC neu berechnen</span>
                                          </>
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{t('gallery.storyMode.reloadTooltip')}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          )}
                          {topicsIntro && (
                            <p className="text-base text-muted-foreground leading-relaxed">{topicsIntro}</p>
                          )}
                        </div>
                      </div>

                      {/* Topic-Liste als eigene Sub-Komponente */}
                      <TopicList data={topicsData} onSelectQuestion={onSelectQuestion} />

                      <AIGeneratedNotice compact />

                      {/* Config-Anzeige + Debug-Button */}
                      <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-border/50">
                        <div className="flex-1 min-w-0">
                          <ChatConfigDisplay
                            libraryId={libraryId}
                            queryId={queryId}
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
                        {queryId && isSignedIn && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDetails(true)}
                            className="h-6 text-xs text-muted-foreground hover:text-foreground"
                            title="Zeigt technische Debug-Informationen zur Query"
                          >
                            <Bug className="h-3 w-3 mr-1" />
                            Debug
                          </Button>
                        )}
                      </div>

                      {/* Quellenverzeichnis-Button — nur auf Mobile sichtbar */}
                      <div className="lg:hidden pt-4">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
                            const event = new CustomEvent('show-toc-references', {
                              detail: { libraryId },
                            })
                            window.dispatchEvent(event)
                          }}
                          className="w-full gap-2"
                        >
                          <BookOpen className="h-4 w-4" />
                          {t('gallery.tocReferences')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {queryId && (
        <QueryDetailsDialog
          open={showDetails}
          onOpenChange={setShowDetails}
          libraryId={libraryId}
          queryId={queryId}
        />
      )}
    </div>
  )
}
