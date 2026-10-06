/**
 * Ingest-Kontext aus dem Facetten-Schema (Plan `story-status-modalitaet`, m5).
 *
 * Facetten mit `ingestKontext: true` gehen als Klartext in den Metadaten-
 * Vorspann der Chunks und in den Dokument-Embedding-Text — mit Label und,
 * wo ein Bedeutungs-Wörterbuch (`werte`, m1) existiert, mit Bedeutung:
 *
 *   lv_bewertung: nicht_umsetzbar
 *   → Bewertung Landesverwaltung: nicht umsetzbar — Als nicht umsetzbar bewertet; …
 *
 * So trägt JEDER Chunk einer Maßnahme ihren Status, nicht nur der eine, der
 * zufällig die Bewertungszeile enthält. Felder, die der feste Teil des
 * Vorspanns ohnehin schreibt (Titel, Autoren, Jahr, …), werden übersprungen,
 * damit nichts doppelt steht. Deterministisch: Reihenfolge = Facetten-Reihenfolge.
 * Wirkt erst nach erneutem Ingest.
 */

import { formatiereFacettenwert, type KontextFacette } from '@/lib/chat/quellen-kontext'

/** Facette, wie der Ingest sie braucht: Kontext-Flag plus Header-Sicht. */
export interface IngestFacette extends KontextFacette {
  ingestKontext?: boolean
}

export interface IngestKontextPaar {
  label: string
  text: string
}

/**
 * Label/Text-Paare aller Facetten mit `ingestKontext`, deren Wert im
 * Dokument steht. `ausgeschlossen` nennt die Felder, die der Aufrufer schon
 * selbst schreibt.
 */
export function ingestKontextPaare(
  docMetaJsonObj: Record<string, unknown>,
  facetDefs: ReadonlyArray<IngestFacette> | undefined,
  ausgeschlossen: ReadonlySet<string>,
): IngestKontextPaar[] {
  if (!facetDefs || facetDefs.length === 0) return []
  const paare: IngestKontextPaar[] = []
  for (const facette of facetDefs) {
    if (facette.ingestKontext !== true) continue
    if (ausgeschlossen.has(facette.metaKey)) continue
    const text = formatiereFacettenwert(docMetaJsonObj[facette.metaKey], facette)
    if (text === undefined || text.trim().length === 0) continue
    paare.push({ label: facette.label || facette.metaKey, text })
  }
  return paare
}
