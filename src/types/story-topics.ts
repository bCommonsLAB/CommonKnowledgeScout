/**
 * Typdefinitionen für die Story-Themenübersicht.
 *
 * Diese Typen definieren die Struktur der Themenübersicht im Story-Modus,
 * einschließlich Themen und Fragen. Pro Frage werden nur id + text genutzt
 * (Klick übernimmt `text` in den Chat); Retriever/Intent kommen aus der Chat-Konfiguration.
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
 * Eine einzelne Frage innerhalb eines Themas (nur Darstellung + Klick → Eingabefeld).
 */
export interface StoryQuestion {
  /** Eindeutige ID der Frage */
  id: string;
  /** Frage im Klartext */
  text: string;
}
