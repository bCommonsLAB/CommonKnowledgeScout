export interface VectorLike {
  id: string;
  metadata?: Record<string, unknown>;
}

export interface VectorStatsBreakdown {
  doc: number;
  chapterSummary: number;
  chunk: number;
  uniqueDocs: number;
}

/**
 * Aggregiert Zählwerte für Ingestion-Statistiken aus Pinecone-Vektorlisten.
 * - doc: Anzahl Vektoren mit metadata.kind === 'doc' (Dokument-Metadaten)
 * - chapterSummary: Anzahl Vektoren mit metadata.kind === 'chapterSummary'
 * - chunk: Anzahl Vektoren mit metadata.kind === 'chunk'
 * - uniqueDocs: Distinkte fileId-Werte über alle Vektoren (robust gegen fehlende doc‑Meta)
 */
export function accumulateVectorStats(vectors: VectorLike[]): VectorStatsBreakdown {
  let doc = 0;
  let chapterSummary = 0;
  let chunk = 0;
  const uniqueFileIds = new Set<string>();

  for (const v of vectors) {
    const meta = v && typeof v === 'object' ? (v.metadata || {}) as Record<string, unknown> : {};
    const kindVal = (meta as { kind?: unknown }).kind;
    const kind = typeof kindVal === 'string' ? kindVal : undefined;
    const fileIdVal = (meta as { fileId?: unknown }).fileId;
    if (typeof fileIdVal === 'string' && fileIdVal.length > 0) uniqueFileIds.add(fileIdVal);

    if (kind === 'doc') doc += 1;
    else if (kind === 'chapterSummary') chapterSummary += 1;
    else if (kind === 'chunk') chunk += 1;
  }

  return { doc, chapterSummary, chunk, uniqueDocs: uniqueFileIds.size };
}


