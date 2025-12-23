/**
 * @fileoverview Cache-Key Utilities für Chat-Queries
 * 
 * @description
 * Zentrale Utility-Funktionen für die Normalisierung und den Vergleich von Cache-Schlüssel-Parametern.
 * Wird sowohl im Frontend (Duplikatsprüfung) als auch im Backend (Cache-Check) verwendet.
 * 
 * @module chat
 */

import crypto from 'crypto'
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
  queryType?: 'toc' | 'question'
  llmModel?: string
}

/**
 * Interface für Cache-Hash-Parameter
 * 
 * Erweitert CacheKeyParams um libraryId und documentCount für Hash-Berechnung.
 */
export interface CacheHashParams {
  libraryId: string
  question: string
  queryType?: 'toc' | 'question'
  answerLength?: string // Antwortlänge-Parameter (Teil des Cache-Hashes)
  targetLanguage?: string
  character?: Character[]
  accessPerspective?: AccessPerspective[]
  socialContext?: string
  genderInclusive?: boolean
  retriever?: string
  facetsSelected?: Record<string, unknown>
  documentCount?: number // Anzahl der Dokumente in der Library (für Cache-Invalidierung bei neuen Dokumenten)
  llmModel?: string
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
  if (params.llmModel) normalized.llmModel = params.llmModel
  
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

/**
 * Normalisiert Facetten-Filter für Hash-Berechnung
 * 
 * Konvertiert Record<string, unknown> zu normalisiertem String für konsistente Hash-Berechnung.
 */
function normalizeFacetsForHash(facets?: Record<string, unknown>): string {
  if (!facets || Object.keys(facets).length === 0) return ''
  
  const normalized: Record<string, string[]> = {}
  Object.entries(facets).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Normalisiere Array-Werte: zu String, lowercase, sortiert
      normalized[key] = value.map(v => String(v).toLowerCase().trim()).filter(v => v.length > 0).sort()
    } else if (value !== undefined && value !== null) {
      normalized[key] = [String(value).toLowerCase().trim()].filter(v => v.length > 0).sort()
    }
  })
  
  // Sortiere Keys für konsistenten Vergleich
  const sortedKeys = Object.keys(normalized).sort()
  return JSON.stringify(sortedKeys.map(key => ({ [key]: normalized[key] })))
}

/**
 * Erstellt einen SHA-256 Hash aus Cache-relevanten Parametern
 * 
 * Diese Funktion normalisiert alle Werte (lowercase, sortiert Arrays) und berechnet
 * einen Hash für schnelle Cache-Lookups in der Datenbank.
 * 
 * @param params - Parameter für den Cache-Hash
 * @returns SHA-256 Hash als Hex-String
 */
export function createCacheHash(params: CacheHashParams): string {
  // Normalisiere alle Werte zu lowercase und sortiere Arrays
  const normalized: Record<string, string> = {
    libraryId: params.libraryId.toLowerCase().trim(),
    question: params.question.toLowerCase().trim(),
  }
  
  // Füge optionale Felder hinzu (nur wenn vorhanden)
  if (params.queryType) {
    normalized.queryType = params.queryType.toLowerCase()
  }
  if (params.answerLength) {
    normalized.answerLength = params.answerLength.toLowerCase().trim()
  }
  if (params.targetLanguage) {
    normalized.targetLanguage = params.targetLanguage.toLowerCase().trim()
  }
  if (params.socialContext) {
    normalized.socialContext = params.socialContext.toLowerCase().trim()
  }
  if (params.genderInclusive !== undefined) {
    normalized.genderInclusive = String(params.genderInclusive).toLowerCase()
  }
  if (params.retriever) {
    normalized.retriever = params.retriever.toLowerCase().trim()
  }
  if (params.documentCount !== undefined) {
    normalized.documentCount = String(params.documentCount)
  }
  
  // Normalisiere Arrays (sortiert, lowercase)
  // WICHTIG: Leere Arrays werden nicht hinzugefügt (konsistent mit undefined)
  if (params.character && Array.isArray(params.character) && params.character.length > 0) {
    normalized.character = params.character.map(c => String(c).toLowerCase().trim()).filter(c => c.length > 0).sort().join(',')
  }
  if (params.accessPerspective && Array.isArray(params.accessPerspective) && params.accessPerspective.length > 0) {
    normalized.accessPerspective = params.accessPerspective.map(ap => String(ap).toLowerCase().trim()).filter(ap => ap.length > 0).sort().join(',')
  }
  // WICHTIG: Leere Objekte, null und undefined werden nicht hinzugefügt (konsistent behandelt)
  // Prüfe explizit auf leere Objekte, nicht nur auf undefined/null
  if (params.facetsSelected && typeof params.facetsSelected === 'object' && params.facetsSelected !== null && Object.keys(params.facetsSelected).length > 0) {
    normalized.facetsSelected = normalizeFacetsForHash(params.facetsSelected)
  }
  
  // Sortiere Keys für konsistenten Vergleich
  const sortedKeys = Object.keys(normalized).sort()
  const jsonString = JSON.stringify(sortedKeys.map(key => ({ [key]: normalized[key] })))
  
  // Berechne SHA-256 Hash
  return crypto.createHash('sha256').update(jsonString).digest('hex')
}



