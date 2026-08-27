/**
 * Site-Gate des Explorer-Moduls.
 *
 * Duenn mit Absicht: Die Mechanik gehoert in die Schale (jedes Modul braucht
 * sie), die Modul-IDENTITAET gehoert ins Modul. Wuerden die Routen direkt
 * `siteGate('explorer', …)` rufen, waere der String 22-mal in der App verstreut
 * und das Modul haette keine Hoheit ueber seinen eigenen Namen.
 */

import { siteGate, type SiteGateRequest } from '@ks/shell'

/** Modul-Kennung dieses Pakets in der SiteConfig. */
export const EXPLORER_MODULE = 'explorer' as const

/**
 * Prueft, ob das Explorer-Modul fuer die angefragte Site aktiv ist.
 *
 * @returns `null`, wenn die Route ausgeliefert werden darf — sonst die
 *          404-Antwort, die der Handler unveraendert zurueckgeben muss.
 */
export function explorerGate(request: SiteGateRequest): Response | null {
  return siteGate(EXPLORER_MODULE, request)
}
