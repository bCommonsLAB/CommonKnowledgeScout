/**
 * Chat-Verlauf aus der Fragenliste (D6, Plan `story-dreiteilung-fragenchronik`).
 *
 * `GET …/queries?chatId=` liefert seit D6 je Frage alles, was eine
 * Nachricht braucht (Antwort, Belege, Anschlussfragen, cacheParams,
 * Kurztitel). Bis D5 holte der Verlauf jede Frage einzeln nach (N+1) und
 * nur 20 je Sitzung — ein `q=` auf eine aeltere Frage fand nichts.
 *
 * Reine Funktion: Themenuebersicht und unbeantwortete Eintraege fallen weg
 * (wie vorher: nur Eintraege mit Antwort-Text), chronologisch sortiert.
 */

import type { ChatResponse } from '@/types/chat-response'
import type { AccessPerspective, AnswerLength, Character, LlmModelId, Retriever, SocialContext, TargetLanguage } from '@/lib/chat/constants'
import type { GalleryFilters } from '@ks/contracts'
import { createMessagesFromQueryLog, type ChatMessage } from './chat-utils'

/** Hoechstzahl, die die Liste liefert (Server-Grenze). */
export const VERLAUF_LIMIT = 100

/** Ein Eintrag der Fragenliste, wie `listRecentQueries` ihn projiziert. */
export interface VerlaufEintrag {
  queryId: string
  question: string
  shortTitle?: string
  createdAt: string
  answer?: string
  queryType?: string
  references?: unknown[]
  suggestedQuestions?: unknown[]
  answerLength?: string
  retriever?: string
  targetLanguage?: string
  character?: Character[]
  accessPerspective?: AccessPerspective[]
  socialContext?: string
  genderInclusive?: boolean
  facetsSelected?: Record<string, unknown>
  cacheParams?: {
    queryType?: string
    answerLength?: AnswerLength
    retriever?: Retriever
    targetLanguage?: TargetLanguage
    character?: Character[]
    accessPerspective?: AccessPerspective[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    facetsSelected?: Record<string, unknown>
    llmModel?: LlmModelId
  }
}

function istReferenz(r: unknown): r is ChatResponse['references'][number] {
  return typeof r === 'object' && r !== null && 'number' in r && 'fileId' in r && 'description' in r
}

/** Nachrichten des Verlaufs aus der Liste — Frage und Antwort je Eintrag, chronologisch. */
export function verlaufZuNachrichten(items: VerlaufEintrag[]): ChatMessage[] {
  const nachrichten: ChatMessage[] = []
  for (const item of items) {
    if (typeof item.answer !== 'string') continue
    // cacheParams (neue Eintraege) vor Root-Feldern (alte Eintraege)
    const queryType = item.cacheParams?.queryType ?? item.queryType
    if (queryType === 'toc') continue
    const references = Array.isArray(item.references) ? item.references.filter(istReferenz) : []
    const suggestedQuestions = Array.isArray(item.suggestedQuestions)
      ? item.suggestedQuestions.filter((q): q is string => typeof q === 'string')
      : []
    nachrichten.push(
      ...createMessagesFromQueryLog({
        queryId: item.queryId,
        question: item.question,
        shortTitle: typeof item.shortTitle === 'string' ? item.shortTitle : undefined,
        answer: item.answer,
        references: references.length > 0 ? references : undefined,
        suggestedQuestions: suggestedQuestions.length > 0 ? suggestedQuestions : undefined,
        createdAt: item.createdAt,
        answerLength: (item.cacheParams?.answerLength ?? item.answerLength) as AnswerLength | undefined,
        retriever: (item.cacheParams?.retriever ?? item.retriever) as Retriever | undefined,
        targetLanguage: (item.cacheParams?.targetLanguage ?? item.targetLanguage) as TargetLanguage | undefined,
        character: item.cacheParams?.character ?? item.character,
        accessPerspective: item.cacheParams?.accessPerspective ?? item.accessPerspective,
        socialContext: (item.cacheParams?.socialContext ?? item.socialContext) as SocialContext | undefined,
        genderInclusive: item.cacheParams?.genderInclusive ?? item.genderInclusive,
        facetsSelected: (item.cacheParams?.facetsSelected ?? item.facetsSelected) as GalleryFilters | undefined,
        cacheParams: item.cacheParams,
      }),
    )
  }
  nachrichten.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return nachrichten
}
