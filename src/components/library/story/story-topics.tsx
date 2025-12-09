'use client'

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
import type { AnswerLength, Retriever, TargetLanguage, SocialContext, Character, AccessPerspective } from '@/lib/chat/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { QueryDetailsDialog } from '@/components/library/chat/query-details-dialog'
import { ProcessingStatus } from '@/components/library/chat/processing-status'
import { useUser } from '@clerk/nextjs'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { AppLogo } from '@/components/shared/app-logo'
import { characterColors, characterIconColors } from '@/lib/chat/constants'

interface CachedTOC {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
  accessPerspective?: AccessPerspective[] // Array (kann leer sein)
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
  queryId?: string
}

interface StoryTopicsProps {
  libraryId: string
  data?: StoryTopicsData | null
  onSelectQuestion?: (question: StoryQuestion) => void
  visible?: boolean
  isLoading?: boolean
  // Config-Parameter für Anzeige und Neugenerierung
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
  accessPerspective?: AccessPerspective[] // Array (kann leer sein)
  socialContext?: SocialContext
  queryId?: string // QueryId für Filterparameter-Anzeige
  filters?: Record<string, unknown> // Optional: Filterparameter direkt übergeben
  cachedTOC?: CachedTOC | null // Optional: CachedTOC mit Parametern aus Cache
  showReloadButton?: boolean // Zeigt an, ob Reload-Button angezeigt werden soll (bei Parameteränderungen)
  onRegenerate?: () => Promise<void> // Callback für Reload-Button
  isRegenerating?: boolean // Loading-State für Regenerierung
  processingSteps?: ChatProcessingStep[] // Optional: Verarbeitungsschritte für vereinfachte User-Logs
  // Frage-Text für das Accordion (z.B. "Aufgrund deiner Perspektive...")
  questionText?: string
  // Anzahl der Dokumente für den Frage-Text
  docCount?: number
  docType?: string
}

interface StoryConfig {
  headline?: string
  intro?: string
  topicsTitle?: string
  topicsIntro?: string
}

