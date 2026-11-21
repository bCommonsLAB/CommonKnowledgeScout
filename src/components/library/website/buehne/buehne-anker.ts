/**
 * Anker der Fragen-Sektion → Anker des Players (Plan `commonux-buehne-fragen-sektion`, P4).
 * Die Sektion nennt Belege bei ihrer ID (`fileId`); der Player kennt Darsteller.
 */
import { gespraechDarstellerId } from '@commonux/player/format'
import type { DarstellerAnker } from '@commonux/player'
import type { WebsiteBelegAnker } from '@ks/module-website/react'

export function ankerFuerPlayer(anker: readonly WebsiteBelegAnker[]): DarstellerAnker[] {
  return anker.map((a) => ({ id: gespraechDarstellerId('beleg', a.belegId), marken: a.marken }))
}
