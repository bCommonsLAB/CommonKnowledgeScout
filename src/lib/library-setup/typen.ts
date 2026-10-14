/**
 * @fileoverview Typen des Entscheidungskatalogs der Library-Anlage
 * (Plan speicher-verbindungen-und-library-anlage, Teil C, C1).
 *
 * @module library-setup
 */

import type { z } from 'zod'
import type { Library } from '@/types/library'

/**
 * Pflicht = ohne Antwort laeuft nichts; empfohlen = laeuft mit Vorgabe, aber
 * spuerbar schlechter (Wizard fragt, ueberspringen sichtbar „offen");
 * spaeter = Vorgabe reicht, nur in den Settings (Owner-Entscheid E6).
 */
export type Gewicht = 'pflicht' | 'empfohlen' | 'spaeter'

/** Schritt des Anlege-Wizards (C2), in dem die Frage steht. */
export type Schritt = 'grundlagen' | 'quelle' | 'verarbeitung' | 'finden' | 'story' | 'erfassen' | 'settings'

/** Reihenfolge der Wizard-Schritte (C2). */
export const SCHRITTE: readonly Schritt[] = ['grundlagen', 'quelle', 'verarbeitung', 'finden', 'story', 'erfassen', 'settings']

/** Was ueber die Anlage bekannt ist, aber nicht in der Library steht. */
export interface EinrichtungsKontext {
  /** Anzahl anderer eigener Libraries gleichen Inhaltstyps (nur bei der Anlage bekannt). */
  andereLibrariesGleichenTyps?: number
  /** Bei der Anlage: wurde eine Vorlage-Library gewaehlt? */
  vorlageGewaehlt?: boolean
  /** Ausdruecklich gesagt, ob Aufnahmen (Audio/Video) kommen; sonst gilt der Inhaltstyp. */
  audioErwartet?: boolean
  /** Bewusst uebersprungene Schluessel (nur empfohlene; Pflicht laesst sich nicht ueberspringen). */
  uebersprungen?: readonly string[]
}

export interface Option {
  wert: string
  label: string
}

/** Eine Zeile der Tabelle in §5 des Plans. */
export interface Entscheidung {
  /** Zeilennummer der Tabelle in §5. */
  nr: number
  schluessel: string
  titel: string
  /** Frage, wie Wizard und Bruecke sie stellen. */
  frage: string
  gewicht: Gewicht
  schritt: Schritt
  /** Wo die Antwort in der Library steht (Punkt-Pfade, nur zur Anzeige). */
  feldpfade: readonly string[]
  /** Wann die Frage gilt, in Worten. */
  giltWenn: string
  /** Was ohne Antwort gilt; `null` bei Pflicht (ohne Antwort laeuft nichts). */
  vorgabe: string | null
  optionen?: readonly Option[]
  /** Reine Bedingung; fehlt sie, gilt die Frage immer. */
  gilt?: (library: Library, kontext: EinrichtungsKontext) => boolean
  /** Ist die Frage an dieser Library beantwortet? */
  beantwortet: (library: Library, kontext: EinrichtungsKontext) => boolean
  /** Generischer Antwortweg (Bruecke, C3): Schema der Antwort und wie sie in die Library kommt. */
  antwort?: {
    schema: z.ZodType
    anwenden: (library: Library, wert: unknown) => Library
  }
}

export type EntscheidungsStatus = 'beantwortet' | 'offen' | 'uebersprungen'

/** Eine Entscheidung mit ihrem Stand an einer Library (ohne Funktionen, serialisierbar). */
export interface EntscheidungsStand {
  nr: number
  schluessel: string
  titel: string
  frage: string
  gewicht: Gewicht
  schritt: Schritt
  feldpfade: readonly string[]
  giltWenn: string
  vorgabe: string | null
  optionen?: readonly Option[]
  status: EntscheidungsStatus
  /** Kann ueber `entscheidungen` der Bruecke beantwortet werden. */
  beantwortbar: boolean
}

export interface EinrichtungsPruefung {
  /** Offene Pflicht- und empfohlene Entscheidungen, in Wizard-Reihenfolge. */
  offen: EntscheidungsStand[]
  /** Pflicht + empfohlen, die gelten: beantwortet oder bewusst uebersprungen. */
  erledigt: number
  /** Pflicht + empfohlen, die gelten. */
  gesamt: number
  pflichtOffen: boolean
  vollstaendig: boolean
  /** Alle geltenden Entscheidungen mit Stand (auch „spaeter"), fuer Zusammenfassung und Settings. */
  alle: EntscheidungsStand[]
}
