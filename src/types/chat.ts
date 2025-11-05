/**
 * Chat-Interface für Multi-Chat-Verwaltung
 * 
 * Ein Chat repräsentiert eine Konversation mit mehreren Queries (Fragen/Antworten).
 * Jeder Chat gehört zu einer Bibliothek und einem Benutzer.
 */
export interface Chat {
  /** Eindeutige Chat-ID (UUID) */
  chatId: string;
  /** Bibliothek-ID, zu der dieser Chat gehört */
  libraryId: string;
  /** E-Mail-Adresse des Benutzers */
  userEmail: string;
  /** Chat-Titel (max. ~60 Zeichen, wird aus erster Frage generiert) */
  title: string;
  /** Erstellungsdatum des Chats */
  createdAt: Date;
  /** Letztes Aktualisierungsdatum (wird aktualisiert, wenn neue Query hinzugefügt wird) */
  updatedAt: Date;
}

