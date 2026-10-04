/**
 * Status-Updates für Chat-Verarbeitung — App-Shim.
 *
 * Die Form liegt seit D2 (Plan `story-dreiteilung-fragenchronik`) in
 * `@ks/contracts`, weil das Paket `@ks/module-story` sie fuer den
 * Verarbeitungsstatus in einfachen Worten liest. Die App-Nutzer importieren
 * unveraendert von hier; `formatSSE` bleibt Server-Helfer der App.
 */

import type { ChatProcessingStep } from '@ks/contracts'

export type { ChatProcessingStep }

/**
 * Format für SSE-Nachrichten
 */
export function formatSSE(data: ChatProcessingStep): string {
  return `data: ${JSON.stringify(data)}\n\n`
}
