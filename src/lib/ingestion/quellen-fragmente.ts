/**
 * @fileoverview Binaerfragmente einer Sammeldatei und ihrer Quellen in
 * deterministischer Suchreihenfolge (Welle J).
 *
 * @description
 * Die Seitenbilder eines Vortrags liegen am Twin der Folien-PDF aus
 * `_source_files` (PDF-Extraktion, `variant: 'thumbnail' | 'page-render'`,
 * `pageNumber`), nicht am Twin der Sammeldatei. Seit Welle E stehen die
 * Quellen als `compositeSources` am Twin der Sammeldatei. Hier werden die
 * Twins geladen (zwei Abfragen) und geordnet: eigener Twin, dann PDF-Quellen
 * (die mit den meisten Seitenbildern zuerst, bei Gleichstand Reihenfolge der
 * `_source_files`, damit ein zweiseitiger Flyer die Folien nicht verdraengt),
 * dann uebrige Quellen. Folienbilder (J2), Cover (J3) und Anhaenge (J4)
 * rechnen alle auf dieser einen Ordnung.
 *
 * @module ingestion
 */

import { getShadowTwinsBySourceIds, type ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

export interface Fragment {
  name: string
  url: string
  variant?: string
  pageNumber?: number
}

export interface QuellenTwin {
  sourceId: string
  sourceName: string
  fragments: Fragment[]
  /** true fuer die Sammeldatei selbst (immer an erster Stelle). */
  eigener: boolean
}

export type SeitenVariante = 'thumbnail' | 'page-render'

export function fragmenteAusTwin(doc: ShadowTwinDocument | undefined): Fragment[] {
  const out: Fragment[] = []
  for (const raw of doc?.binaryFragments ?? []) {
    const f = raw as Record<string, unknown>
    if (typeof f.name !== 'string' || typeof f.url !== 'string' || !f.url) continue
    out.push({
      name: f.name,
      url: f.url,
      variant: typeof f.variant === 'string' ? f.variant : undefined,
      pageNumber: typeof f.pageNumber === 'number' ? f.pageNumber : undefined,
    })
  }
  return out
}

/** Zahl der Fragmente mit Seitennummer — das Mass fuer „ist das die Folien-PDF?". */
export function seitenbilder(q: { fragments: Fragment[] }): number {
  return q.fragments.filter((f) => typeof f.pageNumber === 'number').length
}

export function istPdf(q: { sourceName: string }): boolean {
  return /\.pdf$/i.test(q.sourceName)
}

/** Einladung oder Flyer am Namen erkennen (J3/J4: Cover-Reihenfolge, Anhang-Reihenfolge). */
export function istFlyer(q: { sourceName: string }): boolean {
  return /flyer|einladung|invitation/i.test(q.sourceName)
}

/** Fragment-URL fuer eine Seite: bevorzugte Variante, sonst die andere. */
export function nachSeite(fragments: Fragment[], page: number, bevorzugt: SeitenVariante): string | undefined {
  const andere: SeitenVariante = bevorzugt === 'thumbnail' ? 'page-render' : 'thumbnail'
  for (const variante of [bevorzugt, andere]) {
    const hit = fragments.find((f) => f.pageNumber === page && f.variant === variante)
    if (hit) return hit.url
  }
  return undefined
}

/** Suchreihenfolge: eigener Twin, PDF-Quellen (meiste Seitenbilder zuerst), Rest. */
export function ordneQuellen(eigener: QuellenTwin, quellen: QuellenTwin[]): QuellenTwin[] {
  const pdfs = quellen.map((q, i) => ({ q, i })).filter(({ q }) => istPdf(q))
    .sort((a, b) => seitenbilder(b.q) - seitenbilder(a.q) || a.i - b.i).map(({ q }) => q)
  const rest = quellen.filter((q) => !istPdf(q))
  return [eigener, ...pdfs, ...rest]
}

/**
 * Twin der Sammeldatei und ihrer `compositeSources` laden und ordnen.
 * Ohne `compositeSources` (Sammeldatei seit Welle E nicht transformiert)
 * bleibt nur der eigene Twin — das sieht der Aufrufer an `sources.length`.
 */
export async function ladeGeordneteQuellen(libraryId: string, fileId: string): Promise<QuellenTwin[]> {
  const eigenerTwin = (await getShadowTwinsBySourceIds({ libraryId, sourceIds: [fileId] })).get(fileId)
  const quellenIds = Array.isArray(eigenerTwin?.compositeSources) ? eigenerTwin.compositeSources : []
  const quellenDocs = quellenIds.length > 0
    ? await getShadowTwinsBySourceIds({ libraryId, sourceIds: quellenIds })
    : new Map<string, ShadowTwinDocument>()

  return ordneQuellen(
    { sourceId: fileId, sourceName: eigenerTwin?.sourceName ?? '', fragments: fragmenteAusTwin(eigenerTwin), eigener: true },
    quellenIds.map((id) => {
      const doc = quellenDocs.get(id)
      return { sourceId: id, sourceName: doc?.sourceName ?? '', fragments: fragmenteAusTwin(doc), eigener: false }
    }),
  )
}
