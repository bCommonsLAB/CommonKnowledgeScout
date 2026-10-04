/**
 * Site-Gate des Story-Moduls.
 *
 * Gleiche Form wie `explorerGate` in `@ks/module-explorer`: Der Mechanismus
 * (Host → SiteConfig → Modul aktiv?) gehoert der Schale, die Modul-Kennung
 * dem Modul. Heute laufen die Story-Routen (`/api/chat/[libraryId]/chats`,
 * `queries`, `stream`) noch unter dem Explorer-Gate; der Umzug der Routen
 * in diesen Namensraum ist Welle D6 (Plan `story-dreiteilung-fragenchronik`).
 */

import { siteGate, type SiteGateRequest } from '@ks/shell'

/** Modul-Kennung dieses Pakets in der SiteConfig. */
export const STORY_MODULE = 'story' as const

/**
 * @returns `null`, wenn die Route ausgeliefert werden darf — sonst die
 *          404-Antwort, die der Handler unveraendert zurueckgeben muss.
 */
export function storyGate(request: SiteGateRequest): Response | null {
  return siteGate(STORY_MODULE, request)
}