/**
 * Komponente für die Themenübersicht im Story-Modus.
 * 
 * Lädt die Story-Texte aus der Config und zeigt die Themenübersicht
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
}: StoryTopicsProps) {
  const { t } = useTranslation()
  const { isSignedIn } = useUser()
  const [showDetails, setShowDetails] = useState(false)
  const [isOpen, setIsOpen] = useState(true) // Standardmäßig geöffnet
  const accordionRef = useRef<HTMLDivElement>(null)
  const libraries = useAtomValue(librariesAtom)
  
  // Verwende ersten Character-Wert für Farben (falls vorhanden)
  const characterValue = cachedTOC?.character && cachedTOC.character.length > 0 ? cachedTOC.character[0] : undefined
  const bgColor = characterValue ? characterColors[characterValue] : 'bg-background border'
  const iconColor = characterValue ? characterIconColors[characterValue] : 'bg-primary/10 text-primary'
  
  // Frage-Text: Verwende übergebenen Text oder generiere aus Übersetzung
  const tocQuestion = questionText || (docCount !== undefined && docType 
    ? t('chatMessages.topicsOverviewIntro', { count: docCount, type: t(`gallery.${docType}`) })
    : 'Inhaltsverzeichnis')
  
  // Lese Story-Config direkt aus State statt API-Call
  const storyConfig = useMemo<StoryConfig | null>(() => {
    const library = libraries.find(lib => lib.id === libraryId)
    return library?.config?.publicPublishing?.story || null
  }, [libraries, libraryId])
  
  // Verwende nur echte Daten, keine Placeholder
  const topicsData = data

  // Verwende Texte aus Config oder Daten, keine Fallbacks
  const topicsTitle = storyConfig?.topicsTitle || data?.title
  const topicsIntro = storyConfig?.topicsIntro || data?.intro

  if (!visible) return null

  // Filtere Processing-Steps: Nur TOC-spezifische Steps anzeigen
  // TOC-spezifische Steps sind: cache_check, cache_check_complete, oder Steps während TOC-Berechnung
  const tocProcessingSteps = processingSteps.filter(step => 
    step.type === 'cache_check' || 
    step.type === 'cache_check_complete' ||
    (isLoading || isRegenerating) // Während TOC-Berechnung: alle Steps zeigen
  )
  
  // WICHTIG: Rendere das Accordion IMMER, wenn:
  // 1. Daten vorhanden sind (topicsData oder cachedTOC) ODER
  // 2. Eine TOC-Berechnung läuft (isLoading, isRegenerating oder TOC-spezifische Steps vorhanden)
  // Dies stellt sicher, dass die Processing-Infos im Accordion angezeigt werden, nicht außerhalb
  const isProcessing = isLoading || isRegenerating || tocProcessingSteps.length > 0
  const shouldRender = topicsData || cachedTOC || isProcessing
  
  if (!shouldRender) {
    return null
  }

  // Handler für Accordion-Value-Änderungen
  const handleAccordionValueChange = (value: string | undefined) => {
    const shouldBeOpen = value === 'toc'
    setIsOpen(shouldBeOpen)
  }
  
  // Während der Berechnung sollte das Accordion geöffnet bleiben
  // Öffne automatisch, wenn Berechnung läuft
  const isCurrentlyOpen = isOpen || isProcessing
  
  // Aktualisiere isOpen, wenn Berechnung startet
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
            {/* Frage mit blauem User-Icon - wie bei anderen Fragen */}
            {/* Mehr Platz rechts (pr-10) damit die Frage nicht mit eventuellen Buttons überlappt */}
            <AccordionTrigger className="px-0 py-3 hover:no-underline flex-1 min-w-0 pr-10">
              <div className="flex gap-3 items-center flex-1 min-w-0">
                {/* User-Icon - blau wie bei anderen Fragen */}
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full ${iconColor} flex items-center justify-center transition-colors`}>
                    <User className="h-4 w-4" />
                  </div>
                </div>
                
                {/* Frage-Text mit Hintergrundfarbe - linksbündig */}
                <div className={`flex-1 min-w-0 ${bgColor} border rounded-lg p-3 cursor-pointer hover:opacity-80 transition-all text-left`}>
                  <div className="text-sm whitespace-pre-wrap break-words">{tocQuestion}</div>
                </div>
              </div>
            </AccordionTrigger>
          </div>
          
          {/* Antwort mit Logo - wie bei anderen Antworten */}
          <AccordionContent className="px-0 pb-4">
            <div className="space-y-4 pt-2">
              {/* Logo neben der Antwort */}
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <AppLogo 
                    size={32} 
                    fallback={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {/* Während der Berechnung: Zeige Processing-Logs wie bei normalen Fragen */}
                  {/* Zeige Processing-Logs wenn Berechnung läuft */}
                  {isProcessing && (
                    <div className="bg-muted/30 border rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">{t('chatMessages.processing')}</div>
                      {/* Konfigurationsparameter während der Berechnung anzeigen */}
                      {/* Verwende cachedTOC oder Props für Config-Display */}
                      {(cachedTOC || answerLength || retriever || targetLanguage) && (
                        <div className="mt-2">
                          <ChatConfigDisplay
                            libraryId={libraryId}
                            answerLength={cachedTOC?.answerLength || answerLength}
                            retriever={cachedTOC?.retriever || retriever}
                            targetLanguage={cachedTOC?.targetLanguage || targetLanguage}
                            character={cachedTOC?.character || character}
                            accessPerspective={cachedTOC?.accessPerspective || accessPerspective}
                            socialContext={cachedTOC?.socialContext || socialContext}
                            filters={cachedTOC?.facetsSelected || filters}
                          />
                        </div>
                      )}
                      {/* Processing Steps - dezent innerhalb des Blocks */}
                      {/* Nur TOC-spezifische Steps anzeigen, nicht Steps von normalen Fragen */}
                      {tocProcessingSteps.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <ProcessingStatus steps={tocProcessingSteps} isActive={isLoading || isRegenerating} />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* TOC-Inhalt - nur anzeigen wenn Daten vorhanden sind */}
                  {topicsData && (
                    <div className="space-y-6">
              {/* Themenübersicht - Titel und Intro */}
              <div className="prose prose-sm max-w-none space-y-4 mb-6">
                <div className="space-y-2">
                  {topicsTitle && (
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-2xl font-bold m-0">{topicsTitle}</h2>
                      {/* Reload-Button oben rechts */}
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

                  {/* Accordion mit Themen - nur anzeigen wenn topicsData vorhanden ist */}
                  {topicsData && topicsData.topics && topicsData.topics.length > 0 && (
                  <Accordion type="single" collapsible className="w-full border rounded-lg">
                    {topicsData.topics.map((topic) => (
                      <AccordionItem key={topic.id} value={topic.id} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline">
                          <div className="flex flex-col items-start text-left">
                            <span className="font-medium">{topic.title}</span>
                            {topic.summary && (
                              <span className="text-xs text-muted-foreground mt-1">{topic.summary}</span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-2 mt-2">
                            {topic.questions.map((question) => (
                              <Button
                                key={question.id}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-left h-auto py-2 text-xs bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 whitespace-normal break-words"
                                onClick={() => onSelectQuestion?.(question)}
                              >
                                <span className="text-left">{question.text}</span>
                              </Button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  )}
                  
                      {/* KI-Info-Hinweis für KI-generiertes Inhaltsverzeichnis */}
                      <AIGeneratedNotice compact />
                      
                      {/* Config-Anzeige unterhalb des TOC */}
                  <div className="flex items-center justify-between gap-4 pt-4 mt-4 border-t border-border/50">
                    {/* Config-Anzeige */}
                    <div className="flex-1 min-w-0">
                      <ChatConfigDisplay
                        libraryId={libraryId}
                        queryId={queryId}
                        // Verwende Parameter aus cachedTOC, falls vorhanden (direkt aus Cache)
                        answerLength={cachedTOC?.answerLength}
                        retriever={cachedTOC?.retriever}
                        targetLanguage={cachedTOC?.targetLanguage}
                        character={cachedTOC?.character}
                        accessPerspective={cachedTOC?.accessPerspective}
                        socialContext={cachedTOC?.socialContext}
                        filters={cachedTOC?.facetsSelected}
                      />
                    </div>
                    
                    {/* Debug-Button nur für eingeloggte Benutzer und wenn queryId vorhanden */}
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

                      {/* Quellenverzeichnis-Button - nur auf Mobile sichtbar */}
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
      
      {/* Query Details Dialog - außerhalb des Accordions */}
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
