/**
 * Typen fuer use-chat-toc Hook.
 *
 * Ausgegliedert als eigenes Modul fuer:
 * - Testbarkeit ohne DOM-Umgebung
 * - Trennung von Typen und Implementierung
 *
 * Welle 3-III-b: Pure-Typen-Extraktion (keine Logik-Aenderung).
 */

import type { StoryTopicsData } from '@/types/story-topics'
import type { ChatResponse } from '@/types/chat-response'
import type {
  TargetLanguage,
  Character,
  SocialContext,
  AnswerLength,
  Retriever,
  AccessPerspective,
  LlmModelId,
} from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'

/** Gecachte TOC-Daten mit Query-Parametern */
export interface CachedTOC {
  answer: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId: string
  createdAt: string
  // Parameter aus Query, damit sie direkt verwendet werden koennen
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: Character[] // Array (kann leer sein)
  accessPerspective?: AccessPerspective[]
  socialContext?: SocialContext
  facetsSelected?: Record<string, unknown>
  llmModel?: LlmModelId
}

/** Eingabe-Parameter fuer den useChatTOC Hook */
export interface UseChatTOCParams {
  libraryId: string
  cfg: { config: unknown } | null
  targetLanguage: TargetLanguage
  character: Character[] // Array (kann leer sein)
  socialContext: SocialContext
  genderInclusive: boolean
  galleryFilters?: GalleryFilters
  isEmbedded: boolean
  isSending: boolean
  sendQuestion?: (
    question: string,
    retriever?: 'chunk' | 'doc' | 'summary' | 'auto',
    isTOCQuery?: boolean,
    asTOC?: boolean,
    skipQueryCache?: boolean
  ) => Promise<void>
  setProcessingSteps?: React.Dispatch<React.SetStateAction<import('@/types/chat-processing').ChatProcessingStep[]>>
}

/** Rueckgabe-Objekt des useChatTOC Hooks */
export interface UseChatTOCResult {
  cachedStoryTopicsData: StoryTopicsData | null
  cachedTOC: CachedTOC | null
  isCheckingTOC: boolean
  isGeneratingTOC: boolean
  generateTOC: () => Promise<void>
  forceRegenerateTOC: () => Promise<void>
  checkCache: () => Promise<void>
  setTOCData: (data: {
    storyTopicsData?: StoryTopicsData
    answer: string
    references: ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    character?: Character[]
    accessPerspective?: AccessPerspective[]
    socialContext?: SocialContext
    facetsSelected?: Record<string, unknown>
    llmModel?: LlmModelId
  }) => void
}
