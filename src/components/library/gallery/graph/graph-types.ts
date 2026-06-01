/**
 * Typen für den generischen Dokument-Graphen (Welle 2).
 *
 * Knoten sind entweder Dokumente (`kind: 'doc'`) oder — im Tag-Hub-Modus —
 * Metadaten-Werte (`kind: 'hub'`). Kanten sind ungerichtet/gewichtet (Quelle B);
 * gerichtete berechnete Kanten (Quelle A) kommen in Welle 4 dazu.
 */

import type { DocCardMeta } from '@/lib/gallery/types'

/** Auswahl der aktiven Kantenquelle (diskriminierte Union, kein Silent Fallback). */
export type EdgeSourceSelection =
  | { kind: 'relations' }
  | { kind: 'similarity' }
  /** Gemeinsame Metadaten über EIN Feld (Obsidian-Stil, Quelle B). */
  | { kind: 'sharedMeta'; field: string; mode: 'hub' | 'projection' }

export interface GraphNode {
  /** Stabile ID: fileId (doc) oder `hub:<field>:<value>` (hub). */
  id: string
  kind: 'doc' | 'hub'
  label: string
  /** Nur bei `kind: 'doc'`. */
  doc?: DocCardMeta
  /** Nur bei `kind: 'hub'`: welches Feld + Wert + Anzahl Dokumente. */
  hubField?: string
  hubValue?: string
  hubCount?: number
  // Von d3-force mutierte Layout-Felder:
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphLink {
  /** d3 ersetzt String-IDs zur Laufzeit durch die Knoten-Objekte. */
  source: string | GraphNode
  target: string | GraphNode
  /** Kantengewicht (Anzahl/Stärke geteilter Werte bzw. 0..1). */
  weight: number
  /**
   * Gerichtete Kante (Quelle A — berechnete „Supports"-Beziehungen, Welle 4):
   * source → target. Die Szene zeichnet dann eine Pfeilspitze. Quelle B/C sind
   * ungerichtet (Feld fehlt/false).
   */
  directed?: boolean
  /** Kurze Begründung der Kante (nur Quelle A). */
  rationale?: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

/** Hilfsfunktion: Knoten-ID einer Link-Endung (String oder Objekt). */
export function endpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id
}
