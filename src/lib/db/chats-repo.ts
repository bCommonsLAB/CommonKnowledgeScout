/**
 * @fileoverview Chats Repository - MongoDB Repository for Chat Management
 * 
 * @description
 * Repository for managing chats in MongoDB. Handles CRUD operations for chats,
 * supports both authenticated users (userEmail) and anonymous users (sessionId).
 * Provides chat listing, creation, retrieval, and update operations with optimized
 * indexes for performance.
 * 
 * @module chat
 * 
 * @exports
 * - createChat: Creates a new chat
 * - listChats: Lists chats for a library and user/session
 * - getChatById: Retrieves a chat by ID
 * - touchChat: Updates chat timestamp
 * - deleteChat: Deletes a chat
 * 
 * @usedIn
 * - src/app/api/chat: Chat API routes use repository
 * - src/components/library/chat: Chat components use repository
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/types/chat: Chat type definitions
 * - mongodb: MongoDB driver types
 * - crypto: UUID generation
 */

import { getCollection } from '@/lib/mongodb-service'
import crypto from 'crypto'
import type { Collection, UpdateFilter } from 'mongodb'
import type { Chat } from '@/types/chat'

const COLLECTION_NAME = 'chats'

/**
 * Gibt die MongoDB-Collection für Chats zurück und erstellt Indizes
 */
async function getChatsCollection(): Promise<Collection<Chat>> {
  const col = await getCollection<Chat>(COLLECTION_NAME)
  try {
    await Promise.all([
      col.createIndex({ chatId: 1 }, { unique: true, name: 'chatId_unique' }),
      col.createIndex({ libraryId: 1, userEmail: 1, createdAt: -1 }, { name: 'library_user_createdAt_desc' }),
      col.createIndex({ libraryId: 1, sessionId: 1, createdAt: -1 }, { name: 'library_session_createdAt_desc' }),
      col.createIndex({ userEmail: 1, createdAt: -1 }, { name: 'user_createdAt_desc' }),
      col.createIndex({ sessionId: 1, createdAt: -1 }, { name: 'session_createdAt_desc' }),
    ])
  } catch {
    // Indizes existieren bereits oder Fehler beim Erstellen (ignorieren)
  }
  return col
}

/**
 * Erstellt einen neuen Chat
 * 
 * @param libraryId Bibliothek-ID
 * @param userEmailOrSessionId E-Mail-Adresse des Benutzers oder Session-ID für anonyme Nutzer
 * @param title Chat-Titel (max. ~60 Zeichen)
 * @returns Chat-ID des erstellten Chats
 */
export async function createChat(
  libraryId: string,
  userEmailOrSessionId: string,
  title: string
): Promise<string> {
  const col = await getChatsCollection()
  const chatId = crypto.randomUUID()
  const now = new Date()
  
  // Prüfe, ob es eine E-Mail-Adresse oder Session-ID ist
  const isEmail = userEmailOrSessionId.includes('@')
  const payload: Chat = {
    chatId,
    libraryId,
    ...(isEmail ? { userEmail: userEmailOrSessionId } : { sessionId: userEmailOrSessionId }),
    title: title.slice(0, 60), // Stelle sicher, dass Titel nicht länger als 60 Zeichen ist
    createdAt: now,
    updatedAt: now,
  }
  
  await col.insertOne(payload)
  return chatId
}

/**
 * Listet alle Chats für eine Bibliothek und einen Benutzer oder eine Session
 * 
 * @param libraryId Bibliothek-ID
 * @param userEmailOrSessionId E-Mail-Adresse des Benutzers oder Session-ID
 * @param limit Maximale Anzahl der zurückgegebenen Chats (Standard: 50)
 * @returns Liste der Chats, sortiert nach createdAt (neueste zuerst)
 */
export async function listChats(
  libraryId: string,
  userEmailOrSessionId: string,
  limit?: number
): Promise<Chat[]> {
  const col = await getChatsCollection()
  const lim = Math.max(1, Math.min(100, Number(limit ?? 50)))
  
  const isEmail = userEmailOrSessionId.includes('@')
  const filter = isEmail 
    ? { libraryId, userEmail: userEmailOrSessionId }
    : { libraryId, sessionId: userEmailOrSessionId }
  
  const cursor = col
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(lim)
  
  return await cursor.toArray()
}

/**
 * Lädt einen Chat anhand seiner ID
 * 
 * @param chatId Chat-ID
 * @param userEmailOrSessionId E-Mail-Adresse des Benutzers oder Session-ID (für Sicherheit)
 * @returns Chat oder null, wenn nicht gefunden
 */
export async function getChatById(
  chatId: string,
  userEmailOrSessionId: string
): Promise<Chat | null> {
  const col = await getChatsCollection()
  const isEmail = userEmailOrSessionId.includes('@')
  const filter = isEmail 
    ? { chatId, userEmail: userEmailOrSessionId }
    : { chatId, sessionId: userEmailOrSessionId }
  return await col.findOne(filter)
}

/**
 * Aktualisiert den Titel eines Chats
 * 
 * @param chatId Chat-ID
 * @param title Neuer Chat-Titel (max. ~60 Zeichen)
 */
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<void> {
  const col = await getChatsCollection()
  const update: UpdateFilter<Chat> = {
    $set: {
      title: title.slice(0, 60), // Stelle sicher, dass Titel nicht länger als 60 Zeichen ist
      updatedAt: new Date(),
    },
  }
  await col.updateOne({ chatId }, update)
}

/**
 * Aktualisiert das updatedAt-Feld eines Chats (z.B. wenn eine neue Query hinzugefügt wird)
 * 
 * @param chatId Chat-ID
 */
export async function touchChat(chatId: string): Promise<void> {
  const col = await getChatsCollection()
  const update: UpdateFilter<Chat> = {
    $set: {
      updatedAt: new Date(),
    },
  }
  await col.updateOne({ chatId }, update)
}

/**
 * Löscht einen Chat
 * 
 * @param chatId Chat-ID
 * @param userEmailOrSessionId E-Mail-Adresse des Benutzers oder Session-ID (für Sicherheit)
 * @returns true, wenn Chat gelöscht wurde, false wenn nicht gefunden
 */
export async function deleteChat(
  chatId: string,
  userEmailOrSessionId: string
): Promise<boolean> {
  const col = await getChatsCollection()
  const isEmail = userEmailOrSessionId.includes('@')
  const filter = isEmail 
    ? { chatId, userEmail: userEmailOrSessionId }
    : { chatId, sessionId: userEmailOrSessionId }
  const result = await col.deleteOne(filter)
  return result.deletedCount > 0
}

