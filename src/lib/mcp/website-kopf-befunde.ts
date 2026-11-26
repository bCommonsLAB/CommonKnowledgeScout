/**
 * @fileoverview Befunde zum Kopf einer Website-Seite fuer `seite_pruefen` — reine Funktion.
 *
 * @description
 * `hero_tone` (26.11.2026): dieselbe Regel wie Renderer und
 * `dokument_publizieren` (`@ks/module-website`, `hero-ton.ts`), keine zweite
 * Implementierung.
 *
 * @module mcp
 */

import { heroTon, heroTonHinweise } from '@ks/module-website'

/** Die Kopf-Felder einer Seite, wie sie im Meta-Dokument stehen (ungeprueft). */
export interface KopfFelder {
  heroTone: unknown
  heroLayout: unknown
  heroImage: unknown
}

/** `hero_tone` einer Seite: der gueltige Wert (fuer den Bericht), Fehler bei ungueltigem Wert, Warnung, wenn er ohne Wirkung bleibt. */
export function heroTonBefunde(kopf: KopfFelder | undefined): { heroTon?: string; fehler: string[]; warnungen: string[] } {
  if (!kopf) return { fehler: [], warnungen: [] }
  try {
    const ton = heroTon(kopf.heroTone)
    return { ...(ton ? { heroTon: ton } : {}), fehler: [], warnungen: heroTonHinweise(kopf.heroTone, kopf.heroLayout, kopf.heroImage) }
  } catch (error) {
    return { fehler: [`${error instanceof Error ? error.message : String(error)} — der Kopf zeigt die dunkle Fassung`], warnungen: [] }
  }
}
