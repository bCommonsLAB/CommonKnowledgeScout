/**
 * @fileoverview Cache Hash Builder - Zentrale Funktionen für Cache-Hash-Berechnung
 * 
 * @description
 * Zentrale Funktionen zur Normalisierung und Berechnung von Cache-Hashes.
 * Stellt sicher, dass alle Parameter konsistent normalisiert werden, bevor der Hash berechnet wird.
 * 
 * @module chat
 */

import { createCacheHash, type CacheHashParams } from './cache-key-utils'
import { facetsSelectedToMongoFilter } from '../common/filters'
import { getFilteredDocumentCount } from '@/lib/db/queries-repo'
import type { Library } from '@/types/library'
import { TARGET_LANGUAGE_DEFAULT } from '../constants'

/**
 * Parameter für die Cache-Hash-Berechnung (vor Normalisierung)
 */
export interface CacheHashInputParams {
  libraryId: string
  question: string
  queryType?: 'toc' | 'question'
  answerLength?: string
  targetLanguage?: string
  character?: string[]
  accessPerspective?: string[]
  socialContext?: string
  genderInclusive?: boolean
  retriever?: string
  facetsSelected?: Record<string, unknown>
  documentCount?: number // Optional: Bereits berechnete DocumentCount
  library?: Library // Optional: Library-Objekt für DocumentCount-Berechnung
}

/**
 * Normalisiert Retriever-Wert für Cache-Hash (chunkSummary → chunk)
 */
export function normalizeRetrieverForCache(retriever?: string): string | undefined {
  if (!retriever) return undefined
  return retriever === 'chunkSummary' ? 'chunk' : retriever
}

/**
 * Normalisiert facetsSelected für Cache-Hash (leere Objekte/null → undefined)
 */
export function normalizeFacetsSelectedForCache(
  facetsSelected?: Record<string, unknown> | null
): Record<string, unknown> | undefined {
  if (!facetsSelected || typeof facetsSelected !== 'object' || facetsSelected === null) {
    return undefined
  }
  if (Object.keys(facetsSelected).length === 0) {
    return undefined
  }
  return facetsSelected
}

/**
 * Berechnet die gefilterte Dokumentenanzahl für Cache-Hash
 * 
 * @param library Library-Objekt (für korrekte Collection-Name-Konvertierung)
 * @param facetsSelected Facetten-Filter
 * @returns Anzahl der gefilterten Dokumente
 */
export async function calculateDocumentCountForCache(
  library: Library,
  facetsSelected?: Record<string, unknown>
): Promise<number> {
  const mongoFilter = facetsSelectedToMongoFilter(facetsSelected)
  return await getFilteredDocumentCount(library, mongoFilter)
}

/**
 * Erstellt normalisierte Cache-Hash-Parameter aus Input-Parametern
 * 
 * Diese Funktion normalisiert alle Parameter konsistent:
 * - Frage wird getrimmt
 * - Retriever wird normalisiert (chunkSummary → chunk)
 * - facetsSelected wird normalisiert (leere Objekte/null → undefined)
 * - queryType wird auf 'question' gesetzt, wenn undefined
 * - DocumentCount wird berechnet, falls nicht vorhanden und Library vorhanden
 * 
 * @param params Input-Parameter
 * @returns Normalisierte Cache-Hash-Parameter
 */
export async function buildCacheHashParams(
  params: CacheHashInputParams
): Promise<CacheHashParams> {
  // Normalisiere Frage
  const normalizedQuestion = params.question.trim()
  
  // Normalisiere Retriever
  const normalizedRetriever = normalizeRetrieverForCache(params.retriever)
  
  // Normalisiere facetsSelected
  const normalizedFacetsSelected = normalizeFacetsSelectedForCache(params.facetsSelected)
  
  // Normalisiere queryType (Default: 'question')
  const normalizedQueryType = params.queryType || 'question'
  
  // Berechne DocumentCount, falls nicht vorhanden und Library vorhanden
  let documentCount = params.documentCount
  if (documentCount === undefined && params.library) {
    documentCount = await calculateDocumentCountForCache(params.library, normalizedFacetsSelected)
  }
  
  return {
    libraryId: params.libraryId,
    question: normalizedQuestion,
    queryType: normalizedQueryType as 'toc' | 'question',
    answerLength: params.answerLength,
    // WICHTIG: Stelle sicher, dass targetLanguage immer gesetzt ist (auch wenn undefined)
    // Verwende Default-Wert, damit sie immer zum Cache-Hash hinzugefügt wird
    targetLanguage: params.targetLanguage || TARGET_LANGUAGE_DEFAULT,
    character: params.character as import('@/lib/chat/constants').Character[] | undefined,
    accessPerspective: params.accessPerspective as import('@/lib/chat/constants').AccessPerspective[] | undefined,
    socialContext: params.socialContext,
    genderInclusive: params.genderInclusive,
    retriever: normalizedRetriever,
    facetsSelected: normalizedFacetsSelected,
    documentCount,
  }
}

/**
 * Berechnet Cache-Hash aus Input-Parametern
 * 
 * Diese Funktion kombiniert Normalisierung und Hash-Berechnung in einem Schritt.
 * 
 * @param params Input-Parameter
 * @returns Cache-Hash (SHA-256 Hex-String)
 */
export async function buildCacheHash(params: CacheHashInputParams): Promise<string> {
  const normalizedParams = await buildCacheHashParams(params)
  return createCacheHash(normalizedParams)
}

