/**
 * @fileoverview Merkmale je Inhaltstyp, an denen Bedingungen des
 * Entscheidungskatalogs haengen (Plan speicher-verbindungen-und-library-anlage, C1).
 *
 * @description
 * Bewusst als vollstaendige Map ueber alle `DetailViewType`s: ein neuer
 * Inhaltstyp bricht hier die Typpruefung, statt still „kein Audio" zu erben
 * (no-silent-fallbacks). Owner-Entscheid E6: die Fragen nach Sprachen der
 * Aufnahmen und bekannten Namen kommen nur, wenn Audio erwartet wird.
 *
 * @module library-setup
 */

import { isDetailViewType, type DetailViewType } from '@/lib/detail-view-types/registry'
import type { Library } from '@/types/library'
import type { EinrichtungsKontext } from './typen'

export interface InhaltstypMerkmale {
  /** Kommen typischerweise Aufnahmen (Audio/Video), die transkribiert werden? */
  audioErwartet: boolean
  /** Bietet der Inhaltstyp „Inhalte erfassen"-Wizards an? */
  erfassenWizards: boolean
}

export const INHALTSTYP_MERKMALE: Record<DetailViewType, InhaltstypMerkmale> = {
  book: { audioErwartet: false, erfassenWizards: false },
  session: { audioErwartet: true, erfassenWizards: true },
  testimonial: { audioErwartet: true, erfassenWizards: true },
  blog: { audioErwartet: false, erfassenWizards: false },
  climateAction: { audioErwartet: false, erfassenWizards: false },
  divaDocument: { audioErwartet: false, erfassenWizards: false },
  divaTexture: { audioErwartet: false, erfassenWizards: false },
  refurbedDevice: { audioErwartet: false, erfassenWizards: false },
  website: { audioErwartet: false, erfassenWizards: false },
}

/** Der Inhaltstyp der Library oder `null`, wenn (noch) keiner gesetzt ist. */
export function inhaltstypVon(library: Library): DetailViewType | null {
  const typ = library.config?.chat?.gallery?.detailViewType
  if (typ === undefined) return null
  if (!isDetailViewType(typ)) throw new Error(`Library "${library.label}": unbekannter Inhaltstyp "${String(typ)}"`)
  return typ
}

/**
 * Audio erwartet? Ausdrueckliche Angabe im Kontext gewinnt; sonst zaehlt eine
 * schon gesetzte Transkriptions-Einstellung; sonst der Inhaltstyp.
 */
export function audioErwartet(library: Library, kontext: EinrichtungsKontext): boolean {
  if (kontext.audioErwartet !== undefined) return kontext.audioErwartet
  const config = library.config
  if (config?.transcriptionSpeakerMode !== undefined || config?.transcriptionLanguages !== undefined) return true
  const typ = inhaltstypVon(library)
  return typ !== null && INHALTSTYP_MERKMALE[typ].audioErwartet
}

/** Bietet der Inhaltstyp „Inhalte erfassen"-Wizards an? */
export function hatErfassenWizards(library: Library): boolean {
  const typ = inhaltstypVon(library)
  return typ !== null && INHALTSTYP_MERKMALE[typ].erfassenWizards
}
