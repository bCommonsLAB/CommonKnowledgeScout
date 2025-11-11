export interface UpsertVector {
  id: string
  values: number[]
  metadata?: Record<string, unknown>
}

/**
 * Robustes JSON-Parsing für HTTP-Antworten.
 * - Leerer Body => {} statt SyntaxError
 * - Ungültiges JSON => wir werfen mit gekürztem Body für Debugging
 */
async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  const trimmed = text.trim()
  if (trimmed.length === 0) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error(`Ungueltiges JSON (Status ${res.status}): ${trimmed.slice(0, 400)}`)
  }
}

export async function upsertVectors(indexHost: string, apiKey: string, vectors: UpsertVector[]): Promise<void> {
  const url = `https://${indexHost}/vectors/upsert`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ vectors })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Upsert Fehler: ${res.status} ${err}`)
  }
}

/**
 * Upsert in kleinen Batches, um Pinecone 2MB Request-Limit einzuhalten.
 */
export async function upsertVectorsChunked(indexHost: string, apiKey: string, vectors: UpsertVector[], maxPerBatch: number = 10): Promise<void> {
  for (let i = 0; i < vectors.length; i += maxPerBatch) {
    const batch = vectors.slice(i, i + maxPerBatch)
    await upsertVectors(indexHost, apiKey, batch)
  }
}

export interface QueryMatch {
  id: string
  score?: number
  metadata?: Record<string, unknown>
}

export async function queryVectors(indexHost: string, apiKey: string, vector: number[], topK: number, filter?: Record<string, unknown>): Promise<QueryMatch[]> {
  // Query-Endpunkt (Serverless): /query
  const url = `https://${indexHost}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, topK, includeMetadata: true, filter, namespace: '' })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Query Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { matches?: Array<{ id: string; score?: number; metadata?: Record<string, unknown> }> }
  const matches = Array.isArray(data?.matches) ? data.matches : []
  return matches.map((m): QueryMatch => {
    const id = String((m as { id?: unknown }).id ?? '')
    const scoreVal = (m as { score?: unknown }).score
    const score = typeof scoreVal === 'number' ? scoreVal : undefined
    const metadata = (m as { metadata?: unknown }).metadata
    const meta = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : undefined
    return { id, score, metadata: meta }
  })
}

