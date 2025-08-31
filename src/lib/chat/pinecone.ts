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
  const url = `https://${indexHost}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vector, topK, includeMetadata: true, filter })
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

export async function describeIndex(indexName: string, apiKey: string): Promise<{ host: string } | null> {
  const res = await fetch(`https://api.pinecone.io/indexes/${encodeURIComponent(indexName)}`, {
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    cache: 'no-store'
  })
  if (!res.ok) return null
  const data = await parseJsonSafe(res) as { host?: string }
  const host: string | undefined = data?.host
  return host ? { host } : null
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


