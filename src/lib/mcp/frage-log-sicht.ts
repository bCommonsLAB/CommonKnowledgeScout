/**
 * @fileoverview Sicht auf einen Query-Log fuer `frage_log_lesen` (Welle F): reine Funktion.
 *
 * @description
 * Der Query-Log traegt alles, was eine Antwort erklaert — Frage, Antwort,
 * Belege, Cache-Parameter, Nachpruefung, Prompt, Verarbeitungsschritte.
 * Die Bruecke liefert davon das Lesbare; der Prompt kommt nur auf Wunsch
 * (er ist gross), die Verarbeitungsschritte als Zaehler.
 *
 * @module mcp
 */

import type { QueryLog } from '@/types/query-log'

export interface FrageLogSicht {
  queryId: string
  status: QueryLog['status']
  fehler: QueryLog['error'] | null
  erstellt: string | null
  frage: string
  queryType: string | null
  antwort: string | null
  kurztitel: string | null
  retriever: string | null
  cacheHash: string | null
  cacheParams: QueryLog['cacheParams'] | null
  facettenFilter: Record<string, unknown> | null
  filtersNormalized: Record<string, unknown> | null
  belege: Array<{ nummer: number; fileId?: string; titel?: string }>
  nachpruefung: QueryLog['nachpruefung'] | null
  timing: QueryLog['timing'] | null
  tokens: QueryLog['tokenUsage'] | null
  verarbeitungsschritte: number
  prompt?: QueryLog['prompt'] | null
}

export function frageLogSicht(log: QueryLog, mitPrompt: boolean): FrageLogSicht {
  const erstellt = log.createdAt instanceof Date ? log.createdAt.toISOString() : (typeof log.createdAt === 'string' ? log.createdAt : null)
  return {
    queryId: log.queryId,
    status: log.status,
    fehler: log.error ?? null,
    erstellt,
    frage: log.question,
    queryType: log.queryType ?? null,
    antwort: log.answer ?? null,
    kurztitel: log.shortTitle ?? null,
    retriever: log.retriever ?? null,
    cacheHash: log.cacheHash ?? null,
    cacheParams: log.cacheParams ?? null,
    facettenFilter: log.facetsSelected ?? null,
    filtersNormalized: log.filtersNormalized ?? null,
    belege: (log.references ?? []).map((r) => {
      const ref = r as unknown as { number: number; fileId?: string; title?: string }
      return { nummer: ref.number, ...(ref.fileId ? { fileId: ref.fileId } : {}), ...(ref.title ? { titel: ref.title } : {}) }
    }),
    nachpruefung: log.nachpruefung ?? null,
    timing: log.timing ?? null,
    tokens: log.tokenUsage ?? null,
    verarbeitungsschritte: log.processingLogs?.length ?? 0,
    ...(mitPrompt ? { prompt: log.prompt ?? null } : {}),
  }
}
