import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, upsertVectors, upsertVectorMeta, deleteVectorsByFileId } from '@/lib/repositories/vector-repo'
import { embedDocumentWithSecretary, embedQuestionWithSecretary } from '@/lib/chat/rag-embeddings'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  content: z.string().min(1),
  mode: z.enum(['A', 'B']).default('A'),
  docModifiedAt: z.string().optional(), // ISO Datum der Originaldatei (für Stale-Check)
  // Dokument-Metadaten (frei erweiterbar, werden im Meta-Vektor gespeichert)
  docMeta: z.record(z.any()).optional(),
  // Kapitel-Infos mit Summaries (optional)
  chapters: z.array(z.object({
    chapterId: z.string().min(1),
    title: z.string().optional(),
    order: z.number().int().optional(),
    summary: z.string().min(1).max(4000),
    startChunk: z.number().int().optional(),
    endChunk: z.number().int().optional(),
    keywords: z.array(z.string()).optional(),
  })).optional(),
  // Optionaler, bereits erkannter TOC (z. B. aus LLM-Analyse)
  toc: z.array(z.object({
    title: z.string(),
    level: z.number().int().optional(),
    page: z.number().int().optional(),
  })).optional()
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const json = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: 'Ungültige Eingabe', details: parsed.error.flatten() }, { status: 400 })
    const { fileId, fileName, content, mode, docModifiedAt, docMeta, chapters, toc } = parsed.data

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const libraryKey = getCollectionNameForLibrary(ctx.library)

    // Idempotenz: vor Upsert alle Vektoren dieses Dokuments entfernen
    await deleteVectorsByFileId(libraryKey, fileId)

    // Secretary Service RAG Embedding für komplettes Dokument
    const ragResult = await embedDocumentWithSecretary(content, ctx, {
      documentId: fileId,
      meta: {
        fileName,
        libraryId,
        userEmail,
        mode,
        docModifiedAt,
      },
    })

    const vectors = ragResult.chunks.map((chunk) => ({
      _id: `${fileId}-${chunk.index}`,
      kind: 'chunk' as const,
      libraryId,
      user: userEmail,
      fileId,
      fileName,
      chunkIndex: chunk.index,
      text: chunk.text.slice(0, 1000),
      embedding: chunk.embedding,
      upsertedAt: new Date().toISOString(),
      ...(docModifiedAt ? { docModifiedAt } : {}),
      ...(chunk.headingContext ? { headingContext: chunk.headingContext } : {}),
      ...(chunk.startChar !== undefined ? { startChar: chunk.startChar } : {}),
      ...(chunk.endChar !== undefined ? { endChar: chunk.endChar } : {}),
      ...(chunk.metadata || {}),
    }))

    // Dimension aus Embedding-Result oder Config holen
    const dimension = ragResult.dimensions || getEmbeddingDimensionForModel(ctx.library.config?.chat)
    
    // Upsert Chunk-Vektoren
    if (vectors.length > 0) {
      await upsertVectors(libraryKey, vectors, dimension, ctx.library)
    }

    // Meta-Dokument erstellen (ohne Embedding)
    const metaDoc = {
      libraryId,
      user: userEmail,
      fileId,
      fileName,
      chunkCount: ragResult.chunks.length,
      chaptersCount: chapters?.length || 0,
      upsertedAt: new Date().toISOString(),
      ...(docModifiedAt ? { docModifiedAt } : {}),
      ...(docMeta ? { docMetaJson: docMeta } : {}),
      ...(Array.isArray(toc) && toc.length > 0
        ? { tocJson: toc.map(t => ({ title: t.title, level: t.level, page: t.page })) }
        : {}),
      ...(chapters && chapters.length > 0
        ? {
            chapters: chapters.map(c => ({
              chapterId: c.chapterId,
              title: c.title,
              order: c.order,
              startChunk: c.startChunk,
              endChunk: c.endChunk,
            })),
          }
        : {}),
    }
    await upsertVectorMeta(libraryKey, metaDoc, dimension, ctx.library)

    // Kapitel-Summaries als eigene Vektoren (Retriever-Ziel)
    const chapterVectors = []
    if (chapters && chapters.length > 0) {
      for (const chapter of chapters) {
        try {
          const chapterEmbedding = await embedQuestionWithSecretary(chapter.summary, ctx)
          chapterVectors.push({
            _id: `${fileId}-chap-${chapter.chapterId}`,
            kind: 'chapterSummary' as const,
            libraryId,
            user: userEmail,
            fileId,
            fileName,
            chapterId: chapter.chapterId,
            chapterTitle: chapter.title,
            chapterOrder: chapter.order,
            startChunk: chapter.startChunk,
            endChunk: chapter.endChunk,
            text: chapter.summary.slice(0, 1200),
            embedding: chapterEmbedding,
            keywords: chapter.keywords,
            upsertedAt: new Date().toISOString(),
            ...(docModifiedAt ? { docModifiedAt } : {}),
          })
        } catch (error) {
          console.warn(`[upsert-file] Fehler beim Embedden von Kapitel-Summary ${chapter.chapterId}:`, error)
        }
      }
    }
    
    if (chapterVectors.length > 0) {
      await upsertVectors(libraryKey, chapterVectors, dimension, ctx.library)
    }

    return NextResponse.json({ status: 'ok', chunks: ragResult.chunks.length, collection: libraryKey })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


