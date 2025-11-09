/**
 * @fileoverview Chat Type Definitions
 * 
 * @description
 * Type definitions for chat functionality. Defines the Chat interface for multi-chat
 * management where each chat represents a conversation with multiple queries (questions/answers).
 * Each chat belongs to a library and a user (authenticated) or session (anonymous).
 * 
 * @module chat
 * 
 * @exports
 * - Chat: Chat interface for conversation management
 * 
 * @usedIn
 * - src/lib/db/chats-repo.ts: Chat repository uses Chat type
 * - src/app/api/chat/[libraryId]/chats: Chat API routes use Chat type
 * - src/components/library/chat: Chat components use Chat type
 * 
 * @dependencies
 * - None (pure type definitions)
 */

/**
 * Chat-Interface für Multi-Chat-Verwaltung
 * 
 * Ein Chat repräsentiert eine Konversation mit mehreren Queries (Fragen/Antworten).
 * Jeder Chat gehört zu einer Bibliothek und einem Benutzer (authentifiziert) oder einer Session (anonym).
 */
export interface Chat {
  /** Eindeutige Chat-ID (UUID) */
  chatId: string;
  /** Bibliothek-ID, zu der dieser Chat gehört */
  libraryId: string;
  /** E-Mail-Adresse des Benutzers (für authentifizierte Nutzer) */
  userEmail?: string;
  /** Session-ID für anonyme Nutzer (wenn kein userEmail vorhanden) */
  sessionId?: string;
  /** Chat-Titel (max. ~60 Zeichen, wird aus erster Frage generiert) */
  title: string;
  /** Erstellungsdatum des Chats */
  createdAt: Date;
  /** Letztes Aktualisierungsdatum (wird aktualisiert, wenn neue Query hinzugefügt wird) */
  updatedAt: Date;
}

