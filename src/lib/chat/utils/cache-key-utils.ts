/**
 * @fileoverview Cache-Key Utilities für Chat-Queries
 * 
 * @description
 * Zentrale Utility-Funktionen für die Normalisierung und den Vergleich von Cache-Schlüssel-Parametern.
 * Wird sowohl im Frontend (Duplikatsprüfung) als auch im Backend (Cache-Check) verwendet.
 * 
 * @module chat
 */

import type { Character, AccessPerspective } from '@/lib/chat/constants'
import type { GalleryFilters } from '@/atoms/gallery-filters'

/**
 * Normalisiert ein Character-Array für Vergleich (sortiert, um Reihenfolge zu ignorieren)
 */
export function normalizeCharacter(char?: Character[]): string {
  if (!char || char.length === 0) return ''
  return [...char].sort().join(',')
}

/**
 * Normalisiert ein AccessPerspective-Array für Vergleich (sortiert, um Reihenfolge zu ignorieren)
 */
export function normalizeAccessPerspective(ap?: AccessPerspective[]): string {
  if (!ap || ap.length === 0) return ''
  return [...ap].sort().join(',')
}

/**
 * Normalisiert Gallery-Filter für Vergleich (sortiert nach Keys und Values)
 * 
 * Diese Funktion normalisiert Filter-Objekte, sodass sie konsistent verglichen werden können,
 * unabhängig von der Reihenfolge der Keys oder Array-Elemente.
 */
export function normalizeFilters(filters?: GalleryFilters): string {
  if (!filters || Object.keys(filters).length === 0) return ''
  const normalized: Record<string, string[]> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      normalized[key] = [...value].map(v => String(v)).sort()
    } else if (value !== undefined && value !== null) {
      normalized[key] = [String(value)].sort()
    }
  })
  // Sortiere Keys für konsistenten Vergleich
  const sortedKeys = Object.keys(normalized).sort()
  return JSON.stringify(sortedKeys.map(key => ({ [key]: normalized[key] })))
}

/**
 * Interface für Cache-Key-Parameter
 * 
 * Diese Parameter werden verwendet, um zu bestimmen, ob eine Query als "Duplikat" oder "Cache-Treffer" gilt.
 */
export interface CacheKeyParams {
  question: string
  answerLength?: string
  targetLanguage?: string
  socialContext?: string
  genderInclusive?: boolean
  retriever?: string
  character?: Character[]
  accessPerspective?: AccessPerspective[]
  facetsSelected?: GalleryFilters
}

/**
 * Erstellt einen normalisierten Cache-Key aus Parametern
 * 
 * Dieser Key kann verwendet werden, um Queries zu vergleichen und Duplikate zu erkennen.
 * 
 * @param params - Parameter für den Cache-Key
 * @returns Normalisierter Cache-Key als String
 */
export function createCacheKey(params: CacheKeyParams): string {
  const normalized: Record<string, string> = {
    question: params.question.trim(),
  }
  
  if (params.answerLength) normalized.answerLength = params.answerLength
  if (params.targetLanguage) normalized.targetLanguage = params.targetLanguage
  if (params.socialContext) normalized.socialContext = params.socialContext
  if (params.genderInclusive !== undefined) normalized.genderInclusive = String(params.genderInclusive)
  if (params.retriever) normalized.retriever = params.retriever
  
  // Normalisiere Arrays
  if (params.character) normalized.character = normalizeCharacter(params.character)
  if (params.accessPerspective) normalized.accessPerspective = normalizeAccessPerspective(params.accessPerspective)
  if (params.facetsSelected) normalized.facetsSelected = normalizeFilters(params.facetsSelected)
  
  // Sortiere Keys für konsistenten Vergleich
  const sortedKeys = Object.keys(normalized).sort()
  return JSON.stringify(sortedKeys.map(key => ({ [key]: normalized[key] })))
}

/**
 * Vergleicht zwei Cache-Key-Parameter-Sets auf Gleichheit
 * 
 * @param a - Erste Parameter-Set
 * @param b - Zweite Parameter-Set
 * @returns true, wenn beide Sets identisch sind (gleicher Cache-Key)
 */
export function compareCacheKeys(a: CacheKeyParams, b: CacheKeyParams): boolean {
  return createCacheKey(a) === createCacheKey(b)
}

