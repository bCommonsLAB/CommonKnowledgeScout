/**
 * @fileoverview Reine Regel: Passt ein gespeicherter Cache-Hash noch zur heutigen Konfiguration?
 *
 * @description
 * Der Cache-Hash eines Eintrags im Fragen-Log enthält Antwortregeln,
 * Facetten-Kontext und Dokumentzahl der Library ZUM ZEITPUNKT der Antwort.
 * Ändert sich eines davon, trifft keine neue Frage mehr diesen Eintrag — er
 * liegt dann nur noch in der Chronik. Hier nur die Rechnung (ohne Mongo,
 * ohne Library-Laden); den Prüfer je Library baut `cache-aktualitaet.ts`.
 *
 * @module chat
 */

import type { CacheParams } from '@/types/query-log'
import { createCacheHash, type CacheHashParams } from './cache-key-utils'

/** `unbekannt`: Eintrag ohne Hash oder ohne Cache-Parameter (sehr alte Logs). */
export type CacheAktualitaet = 'aktuell' | 'veraltet' | 'unbekannt'

/** Was sich an der Library ändern kann, ohne dass die Frage sich ändert. */
export interface AktuellerCacheKontext {
  documentCount: number
  antwortregeln: string | undefined
  facettenKontext: string | undefined
}

export interface CacheEintrag {
  cacheHash?: string | null
  cacheParams?: CacheParams | null
}

/**
 * Hash aus den gespeicherten Parametern mit den aktuellen Werten für
 * Dokumentzahl, Antwortregeln und Facetten-Kontext neu rechnen und vergleichen.
 */
export function aktualitaetAusParams(eintrag: CacheEintrag, aktuell: AktuellerCacheKontext): CacheAktualitaet {
  if (!eintrag.cacheHash || !eintrag.cacheParams) return 'unbekannt'
  const p = eintrag.cacheParams
  const params: CacheHashParams = {
    libraryId: p.libraryId,
    question: p.question,
    queryType: p.queryType,
    answerLength: p.answerLength,
    targetLanguage: p.targetLanguage,
    character: p.character,
    accessPerspective: p.accessPerspective,
    socialContext: p.socialContext,
    genderInclusive: p.genderInclusive,
    retriever: p.retriever,
    facetsSelected: p.facetsSelected,
    llmModel: p.llmModel,
    documentCount: aktuell.documentCount,
    antwortregeln: aktuell.antwortregeln,
    facettenKontext: aktuell.facettenKontext,
  }
  return createCacheHash(params) === eintrag.cacheHash ? 'aktuell' : 'veraltet'
}
