/**
 * @fileoverview Regel „verwerfen statt löschen" für den Antwort-Cache (reine Funktionen).
 *
 * @description
 * KnowledgeScout hat keinen eigenen Antwort-Cache: Der Cache IST das Fragen-Log
 * (Collection `queries`). Eine neue Frage trifft einen gespeicherten Eintrag,
 * wenn der Cache-Hash gleich ist. Die Verwaltungssicht „Fragen & Antworten"
 * verwirft Antworten, statt Einträge zu löschen: `cacheInvalidatedAt` wird
 * gesetzt, der Eintrag gilt nicht mehr als Treffer — Chronik, Sitzungen und
 * populäre Fragen lesen ihn unverändert weiter (Contract chat-contracts §5).
 *
 * @module chat
 */

import type { QueryLog } from '@/types/query-log'
import type { StoryTopicsData } from '@/types/story-topics'

/**
 * Mongo-Filter für einen Cache-Treffer: gleicher Hash, gleiche Library, eine
 * Antwort oder Themenübersicht vorhanden — und NICHT verworfen. Alte Einträge
 * haben das Feld nicht und bleiben Treffer (`null` matcht fehlend und null).
 */
export function cacheTrefferFilter(cacheHash: string, libraryId: string): Record<string, unknown> {
  return {
    cacheHash,
    libraryId,
    $or: [
      // `null` ausdrücklich: der Treiber schreibt `undefined` als null, ein
      // Fehler-Log mit `answer: null` ist keine Antwort.
      { answer: { $nin: ['', null] } },
      { storyTopicsData: { $exists: true, $ne: null as unknown as StoryTopicsData } },
    ],
    cacheInvalidatedAt: null,
  }
}

/**
 * Dieselbe Regel für einen gelesenen Eintrag (Tests, Aufrufer ohne Mongo):
 * verworfen → nie ein Treffer; sonst zählt eine nicht-leere Antwort oder eine
 * Themenübersicht.
 */
export function istCacheTreffer(log: Pick<QueryLog, 'answer' | 'storyTopicsData' | 'cacheInvalidatedAt'>): boolean {
  if (log.cacheInvalidatedAt !== undefined && log.cacheInvalidatedAt !== null) return false
  const hatAntwort = typeof log.answer === 'string' && log.answer.trim().length > 0
  return hatAntwort || (log.storyTopicsData !== undefined && log.storyTopicsData !== null)
}
