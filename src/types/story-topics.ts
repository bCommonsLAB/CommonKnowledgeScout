/**
 * Typdefinitionen für die Story-Themenübersicht.
 * 
 * Diese Typen definieren die Struktur der Themenübersicht im Story-Modus,
 * einschließlich Themen, Fragen und deren Metadaten.
 */

/**
 * Vollständige Datenstruktur für die Themenübersicht einer Library.
 */
export interface StoryTopicsData {
  /** Eindeutige ID (z.B. library-slug) */
  id: string;
  /** Haupttitel der Themenübersicht */
  title: string;
  /** Treffender Untertitel/Tagline */
  tagline: string;
  /** Einleitender Text zur Themenübersicht */
  intro: string;
  /** Liste der Themen */
  topics: StoryTopic[];
}

/**
 * Ein einzelnes Thema mit zugehörigen Fragen.
 */
export interface StoryTopic {
  /** Eindeutige ID des Themas */
  id: string;
  /** Titel des Themas */
  title: string;
  /** Optionaler Kurztext/Zusammenfassung des Themas */
  summary?: string;
  /** Liste der Fragen zu diesem Thema */
  questions: StoryQuestion[];
}

/**
 * Eine einzelne Frage innerhalb eines Themas.
 */
export interface StoryQuestion {
  /** Eindeutige ID der Frage */
  id: string;
  /** Frage im Klartext */
  text: string;
  /** Optional: Intent der Frage für bessere Retriever-Auswahl */
  intent?: 'what' | 'why' | 'how' | 'compare' | 'recommend';
  /** Optional: Bevorzugte Retriever-Methode für diese Frage */
  retriever?: 'summary' | 'chunk' | 'auto';
  /** Optional: Facetten-Filter, die für diese Frage angewendet werden sollen */
  facets?: Record<string, string[]>;
}




















