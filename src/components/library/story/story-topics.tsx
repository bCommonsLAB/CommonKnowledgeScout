'use client'

import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import type { StoryTopicsData, StoryQuestion } from '@/types/story-topics'
import { AIGeneratedNotice } from '@/components/shared/ai-generated-notice'
import { ChatConfigDisplay } from '@/components/library/chat/chat-config-display'
import { AppLogo } from '@/components/shared/app-logo'
import { useTranslation } from '@/lib/i18n/hooks'
import { librariesAtom } from '@/atoms/library-atom'
import type { AnswerLength, Retriever, TargetLanguage, SocialContext, Character } from '@/lib/chat/constants'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CachedTOC {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
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
  socialContext?: SocialContext
  queryId?: string // QueryId für Filterparameter-Anzeige
  filters?: Record<string, unknown> // Optional: Filterparameter direkt übergeben
  cachedTOC?: CachedTOC | null // Optional: CachedTOC mit Parametern aus Cache
  showReloadButton?: boolean // Zeigt an, ob Reload-Button angezeigt werden soll (bei Parameteränderungen)
  onRegenerate?: () => Promise<void> // Callback für Reload-Button
  isRegenerating?: boolean // Loading-State für Regenerierung
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
}: StoryTopicsProps) {
  const { t } = useTranslation()
  const libraries = useAtomValue(librariesAtom)
  
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

  // Loading-State: Zeige Loading-Indikator
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('gallery.storyMode.generatingTopics')}</span>
        </div>
      </div>
    )
  }

  // Wenn keine Daten vorhanden: Zeige nichts (Placeholder nur für Entwicklung)
  if (!topicsData) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Themenübersicht - Titel und Intro */}
      <div className="prose prose-sm max-w-none space-y-4 mb-6">
        <div className="space-y-2">
          {topicsTitle && (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AppLogo size={24} fallback={<Sparkles className="h-5 w-5 text-primary" />} />
                <h2 className="text-2xl font-bold m-0">{topicsTitle}</h2>
              </div>
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

      {/* Accordion mit Themen */}
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
                    className="w-full justify-start text-left h-auto py-2 text-xs bg-transparent whitespace-normal break-words"
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
            socialContext={cachedTOC?.socialContext}
            filters={cachedTOC?.facetsSelected}
          />
        </div>
      </div>
    </div>
  )
}
