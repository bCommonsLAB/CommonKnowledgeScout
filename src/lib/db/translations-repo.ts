/**
 * @fileoverview Translations Repository - MongoDB Repository for Document Translations
 * 
 * @description
 * Repository for managing document translations in MongoDB. Handles caching of translated
 * document data (BookDetailData and SessionDetailData) to avoid redundant LLM calls.
 * Uses fileId and targetLanguage as unique compound key.
 * 
 * @module db
 * 
 * @exports
 * - getTranslation: Retrieves cached translation
 * - saveTranslation: Saves translation to cache
 * - deleteTranslation: Deletes cached translation
 * 
 * @usedIn
 * - src/app/api/chat/[libraryId]/translate-document/route.ts: Translation API endpoint
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - mongodb: MongoDB driver types
 */

import { getCollection } from '@/lib/mongodb-service'
import type { Collection } from 'mongodb'
import type { BookDetailData } from '@/components/library/book-detail'
import type { SessionDetailData } from '@/components/library/session-detail'
import type { TargetLanguage } from '@/lib/chat/constants'

/**
 * Interface für Translation-Dokument in MongoDB
 */
export interface TranslationDocument {
  fileId: string
  targetLanguage: TargetLanguage
  translatedData: BookDetailData | SessionDetailData
  createdAt: Date
}

const COLLECTION_NAME = 'translations'

/**
 * Holt die translations Collection mit Indexen
 */
async function getTranslationsCollection(): Promise<Collection<TranslationDocument>> {
  const col = await getCollection<TranslationDocument>(COLLECTION_NAME)
  try {
    await Promise.all([
      // Unique compound index für fileId + targetLanguage
      col.createIndex(
        { fileId: 1, targetLanguage: 1 },
        { unique: true, name: 'fileId_targetLanguage_unique' }
      ),
      // Index für fileId (für Löschungen)
      col.createIndex({ fileId: 1 }, { name: 'fileId_index' }),
      // Index für createdAt (für Cleanup)
      col.createIndex({ createdAt: -1 }, { name: 'createdAt_desc' }),
    ])
  } catch {
    // Index-Erstellung kann fehlschlagen, wenn bereits vorhanden - ignorieren
  }
  return col
}

/**
 * Lädt eine übersetzte Dokumentstruktur aus dem Cache
 * 
 * @param fileId Die Datei-ID des Dokuments
 * @param targetLanguage Die Zielsprache der Übersetzung
 * @returns Die übersetzten Daten oder null, wenn nicht gefunden
 */
export async function getTranslation(
  fileId: string,
  targetLanguage: TargetLanguage
): Promise<BookDetailData | SessionDetailData | null> {
  const col = await getTranslationsCollection()
  const doc = await col.findOne({ fileId, targetLanguage })
  return doc?.translatedData || null
}

/**
 * Speichert eine übersetzte Dokumentstruktur im Cache
 * 
 * @param fileId Die Datei-ID des Dokuments
 * @param targetLanguage Die Zielsprache der Übersetzung
 * @param translatedData Die übersetzten Daten (BookDetailData oder SessionDetailData)
 */
export async function saveTranslation(
  fileId: string,
  targetLanguage: TargetLanguage,
  translatedData: BookDetailData | SessionDetailData
): Promise<void> {
  const col = await getTranslationsCollection()
  await col.replaceOne(
    { fileId, targetLanguage },
    {
      fileId,
      targetLanguage,
      translatedData,
      createdAt: new Date(),
    },
    { upsert: true }
  )
}

/**
 * Löscht eine übersetzte Dokumentstruktur aus dem Cache
 * 
 * @param fileId Die Datei-ID des Dokuments
 * @param targetLanguage Optional: Die Zielsprache. Wenn nicht angegeben, werden alle Übersetzungen für diese fileId gelöscht
 */
export async function deleteTranslation(
  fileId: string,
  targetLanguage?: TargetLanguage
): Promise<void> {
  const col = await getTranslationsCollection()
  const filter: { fileId: string; targetLanguage?: TargetLanguage } = { fileId }
  if (targetLanguage) {
    filter.targetLanguage = targetLanguage
  }
  await col.deleteMany(filter)
}

