/**
 * @fileoverview Testimonial Types - Zentrale Typdefinitionen
 * 
 * @description
 * Definiert die zentralen Typen für Testimonials.
 * Diese Types sind die Basis für alle Testimonial-Operationen.
 * 
 * @module testimonials
 */

/**
 * Einheitliche Datenstruktur für ein Testimonial
 */
export interface Testimonial {
  /** Ordner-ID des Testimonials */
  folderId: string
  /** Testimonial-ID (Ordner-Name) */
  testimonialId: string
  /** Sprecher-Name */
  speakerName: string | null
  /** Erstellungsdatum (ISO-String) */
  createdAt: string
  /** Text-Inhalt (Markdown-Body oder Text aus meta.json) */
  text: string | null
  /** Ob Audio vorhanden ist */
  hasAudio: boolean
  /** Audio-Dateiname (falls vorhanden) */
  audioFileName: string | null
  /** Audio-Datei-ID (falls vorhanden) */
  audioFileId: string | null
  /** Quelle: 'markdown' oder 'meta.json' */
  source: 'markdown' | 'meta.json'
  /** Event-File-ID */
  eventFileId: string
  /** Consent (falls vorhanden) */
  consent: boolean | null
}

/**
 * Optionen zum Erstellen eines Testimonials
 */
export interface CreateTestimonialOptions {
  /** Event-File-ID */
  eventFileId: string
  /** Sprecher-Name (optional) */
  speakerName?: string | null
  /** Text-Inhalt */
  text?: string | null
  /** Audio-Datei (optional) */
  audioFile?: File | null
  /** Consent (optional) */
  consent?: boolean | null
}

/**
 * Ergebnis des Erstellens eines Testimonials
 */
export interface CreateTestimonialResult {
  /** Erstellte Testimonial-ID */
  testimonialId: string
  /** Ordner-ID des Testimonials */
  folderId: string
  /** Audio-Datei-ID (falls vorhanden) */
  audioFileId: string | null
}
