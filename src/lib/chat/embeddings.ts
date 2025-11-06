import { fetchWithTimeout, TimeoutError, NetworkError } from '@/lib/utils/fetch-with-timeout'

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
  const timeoutMs = Number(process.env.OPENAI_EMBEDDINGS_TIMEOUT_MS || 60000) // Default 60 Sekunden
  const maxRetries = Number(process.env.OPENAI_EMBEDDINGS_MAX_RETRIES || 3)

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
    let lastError: Error | undefined
    let retryCount = 0
    
    while (retryCount <= maxRetries) {
      try {
        const res = await fetchWithTimeout('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${effectiveApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ input: batch, model: m }),
          timeoutMs
        })
        
        if (!res.ok) {
          const err = await res.text()
          const status = res.status
          
          // Retry bei transient errors (503, 429, 500-502)
          const isTransientError = status === 503 || status === 429 || (status >= 500 && status < 504)
          if (isTransientError && retryCount < maxRetries) {
            retryCount++
            const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000) // Exponential backoff, max 10s
            console.warn(`[embedTexts] Transient error ${status}, retry ${retryCount}/${maxRetries} after ${backoffMs}ms`)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
            continue
          }
          
          throw new Error(`OpenAI Embeddings Fehler: ${status} ${err}`)
        }
        
        const data = await res.json() as EmbeddingResponse
        // Sortiere nach index, um Reihenfolge stabil zu halten
        data.data.sort((a, b) => a.index - b.index)
        for (const d of data.data) results.push(d.embedding)
        break // Erfolg, aus Retry-Loop ausbrechen
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        
        // Retry bei Timeout oder Network-Fehlern
        const isRetryable = e instanceof TimeoutError || e instanceof NetworkError
        if (isRetryable && retryCount < maxRetries) {
          retryCount++
          const backoffMs = Math.min(1000 * Math.pow(2, retryCount - 1), 10000) // Exponential backoff, max 10s
          console.warn(`[embedTexts] ${e instanceof TimeoutError ? 'Timeout' : 'Network error'}, retry ${retryCount}/${maxRetries} after ${backoffMs}ms`)
          await new Promise(resolve => setTimeout(resolve, backoffMs))
          continue
        }
        
        // Nicht retrybar oder max retries erreicht
        throw lastError
      }
    }
    
    // Falls wir hier ankommen ohne Erfolg, sollte ein Fehler geworfen worden sein
    if (lastError) throw lastError
  }
  return results
}


