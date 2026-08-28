/**
 * @fileoverview Kurzer Library-Steckbrief (oeffentliche Sicht)
 *
 * @description
 * `LibraryProfile` beschreibt die flache Projektion, die
 * `GET /api/public/libraries` fuer nicht angemeldete Besucher liefert: die
 * Public-Publishing-Felder aus `config.publicPublishing` sind hier auf die
 * oberste Ebene gezogen, dazu kommt die Chat-/Galerie-Konfiguration.
 *
 * Warum getrennt vom vollen Steckbrief (`ClientLibrary`): Beide beschreiben
 * dieselbe Sache in unterschiedlicher Tiefe. Vor Welle M4d gab es fuer diese
 * Projektion eine Handkopie in `library-grid.tsx` — sie war bereits
 * auseinandergelaufen (`logoUrl` fehlte). Genau eine Beschreibung pro Form.
 *
 * Der kurze Steckbrief ist KEINE Sicherheitsmassnahme: `library-service.ts`
 * maskiert Secrets bereits vor der Auslieferung. Er ist die zweite
 * Absicherung, nicht die Rettung.
 *
 * @module contracts/library-profile
 */

import type { LibraryChatConfig } from './library-chat'

export interface LibraryProfile {
  /** Eindeutige Kennung, identisch mit `ClientLibrary.id` */
  id: string

  /** Anzeigename — der oeffentliche Name, sonst das interne Label */
  label: string

  /** Slug der oeffentlichen Seite (`/explore/<slugName>`) */
  slugName?: string

  /** Beschreibungstext fuer Kachel und Landingpage */
  description?: string

  /** Optionaler Lucide-Icon-Name (z. B. 'Globe'), aufgeloest von der aufrufenden UI */
  icon?: string

  /** URL des Hintergrundbilds auf der Startseite */
  backgroundImageUrl?: string

  /** Logo der Website-Landingpage */
  logoUrl?: string

  /** Zugriff erst nach Freigabe/Einladung */
  requiresAuth?: boolean

  /**
   * Detailansicht auf oberster Ebene.
   *
   * Die Liste-Route liefert dieses Feld derzeit nicht — sie sendet die
   * Ansichtsart innerhalb von `chat.gallery.detailViewType`. Das Feld bleibt
   * als Vorrang-Ueberschreibung erhalten (so las es die abgeloeste Handkopie).
   */
  detailViewType?: 'book' | 'session'

  /** Chat-/Galerie-Konfiguration, wie sie die Route mitliefert */
  chat?: LibraryChatConfig
}
