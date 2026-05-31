/**
 * Generische, config-getriebene Knoten-Encodings für den Graph-Modus.
 *
 * Liest ausschließlich konfigurierte meta-Feldnamen aus `DocCardMeta` — kennt
 * KEINE Klima-Felder (Zielbild §6.2). Fehlende/ungültige Werte werden explizit
 * mit dokumentierten Defaults behandelt (keine Silent Fallbacks, die Fehler
 * verschleiern: ein fehlendes optionales Feld ist hier ein gültiger Zustand).
 */

import type { DocCardMeta } from '@/lib/gallery/types'

const MIN_RADIUS = 6
const MAX_RADIUS = 28
const HUB_RADIUS = 10
/** Default-Palette für kategorische Farben ohne `colorMap`-Eintrag. */
const DEFAULT_PALETTE = [
  '#2563eb', '#16a34a', '#ea580c', '#ca8a04',
  '#9333ea', '#0891b2', '#dc2626', '#4b5563',
]

/** Liest einen numerischen meta-Wert generisch (dynamischer Feldname). */
export function readNumber(doc: DocCardMeta, key?: string): number | null {
  if (!key) return null
  const v = (doc as unknown as Record<string, unknown>)[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Liest einen kategorischen (String-)meta-Wert generisch. */
export function readString(doc: DocCardMeta, key?: string): string | null {
  if (!key) return null
  const v = (doc as unknown as Record<string, unknown>)[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** Maximaler Wert des Größe-Felds über alle Dokumente (für die Skalierung). */
export function maxOf(docs: DocCardMeta[], key?: string): number {
  let max = 0
  for (const d of docs) {
    const n = readNumber(d, key)
    if (n !== null && n > max) max = n
  }
  return max
}

/**
 * Knotenradius via sqrt-Skala (Fläche ~ Wert) zwischen MIN und MAX.
 * Ohne `sizeField` oder ohne Wert: MIN_RADIUS (sichtbarer Mindest-Knoten).
 */
export function nodeRadius(doc: DocCardMeta, sizeField: string | undefined, domainMax: number): number {
  const v = readNumber(doc, sizeField)
  if (v === null || domainMax <= 0) return MIN_RADIUS
  const t = Math.sqrt(Math.max(0, v) / domainMax)
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS)
}

/** Radius eines Hub-Knotens, leicht wachsend mit der Anzahl Dokumente. */
export function hubRadius(count: number): number {
  return HUB_RADIUS + Math.min(12, Math.sqrt(Math.max(1, count)) * 2)
}

/**
 * Knotenfarbe aus `colorField` + `colorMap`. Werte ohne Map-Eintrag bekommen
 * eine stabile Palette-Farbe (deterministisch über den Wert), kein zufälliges
 * Ausweichen. Ohne `colorField`: neutrale Default-Farbe.
 */
export function nodeColor(
  doc: DocCardMeta,
  colorField: string | undefined,
  colorMap: Record<string, string> | undefined,
): string {
  const value = readString(doc, colorField)
  if (!value) return DEFAULT_PALETTE[7]
  if (colorMap && colorMap[value]) return colorMap[value]
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return DEFAULT_PALETTE[hash % DEFAULT_PALETTE.length]
}

/** Knoten-Deckkraft aus `opacityField` (0..1), geklemmt; Default 1. */
export function nodeOpacity(doc: DocCardMeta, opacityField: string | undefined): number {
  const v = readNumber(doc, opacityField)
  if (v === null) return 1
  return Math.max(0.15, Math.min(1, v))
}
