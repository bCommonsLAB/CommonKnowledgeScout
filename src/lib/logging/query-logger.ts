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
  userEmail: string
  question: string
  mode: QueryLog['mode']
  facetsSelected?: Record<string, unknown>
  filtersNormalized?: Record<string, unknown>
  filtersPinecone?: Record<string, unknown>
}): Promise<string> {
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

export async function finalizeQueryLog(queryId: string, payload: { answer: string; sources?: QueryLog['sources']; timing?: QueryLog['timing']; tokenUsage?: QueryLog['tokenUsage'] }): Promise<void> {
  await updateQueryLogPartial(queryId, { status: 'ok', answer: payload.answer, sources: payload.sources, timing: payload.timing, tokenUsage: payload.tokenUsage })
}

export async function failQueryLog(queryId: string, error: { message: string; stage?: string }): Promise<void> {
  await updateQueryLogPartial(queryId, { status: 'error', error })
}




