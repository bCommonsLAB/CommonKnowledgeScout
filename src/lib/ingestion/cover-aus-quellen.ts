/**
 * @fileoverview Cover einer Sammeldatei aus den Seitenbildern ihrer Quellen
 * rechnen (Welle J3).
 *
 * @description
 * Owner 11.10.2026: Bilder sind Sache der Pipeline, nicht des Modells. Fehlt
 * `coverImageUrl` im Frontmatter, nimmt der Ingest
 * 1. die zweite Seite der Folien-PDF (die erste ist meist nur die Titelfolie),
 *    sonst ihre erste Seite — Folien-PDF ist die erste PDF-Quelle in der
 *    Ordnung aus `quellen-fragmente.ts`, die nicht als Flyer erkannt wird;
 * 2. sonst die erste Seite des Flyers (Name mit flyer/einladung), sonst die
 *    erste Seite der ersten PDF-Quelle ueberhaupt.
 * Ein erzeugtes Cover (Library-Einstellung `generateCoverImage`) entsteht in
 * der Template-Phase und steht dann schon im Frontmatter; es kommt hier nicht
 * vor. Ergebnis: `coverImageUrl` aus der page-render-Variante (hochaufloesend
 * fuer die Karte), `coverThumbnailUrl` aus der thumbnail-Variante, je mit
 * Rueckfall auf die andere. Herkunft wird mitgeliefert und landet im Trace
 * (`cover_source`), nie still.
 *
 * @module ingestion
 */

import { istFlyer, istPdf, ladeGeordneteQuellen, nachSeite, seitenbilder, type QuellenTwin } from '@/lib/ingestion/quellen-fragmente'

export interface CoverAusQuellen {
  coverImageUrl: string
  coverThumbnailUrl?: string
  /** Herkunft fuer Trace und Log. */
  quelle: 'slides' | 'flyer'
  sourceId: string
  sourceName: string
  page: number
}

function coverVonTwin(q: QuellenTwin, page: number, quelle: CoverAusQuellen['quelle']): CoverAusQuellen | null {
  const coverImageUrl = nachSeite(q.fragments, page, 'page-render')
  if (!coverImageUrl) return null
  const thumb = nachSeite(q.fragments, page, 'thumbnail')
  return {
    coverImageUrl,
    ...(thumb && thumb !== coverImageUrl ? { coverThumbnailUrl: thumb } : {}),
    quelle, sourceId: q.sourceId, sourceName: q.sourceName, page,
  }
}

/** Reine Auswahl auf einer bereits geordneten Quellenliste (testbar ohne Mongo). */
export function waehleCover(quellen: QuellenTwin[]): CoverAusQuellen | null {
  const pdfs = quellen.filter((q) => !q.eigener && istPdf(q) && seitenbilder(q) > 0)
  const folien = pdfs.find((q) => !istFlyer(q))
  if (folien) {
    const cover = coverVonTwin(folien, 2, 'slides') ?? coverVonTwin(folien, 1, 'slides')
    if (cover) return cover
  }
  const flyer = pdfs.find((q) => istFlyer(q)) ?? pdfs.find((q) => q !== folien)
  if (flyer) {
    const cover = coverVonTwin(flyer, 1, 'flyer')
    if (cover) return cover
  }
  return null
}

/** Cover aus den Quellen-Twins der Sammeldatei; null, wenn keine PDF-Quelle Seitenbilder hat. */
export async function coverAusQuellen(libraryId: string, fileId: string): Promise<CoverAusQuellen | null> {
  return waehleCover(await ladeGeordneteQuellen(libraryId, fileId))
}
