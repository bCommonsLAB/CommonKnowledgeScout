import type { QueryLog, QueryRetrievalStep } from '@/types/query-log'
import { insertQueryLog, appendRetrievalStep as repoAppend, updateQueryLogPartial } from '@/lib/db/queries-repo'

function redactPrompt(prompt: string): string {
  // einfache Geheimnis-Redaktion: API-Keys/Token-ähnliche Muster maskieren
  return prompt.replace(/[A-Za-z0-9_\-]{24,}/g, '***')
}

function clampSnippet(text: string | undefined, max = 300): string | undefined {
  if (!text) return undefined
  const t = String(text)
  return t.length > max ? t.slice(0, max) : t
}

export async function startQueryLog(context: {
  libraryId: string
  chatId: string // Required: chatId für Chat-Zuordnung
  userEmail?: string // Optional: für authentifizierte Nutzer
  sessionId?: string // Optional: für anonyme Nutzer
  question: string
  mode: QueryLog['mode']
  queryType?: QueryLog['queryType'] // 'toc' für Inhaltsverzeichnis, 'question' für normale Fragen
  answerLength?: QueryLog['answerLength']
  retriever?: QueryLog['retriever']
  targetLanguage?: QueryLog['targetLanguage']
  character?: QueryLog['character']
  accessPerspective?: QueryLog['accessPerspective']
  socialContext?: QueryLog['socialContext']
  genderInclusive?: QueryLog['genderInclusive']
  facetsSelected?: Record<string, unknown>
  filtersNormalized?: Record<string, unknown>
  documentCount?: number // Optional: Bereits berechnete Dokumentenanzahl (wird sonst in insertQueryLog berechnet)
}): Promise<string> {
  // Validierung: Entweder userEmail ODER sessionId muss vorhanden sein
  if (!context.userEmail && !context.sessionId) {
    throw new Error('Entweder userEmail oder sessionId muss angegeben werden')
  }
  
  return insertQueryLog({ ...context, status: 'pending' })
}

export async function appendRetrievalStep(queryId: string, step: QueryRetrievalStep): Promise<void> {
  // Snippets kürzen
  const safe: QueryRetrievalStep = {
    ...step,
    results: Array.isArray(step.results)
      ? step.results.map(r => ({ ...r, snippet: clampSnippet(r.snippet) }))
      : step.results,
  }
  await repoAppend(queryId, safe)
}

export function markStepStart(partial: Omit<QueryRetrievalStep, 'endedAt' | 'timingMs' | 'results'> & { startedAt?: Date }): QueryRetrievalStep {
  return { ...partial, startedAt: partial.startedAt || new Date() } as QueryRetrievalStep
}

export function markStepEnd(step: QueryRetrievalStep): QueryRetrievalStep {
  const endedAt = new Date()
  const timingMs = typeof step.startedAt?.getTime === 'function' ? Math.max(0, endedAt.getTime() - step.startedAt.getTime()) : step.timingMs
  return { ...step, endedAt, timingMs }
}

export async function setPrompt(
  queryId: string,
  payload: { provider: import('@/types/query-log').QueryPromptInfo['provider']; model: string; temperature?: number; prompt: string }
): Promise<void> {
  await updateQueryLogPartial(queryId, {
    prompt: {
      provider: payload.provider,
      model: payload.model,
      temperature: payload.temperature,
      prompt: redactPrompt(payload.prompt),
    },
  })
}

export async function finalizeQueryLog(queryId: string, payload: { answer: string; sources?: QueryLog['sources']; references?: QueryLog['references']; suggestedQuestions?: QueryLog['suggestedQuestions']; timing?: QueryLog['timing']; tokenUsage?: QueryLog['tokenUsage']; storyTopicsData?: QueryLog['storyTopicsData'] }): Promise<void> {
  await updateQueryLogPartial(queryId, { 
    status: 'ok', 
    answer: payload.answer, 
    sources: payload.sources, 
    references: payload.references,
    suggestedQuestions: payload.suggestedQuestions,
    timing: payload.timing, 
    tokenUsage: payload.tokenUsage,
    storyTopicsData: payload.storyTopicsData
  })
}

export async function failQueryLog(queryId: string, error: { message: string; stage?: string }): Promise<void> {
  await updateQueryLogPartial(queryId, { status: 'error', error })
}

export async function setQuestionAnalysis(
  queryId: string,
  analysis: import('@/types/query-log').QuestionAnalysisInfo
): Promise<void> {
  await updateQueryLogPartial(queryId, { questionAnalysis: analysis })
}




