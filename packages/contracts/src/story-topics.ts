/**
 * @fileoverview Themenuebersicht des Story-Modus — die berechnete Gliederung
 *
 * @description
 * Die Form, in der der Chat-Server die Themenuebersicht einer Library liefert
 * (`storyTopicsData` im `complete`-Schritt des Streams) und in der die
 * Story-Oberflaeche sie liest: Themen mit Kurztext und vorgeschlagenen Fragen.
 *
 * **Warum hier**: Sie lag unter `src/types/story-topics.ts` in der App. Seit
 * D1 (Plan `story-dreiteilung-fragenchronik`) liest das Paket
 * `@ks/module-story` dieselbe Form fuer Gliederung und Themenkarten — ein
 * Paket darf aber nichts aus `@/` ziehen. Die App importiert weiter ueber
 * ihren Shim `src/types/story-topics.ts`.
 *
 * Pro Frage werden nur `id` und `text` gefuehrt (Klick uebernimmt `text` in
 * den Chat); Retriever und Intent kommen aus der Chat-Konfiguration.
 *
 * @module contracts/story-topics
 */

/** Vollstaendige Datenstruktur der Themenuebersicht einer Library. */
export interface StoryTopicsData {
  /** Eindeutige ID (z. B. Library-Slug) */
  id: string
  /** Haupttitel der Themenuebersicht */
  title: string
  /** Treffender Untertitel */
  tagline: string
  /** Einleitender Text */
  intro: string
  /** Die Themen */
  topics: StoryTopic[]
}

/** Ein Thema mit seinen Fragen. */
export interface StoryTopic {
  id: string
  title: string
  /** Optionaler Kurztext des Themas */
  summary?: string
  questions: StoryQuestion[]
}

/** Eine vorgeschlagene Frage (nur Darstellung + Klick). */
export interface StoryQuestion {
  id: string
  /** Frage im Klartext */
  text: string
}

/**
 * Die Systemfrage, mit der der Chat-Server die Themenuebersicht erzeugt
 * (D6b: eine Quelle fuer App und `@ks/module-story`; die App exportiert sie
 * weiter als `TOC_QUESTION` in `src/lib/chat/constants.ts`). Der Text ist Teil
 * des Cache-Schluessels — wer ihn aendert, entwertet alle Uebersichten.
 */
export const STORY_TOC_QUESTION = 'What topics are covered here? Can we output them as a table of contents.'
