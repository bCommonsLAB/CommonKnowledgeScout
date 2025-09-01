import { randomUUID } from 'crypto'
import { embedTexts } from '@/lib/chat/embeddings'
import { describeIndex, upsertVectorsChunked } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
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
  static async upsertMarkdown(
    userEmail: string,
    libraryId: string,
    fileId: string,
    fileName: string,
    content: string,
    docMeta?: Record<string, unknown>
  ): Promise<{ chunksUpserted: number; docUpserted: boolean; index: string }> {
    FileLogger.info('IngestionService', 'Start upsertMarkdown', {
      libraryId,
      fileId,
      fileName,
      hasDocMeta: !!docMeta,
      contentLength: content.length
    })
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
        kind: 'chunk',
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
    FileLogger.info('IngestionService', 'Chunks upserted', { count: vectors.length })

    // Zusätzlich: Doc-Level-Eintrag mit Metadaten (kind:'doc') upserten
    const summaryText = (typeof (docMeta as { summary?: unknown } | undefined)?.summary === 'string'
      ? (docMeta as { summary: string }).summary
      : content.slice(0, 1200))
      .slice(0, 1200)
    const [docEmbedding] = await embedTexts([summaryText])
    const docVectorId = `${fileId}-doc`
    const docMetadata: Record<string, unknown> = {
      kind: 'doc',
      user: userEmail,
      libraryId,
      fileId,
      fileName,
      upsertedAt: new Date().toISOString(),
    }
    if (docMeta && typeof docMeta === 'object') {
      // Kompakter Metaauszug (kurz + valid)
      const title = (docMeta as { title?: unknown }).title
      const authors = (docMeta as { authors?: unknown }).authors
      const year = (docMeta as { year?: unknown }).year
      const shortTitle = (docMeta as { shortTitle?: unknown }).shortTitle
      if (typeof title === 'string' && title) docMetadata['title'] = title
      if (Array.isArray(authors)) docMetadata['authors'] = authors
      if (typeof year === 'number') docMetadata['year'] = year
      if (typeof shortTitle === 'string' && shortTitle) docMetadata['shortTitle'] = shortTitle

      const compact: Record<string, unknown> = {}
      if (docMetadata['title']) compact['title'] = docMetadata['title']
      if (docMetadata['shortTitle']) compact['shortTitle'] = docMetadata['shortTitle']
      if (docMetadata['authors']) compact['authors'] = docMetadata['authors']
      if (docMetadata['year'] !== undefined) compact['year'] = docMetadata['year']
      try {
        docMetadata['docMetaJson'] = JSON.stringify(compact)
      } catch {
        // ignorieren
      }
    }
    await upsertVectorsChunked(idx.host, apiKey, [{ id: docVectorId, values: docEmbedding, metadata: docMetadata }])
    FileLogger.info('IngestionService', 'Doc upserted', { id: docVectorId })

    return { chunksUpserted: vectors.length, docUpserted: true, index: ctx.vectorIndex }
  }
}


