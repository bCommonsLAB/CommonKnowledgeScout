import { randomUUID } from 'crypto'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, upsertVectorsChunked } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

/**
 * Stub-Service zum Enqueue einer Ingestion.
 * Hier später: Markdown scannen → Summaries erzeugen → Embeddings upserten.
 */
export class IngestionService {
  static async enqueueLibraryIngestion(userEmail: string, libraryId: string): Promise<{ jobId: string }> {
    const jobId = randomUUID()
    // eslint-disable-next-line no-console
    console.log('[Ingestion] Enqueued library ingestion', { userEmail, libraryId, jobId })
    // TODO: Job in DB persistieren / Worker triggern
    return { jobId }
  }

  /**
   * Minimaler Ingestion-Lauf: erzeugt für einen Testtext ein Embedding und upsertet ihn in Pinecone.
   * Dient als End-to-End-Validierung der Pipeline.
   */
  static async runMinimalTest(userEmail: string, libraryId: string): Promise<{ index: string; id: string }> {
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) throw new Error('Bibliothek nicht gefunden')

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')

    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) throw new Error('Index nicht gefunden oder ohne Host')

    const text = `Testchunk for ${ctx.library.label} at ${new Date().toISOString()}`
    const [embedding] = await embedTexts([text])
    const id = `test-${randomUUID()}`
    await upsertVectorsChunked(idx.host, apiKey, [{ id, values: embedding, metadata: { kind: 'test', user: userEmail, libraryId } }])
    return { index: ctx.vectorIndex, id }
  }

  /**
   * Upsert eines Markdown-Inhalts als Vektor-Chunks in Pinecone.
   */
  static async upsertMarkdown(userEmail: string, libraryId: string, fileId: string, fileName: string, content: string): Promise<{ upserted: number; index: string }> {
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) throw new Error('Bibliothek nicht gefunden')
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY fehlt')
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) throw new Error('Index nicht gefunden oder ohne Host')

    function chunkText(input: string, maxChars: number = 1500, overlap: number = 150): string[] {
      const out: string[] = []
      let i = 0
      const n = input.length
      while (i < n) {
        const end = Math.min(n, i + maxChars)
        out.push(input.slice(i, end))
        if (end >= n) break
        i = Math.max(end - overlap, i + 1)
      }
      return out
    }

    const chunks = chunkText(content)
    const embeddings = await embedTexts(chunks)
    const vectors = embeddings.map((values, i) => ({
      id: `${fileId}-${i}`,
      values,
      metadata: {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        mode: 'auto',
        chunkIndex: i,
        text: chunks[i].slice(0, 1000),
        upsertedAt: new Date().toISOString(),
      }
    }))
    await upsertVectorsChunked(idx.host, apiKey, vectors)
    return { upserted: vectors.length, index: ctx.vectorIndex }
  }
}


