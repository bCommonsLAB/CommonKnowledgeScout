/**
 * @fileoverview Chunks des unsichtbaren Ingest-Anhangs kennzeichnen.
 *
 * Der eingebettete Text ist `body + "\n\n" + anhang`. Die Chunk-Offsets des
 * Secretary beziehen sich auf diesen Gesamttext. Hier wird jedem Chunk, der im
 * Anhang liegt, sein Kapitel zugeordnet (`sourceType: 'anhang'`, `anhangIndex`,
 * `anhangTitle`, `anhangQuelle`), damit der Retriever die Herkunft benennen
 * kann. Seitenanker (`--- Seite N ---`) werden je Kapitel getrennt gezaehlt,
 * sonst wuerden die Seiten eines PDF-Anhangs auf den Body abfaerben.
 *
 * Reine Funktionen, deterministisch (ingestion-contracts.md §1).
 */

import type { SourceAppendix } from '@/types/external-jobs'
import { splitByPages, type PageSpan } from './page-split'
import type { VectorDocument } from './vector-builder'

/**
 * Seitenspannen fuer Body und Anhang getrennt: Body-Anker aus `bodyMarkdown`,
 * Anhang-Anker je Kapitel, um `anhangOffset` + Kapitelstart verschoben.
 */
export function anhangPageSpans(
  bodyMarkdown: string,
  appendix: SourceAppendix | undefined,
  anhangOffset: number,
): PageSpan[] {
  const spans: PageSpan[] = [...splitByPages(bodyMarkdown)]
  if (!appendix) return spans
  for (const section of appendix.sections) {
    const text = appendix.markdown.slice(section.start, section.end)
    const base = anhangOffset + section.start
    for (const s of splitByPages(text)) {
      spans.push({ page: s.page, startIdx: s.startIdx + base, endIdx: s.endIdx + base })
    }
  }
  return spans
}

/** Markiert Chunks, deren Start im Anhang liegt, mit ihrem Kapitel. Liefert die Anzahl. */
export function markiereAnhangChunks(
  vectors: VectorDocument[],
  appendix: SourceAppendix | undefined,
  anhangOffset: number,
): number {
  if (!appendix) return 0
  let markiert = 0
  for (const v of vectors) {
    if (typeof v.startChar !== 'number' || v.startChar < anhangOffset) continue
    const rel = v.startChar - anhangOffset
    const section = appendix.sections.find((s) => rel >= s.start && rel < s.end)
    if (!section) continue
    v.sourceType = 'anhang'
    v.anhangIndex = section.index
    v.anhangTitle = section.title
    v.anhangQuelle = section.sourceName
    markiert += 1
  }
  return markiert
}
