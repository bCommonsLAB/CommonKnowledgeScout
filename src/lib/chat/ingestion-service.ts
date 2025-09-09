import { randomUUID } from 'crypto'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, upsertVectorsChunked } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { FileLogger } from '@/lib/debug/logger'

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
   * Upsert eines Markdown-Inhalts als Vektor-Chunks in Pinecone und zusätzlich ein Dokument-Metadateneintrag (kind:'doc').
   */
  static async upsertMarkdown(userEmail: string, libraryId: string, fileId: string, fileName: string, markdown: string, meta?: Record<string, unknown>): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string }> {
    FileLogger.info('ingestion', 'Stub upsert', { userEmail, libraryId, fileId, fileName, hasMeta: !!meta });
    // Stub-Implementierung; echte Anbindung später
    return { chunksUpserted: 0, docUpserted: false, index: 'default' };
  }
}


