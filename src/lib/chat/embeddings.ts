interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number; object: string }>;
}

/**
 * Erstellt Embeddings in Batches, um das Tokenlimit pro Request nicht zu überschreiten.
 * Näherung: ~4 Zeichen pro Token. Für text-embedding-3-large (8192 Tokens) setzen wir konservativ ~24k Zeichen Budget.
 * @param apiKey Optional: Library-spezifischer OpenAI API-Key. Wenn nicht gesetzt, wird der globale OPENAI_API_KEY verwendet.
 */
export async function embedTexts(texts: string[], model?: string, apiKey?: string): Promise<number[][]> {
  const effectiveApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!effectiveApiKey) throw new Error('OPENAI_API_KEY fehlt')
  const m = model || process.env.OPENAI_EMBEDDINGS_MODEL_NAME || 'text-embedding-3-large'

  const charBudget = Number(process.env.OPENAI_EMBEDDINGS_MAX_BATCH_CHARS || 24000)
  const maxBatchSize = Number(process.env.OPENAI_EMBEDDINGS_MAX_BATCH || 16)

  const batches: string[][] = []
  let current: string[] = []
  let currentChars = 0
  for (const t of texts) {
    const add = t.length
    const wouldExceed = (currentChars + add) > charBudget || current.length >= maxBatchSize
    if (current.length > 0 && wouldExceed) {
      batches.push(current)
      current = []
      currentChars = 0
    }
    current.push(t)
    currentChars += add
  }
  if (current.length > 0) batches.push(current)

  const results: number[][] = []
  for (const batch of batches) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: batch, model: m })
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI Embeddings Fehler: ${res.status} ${err}`)
    }
    const data = await res.json() as EmbeddingResponse
    // Sortiere nach index, um Reihenfolge stabil zu halten
    data.data.sort((a, b) => a.index - b.index)
    for (const d of data.data) results.push(d.embedding)
  }
  return results
}


