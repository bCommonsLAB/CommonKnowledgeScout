/**
 * Eigenes Query-Log fuer einen Cache-Treffer (Story D12b).
 *
 * Trifft eine Frage den benutzeruebergreifenden Antwort-Cache (Hash +
 * Library), schickte die Stream-Route bisher die Kennung des fremden Logs
 * im `complete`-Schritt und legte fuer die Person nichts an. Folge in der
 * Fragen-Chronik: Die Frage fehlte nach dem Neuladen im Verlauf der
 * Sitzung, `?q=<id>` lief auf 404, ebenso Konfig-Anzeige, Protokoll und
 * Debug; eine neu eroeffnete Sitzung stand ohne Frage in der Chronik.
 *
 * Jetzt bekommt die Person ein eigenes Log in ihrer Sitzung: Antwort,
 * Belege, Vorschlaege und Kurztitel aus dem Treffer, ein Cache-Schritt
 * mit der Kennung des Treffers, Status `ok`. Der Cache-Hash entsteht wie
 * bei jeder Frage in `insertQueryLog` — das eigene Log ist damit selbst
 * ein gueltiger Treffer fuer die naechste gleiche Frage.
 *
 * Nur fuer Fragen: Die Themenuebersicht (`toc`) hat keine Sitzung (D8) und
 * ist ueber `query-log-zugriff` fuer alle lesbar (D12a).
 */

import type { QueryLog } from '@/types/query-log'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { appendRetrievalStep, startQueryLog } from '@/lib/logging/query-logger'
import { updateQueryLogPartial } from '@/lib/db/queries-repo'

export interface CacheTrefferLogParams {
  /** Rahmen der Frage — dieselben Felder wie beim regulaeren `startQueryLog`. */
  rahmen: Omit<Parameters<typeof startQueryLog>[0], 'queryType'>
  /** Das gecachte Log, dessen Antwort uebernommen wird. */
  treffer: Pick<QueryLog, 'queryId' | 'answer' | 'references' | 'suggestedQuestions' | 'shortTitle'>
  cacheHash?: string
  documentCount?: number
  /** Die Cache-Schritte dieser Anfrage fuer das Protokoll der Person — mit der eigenen Kennung. */
  protokoll: (eigeneQueryId: string) => ChatProcessingStep[]
}

/** Legt das eigene Log an und gibt seine Kennung zurueck. */
export async function eigenesLogFuerCacheTreffer(p: CacheTrefferLogParams): Promise<string> {
  const queryId = await startQueryLog({ ...p.rahmen, queryType: 'question' })
  const jetzt = new Date()
  await appendRetrievalStep(queryId, {
    indexName: '',
    namespace: '',
    stage: 'cache_check',
    level: 'question',
    cacheHash: p.cacheHash,
    documentCount: p.documentCount,
    cacheFound: true,
    cachedQueryId: p.treffer.queryId,
    startedAt: jetzt,
    endedAt: jetzt,
    timingMs: 0,
  })
  await updateQueryLogPartial(queryId, {
    status: 'ok',
    answer: p.treffer.answer ?? '',
    references: p.treffer.references ?? [],
    suggestedQuestions: p.treffer.suggestedQuestions ?? [],
    // Kurztitel nur, wenn der Treffer einen hat — sonst bliebe ein leeres Feld stehen (D5).
    ...(p.treffer.shortTitle ? { shortTitle: p.treffer.shortTitle } : {}),
    processingLogs: p.protokoll(queryId),
  })
  return queryId
}
