import type { ChatResponse } from '@/types/chat-response'
import type { Character, AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'

/**
 * Interface für Chat-Messages innerhalb des ChatPanels
 */
export interface ChatMessage {
  id: string
  type: 'question' | 'answer'
  content: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  queryId?: string
  createdAt: string
  character?: Character
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  socialContext?: SocialContext
}

/**
 * Interface für Conversation-Paare (Frage + Antwort)
 */
export interface ConversationPair {
  conversationId: string
  question: ChatMessage
  answer?: ChatMessage
}

/**
 * Erstellt ChatMessages aus QueryLog-Daten
 */
export function createMessagesFromQueryLog(queryLog: {
  queryId: string
  question: string
  answer?: string
  references?: ChatResponse['references']
  suggestedQuestions?: string[]
  createdAt: string | Date
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: string
  socialContext?: SocialContext
}): ChatMessage[] {
  const messages: ChatMessage[] = []
  
  // Frage als Message
  messages.push({
    id: `${queryLog.queryId}-question`,
    type: 'question',
    content: queryLog.question,
    createdAt: typeof queryLog.createdAt === 'string' ? queryLog.createdAt : queryLog.createdAt.toISOString(),
    queryId: queryLog.queryId,
    answerLength: queryLog.answerLength,
    retriever: queryLog.retriever,
    targetLanguage: queryLog.targetLanguage,
    character: queryLog.character as Character | undefined,
    socialContext: queryLog.socialContext,
  })
  
  // Antwort als Message (wenn vorhanden)
  if (queryLog.answer) {
    const refs: ChatResponse['references'] = Array.isArray(queryLog.references) ? queryLog.references : []
    const suggestedQuestions = Array.isArray(queryLog.suggestedQuestions)
      ? queryLog.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
      : []
      
    messages.push({
      id: `${queryLog.queryId}-answer`,
      type: 'answer',
      content: queryLog.answer,
      references: refs,
      suggestedQuestions,
      queryId: queryLog.queryId,
      createdAt: typeof queryLog.createdAt === 'string' ? queryLog.createdAt : queryLog.createdAt.toISOString(),
      answerLength: queryLog.answerLength,
      retriever: queryLog.retriever,
      targetLanguage: queryLog.targetLanguage,
      character: queryLog.character as Character | undefined,
      socialContext: queryLog.socialContext,
    })
  }
  
  return messages
}

/**
 * Gruppiert Messages zu Frage-Antwort-Paaren (Conversations)
 */
export function groupMessagesToConversations(messages: ChatMessage[]): ConversationPair[] {
  const conversations: ConversationPair[] = []
  
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    if (msg.type === 'question') {
      // Prüfe, ob die nächste Message eine Antwort ist
      const nextMsg = messages[i + 1]
      const conversationId = msg.queryId || msg.id.replace('-question', '') || `conv-${i}`
      
      conversations.push({
        conversationId,
        question: msg,
        answer: nextMsg && nextMsg.type === 'answer' ? nextMsg : undefined,
      })
      
      // Überspringe die Antwort-Message im nächsten Durchlauf
      if (nextMsg && nextMsg.type === 'answer') {
        i++
      }
    }
  }
  
  return conversations
}

