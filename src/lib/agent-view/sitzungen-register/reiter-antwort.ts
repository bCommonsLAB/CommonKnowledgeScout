/**
 * @fileoverview Antwort-Formen der Routen des Reiters „Sitzungen" (Register, Welle R3).
 *
 * @description
 * Geteilt von Route und Hook, damit beide dieselbe Form kennen.
 *
 * @module agent-view/sitzungen-register
 */

import type { SitzungsBilanz } from './filter'
import type { SitzungsSicht } from './types'

/** GET `…/agent-view/sitzungen`. */
export interface SitzungenAntwort {
  /** Alle Zeilen, juengste zuerst. */
  zeilen: SitzungsSicht[]
  bilanz: SitzungsBilanz
  /** Wie viele Belege ohne Notiz einzeln im Speicher nachgesehen wurden. */
  imSpeicherGeprueft: number
  geladenAm: string
}

/** PATCH `…/agent-view/sitzungen/[registerId]`. */
export interface SitzungSetzenAntwort {
  registerId: string
  geaendert: string[]
  unveraendert: boolean
  umgeschluesselt: { von: string; nach: string } | null
  zusammengefuehrt: string | null
}