export async function fetchVectors(indexHost: string, apiKey: string, ids: string[], namespace: string = ''): Promise<Record<string, { id: string; metadata?: Record<string, unknown> }>> {
  const url = `https://${indexHost}/vectors/fetch`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, includeMetadata: true, namespace })
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Fetch Fehler: ${res.status} ${err}`)
  }
  const data = await parseJsonSafe(res) as { vectors?: Record<string, { metadata?: Record<string, unknown> }> }
  const vectors = data?.vectors || {}
  const out: Record<string, { id: string; metadata?: Record<string, unknown> }> = {}
  for (const k of Object.keys(vectors)) {
    out[k] = { id: k, metadata: vectors[k]?.metadata }
  }
  return out
}

export async function listVectors(
  indexHost: string,
  apiKey: string,
  filter?: Record<string, unknown>,
  limitPerPage: number = 1000,
): Promise<Array<{ id: string; metadata?: Record<string, unknown> }>> {
  const url = `https://${indexHost}/vectors/list`
  const out: Array<{ id: string; metadata?: Record<string, unknown> }> = []
  let next: unknown = undefined
  // Paginierte Auflistung aller Vektoren, optional gefiltert
  // Hinweis: Serverless API akzeptiert { namespace, filter, includeMetadata, pagination }
  for (let guard = 0; guard < 100; guard++) {
    const body: Record<string, unknown> = {
      namespace: '',
      includeMetadata: true,
      filter,
      pagination: { limit: limitPerPage, ...(next ? { next } : {}) },
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Pinecone List Fehler: ${res.status} ${err}`)
    }
    const data = await parseJsonSafe(res) as { vectors?: unknown; pagination?: { next?: unknown } }
    const vectorsRaw = (data as { vectors?: unknown }).vectors
    if (Array.isArray(vectorsRaw)) {
      for (const v of vectorsRaw) {
        if (!v || typeof v !== 'object') continue
        const id = String((v as { id?: unknown }).id ?? '')
        const metaRaw = (v as { metadata?: unknown }).metadata
        const metadata = metaRaw && typeof metaRaw === 'object' ? metaRaw as Record<string, unknown> : undefined
        if (id) out.push({ id, metadata })
      }
    } else if (vectorsRaw && typeof vectorsRaw === 'object') {
      // Manche Antworten sind als Map-Objekt { id: {metadata} }
      for (const [k, v] of Object.entries(vectorsRaw as Record<string, unknown>)) {
        const metaRaw = (v as { metadata?: unknown })?.metadata
        const metadata = metaRaw && typeof metaRaw === 'object' ? metaRaw as Record<string, unknown> : undefined
        out.push({ id: k, metadata })
      }
    }
    next = (data?.pagination && typeof data.pagination === 'object') ? (data.pagination as { next?: unknown }).next : undefined
    if (!next) break
  }
  return out
}

export async function describeIndex(indexName: string, apiKey: string): Promise<{ host: string; dimension?: number } | null> {
  const res = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(indexName)}`, {
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  if (!res.ok) return null
  const data = await parseJsonSafe(res) as { host?: string; dimension?: unknown; spec?: { pod?: { environment?: string; pods?: number; replicas?: number; shards?: number; pod_type?: string; metadata_config?: unknown; source_collection?: unknown; region?: string; dimension?: unknown }, serverless?: { cloud?: string; region?: string; capacity?: string; metadata_config?: unknown; dimension?: unknown } } }
  const host: string | undefined = data?.host
  const dimRaw = (data?.dimension ?? data?.spec?.pod?.dimension ?? data?.spec?.serverless?.dimension) as unknown
  const dimension = typeof dimRaw === 'number' ? dimRaw : undefined
  return host ? { host, dimension } : null
}

export async function deleteByFilter(indexHost: string, apiKey: string, filter: Record<string, unknown>): Promise<void> {
  const url = `https://${indexHost}/vectors/delete`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ deleteAll: false, ids: [], filter })
  })
  // Wenn Namespace noch nicht existiert (erste Benutzung), kann Pinecone 404 "Namespace not found" liefern.
  // Das ist in diesem Fall unkritisch: Wir wollen ja nur sicherstellen, dass nichts Altes vorhanden ist.
  if (res.status === 404) {
    return
  }
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinecone Delete Fehler: ${res.status} ${err}`)
  }
}

/**
 * Zentrale Pinecone-Abfrage-Funktion für FileID-basierte Abfragen
 * 
 * @description
 * Konsolidierte Funktion für Pinecone-Abfragen basierend auf FileIDs (nach MongoDB-Filterung).
 * Unterstützt sowohl semantische Suche mit Embedding-Vektor als auch Null-Vektor-Suche.
 * Handhabt Owner-Email für öffentliche Libraries automatisch.
 * 
 * @param indexName - Name des Pinecone-Index
 * @param apiKey - Pinecone API-Key
 * @param fileIds - Array von FileIDs (nach MongoDB-Filterung)
 * @param queryVector - Optional: Embedding-Vektor für semantische Suche. Wenn nicht angegeben, wird Null-Vektor verwendet
 * @param topK - Anzahl der zurückzugebenden Ergebnisse
 * @param libraryId - Library-ID für Filter
 * @param userEmail - User-Email für Filter (wird automatisch zu Owner-Email für öffentliche Libraries)
 * @param kind - Art der Chunks: 'chunk' oder 'chapterSummary'
 * @param timeoutMs - Timeout in Millisekunden (Standard: 30000)
 * @returns Array von QueryMatch-Ergebnissen
 */
export async function queryPineconeByFileIds(
  indexName: string,
  apiKey: string,
  fileIds: string[],
  queryVector: number[] | undefined,
  topK: number,
  libraryId: string,
  userEmail: string,
  kind: 'chunk' | 'chapterSummary',
  timeoutMs: number = 30000
): Promise<QueryMatch[]> {
  // Leere FileIDs-Liste: Keine Ergebnisse
  if (fileIds.length === 0) {
    return []
  }

  // Index beschreiben
  const idx = await describeIndex(indexName, apiKey)
  if (!idx?.host) {
    throw new Error(
      `Index nicht gefunden: "${indexName}". ` +
      `Bitte prüfe, ob der Index in Pinecone existiert oder ob der Index-Name in der Library-Konfiguration korrekt ist. ` +
      `Tipp: Verwende config.vectorStore.indexOverride in der Library-Konfiguration, um einen spezifischen Index-Namen festzulegen.`
    )
  }

  // Owner-Email für öffentliche Libraries ermitteln (wenn userEmail leer)
  let effectiveUserEmail = userEmail
  if (!effectiveUserEmail) {
    const { findLibraryOwnerEmail } = await import('@/lib/chat/loader')
    const ownerEmail = await findLibraryOwnerEmail(libraryId)
    if (ownerEmail) {
      effectiveUserEmail = ownerEmail
      console.log('[queryPineconeByFileIds] Owner-Email ermittelt für öffentliche Library:', effectiveUserEmail.split('@')[0] + '@...')
    }
  }

  if (!effectiveUserEmail) {
    throw new Error('Benutzer-Email erforderlich für Pinecone-Abfrage')
  }

  // Pinecone-Filter mit $and-Struktur aufbauen
  // HINWEIS: MongoDB-spezifische Filter (track, year, speakers, etc.) werden NICHT übernommen,
  // da die fileIds bereits durch MongoDB-Filter gefiltert wurden. Diese Filter würden in Pinecone
  // keine Ergebnisse liefern, da sie nicht in allen Chunk-Metadaten vorhanden sind.
  const pineconeFilter: Record<string, unknown> = {
    $and: [
      { libraryId: { $eq: libraryId } },
      { user: { $eq: effectiveUserEmail } },
      { fileId: { $in: fileIds } },
      { kind: { $eq: kind } },
    ],
  }

  // Query-Vektor: Wenn nicht angegeben, Null-Vektor verwenden
  const dim = typeof idx.dimension === 'number' ? idx.dimension : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
  const vector = queryVector || new Array<number>(dim).fill(0)

  // Pinecone-Abfrage mit Timeout
  try {
    const matches = await Promise.race([
      queryVectors(idx.host, apiKey, vector, topK, pineconeFilter),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Pinecone query timeout after ' + timeoutMs + 'ms')), timeoutMs)
      )
    ])
    return matches
  } catch (error) {
    console.error('[queryPineconeByFileIds] Fehler bei Pinecone-Query:', error)
    throw error
  }
}


