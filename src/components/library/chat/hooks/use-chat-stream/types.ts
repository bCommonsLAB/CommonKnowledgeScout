/**
 * Typen fuer use-chat-stream Hook.
 *
 * Ausgegliedert als eigenes Modul, damit:
 * - reducer.ts die Typen importieren kann ohne den Hook zu importieren
 * - Konsumenten nur Typen importieren koennen ohne den vollen Hook
 *
 * Welle 3-III-b: Pure-Typen-Extraktion (keine Logik-Aenderung).
 */

import type { ChatProcessingStep } from '@/types/chat-processing'
import type { ChatMessage } from '../../utils/chat-utils'
import type { ChatResponse } from '@/types/chat-response'
import type { StoryTopicsData } from '@/types/story-topics'
import type {
  AnswerLength,
  Retriever,
  TargetLanguage,
  Character,
  SocialContext,
  AccessPerspective,
  LlmModelId,
} from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'

/** Eingabe-Parameter fuer den useChatStream Hook */
export interface UseChatStreamParams {
  libraryId: string
  cfg: {
    config: {
      maxChars?: number
      maxCharsWarningMessage?: string
    }
  } | null
  messages: ChatMessage[]
  activeChatId: string | null
  retriever: Retriever
  answerLength: AnswerLength
  targetLanguage: TargetLanguage
  character: Character[] // Array (kann leer sein)
  accessPerspective: AccessPerspective[] // Array (kann leer sein)
  socialContext: SocialContext
  genderInclusive: boolean
  llmModel: LlmModelId
  galleryFilters?: GalleryFilters
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setActiveChatId: (id: string | null) => void
  setOpenConversations: (convs: Set<string>) => void
  setChatReferences: (refs: { references: ChatResponse['references']; queryId?: string }) => void
  onTOCComplete?: (data: {
    storyTopicsData?: StoryTopicsData
    answer: string
    references: ChatResponse['references']
    suggestedQuestions: string[]
    queryId: string
  }) => void
  onError?: (error: string) => void
}

/** Rueckgabe-Objekt des useChatStream Hooks */
export interface UseChatStreamResult {
  isSending: boolean
  processingSteps: ChatProcessingStep[]
  sendQuestion: (
    questionText: string,
    retrieverOverride?: Retriever,
    isTOCQuery?: boolean,
    asTOC?: boolean,
    skipQueryCache?: boolean
  ) => Promise<void>
  setProcessingSteps: React.Dispatch<React.SetStateAction<ChatProcessingStep[]>>
}
