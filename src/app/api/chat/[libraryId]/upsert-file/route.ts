import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import type { UpsertVector } from '@/lib/chat/pinecone'
import { embedTexts } from '@/lib/chat/embeddings'

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

function chunkText(input: string, maxChars: number = 1000, overlap: number = 100): string[] {
  const chunks: string[] = []

  // Sicherheitsgrenzen
  const maxC = Math.max(200, Math.min(maxChars, 2000))
  const ov = Math.max(0, Math.min(overlap, Math.floor(maxC / 2)))

  let i = 0
  const n = input.length
  while (i < n) {
    const sliceEnd = Math.min(i + maxC, n)
    // Bevorzugt an Zeilenumbruch schneiden
    let cut = input.lastIndexOf('\n', sliceEnd)
    if (cut < i + Math.floor(maxC * 0.6)) {
      // Falls kein sinnvoller Zeilenumbruch, nach Leerzeichen/Punkt suchen
      const spaceCut = input.lastIndexOf(' ', sliceEnd)
      const dotCut = input.lastIndexOf('.', sliceEnd)
      cut = Math.max(cut, spaceCut, dotCut)
    }
    if (cut < i + Math.floor(maxC * 0.5)) {
      // Notfall: harte Kante
      cut = sliceEnd
    }

    const part = input.slice(i, cut)
    if (part.trim().length > 0) chunks.push(part)

    // Overlap anwenden
    i = Math.max(cut - ov, i + maxC)
  }
  return chunks
}

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

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    // Idempotenz: vor Upsert alle Vektoren dieses Dokuments entfernen
    await deleteByFilter(idx.host, apiKey, { user: { $eq: userEmail }, libraryId: { $eq: libraryId }, fileId: { $eq: fileId } })

    const chunks = chunkText(content, 1500)
    const embeddings = await embedTexts(chunks)
    const vectors: UpsertVector[] = embeddings.map((values, i) => ({
      id: `${fileId}-${i}`,
      values,
      metadata: {
        user: userEmail,
        libraryId,
        fileId,
        fileName,
        mode,
        chunkIndex: i,
        // Beschränke Text im Metadata-Feld
        text: chunks[i].slice(0, 1000),
        upsertedAt: new Date().toISOString(),
        docModifiedAt
      }
    }))
    // Zusätzlich: Meta-Vektor für Dokument-Status (nutzt erstes Embedding als Vektor)
    if (embeddings.length > 0) {
      vectors.push({
        id: `${fileId}-meta`,
        values: embeddings[0],
        metadata: {
          user: userEmail,
          libraryId,
          fileId,
          fileName,
          kind: 'doc',
          chunkCount: embeddings.length,
          upsertedAt: new Date().toISOString(),
          docModifiedAt,
          // Hinweis: Pinecone-Serverless erlaubt nur primitive Metadaten oder List<string>.
          // Deshalb serialisieren wir strukturierte Felder als JSON-String.
          docMetaJson: docMeta ? JSON.stringify(docMeta) : undefined,
          tocJson: (Array.isArray(toc) && toc.length > 0)
            ? JSON.stringify(toc.map(t => ({ title: t.title, level: t.level, page: t.page })))
            : (chapters && chapters.length > 0
              ? JSON.stringify(chapters.map(c => ({
                  chapterId: c.chapterId,
                  title: c.title,
                  order: c.order,
                  startChunk: c.startChunk,
                  endChunk: c.endChunk,
                })))
              : undefined)
        } as Record<string, unknown>
      })
    }

    // Kapitel-Summaries als eigene Vektoren (Retriever-Ziel)
    if (chapters && chapters.length > 0) {
      const chapterSummaries = chapters.map(c => c.summary)
      const chapterEmbeds = await embedTexts(chapterSummaries)
      chapterEmbeds.forEach((values, i) => {
        const c = chapters[i]
        vectors.push({
          id: `${fileId}-chap-${c.chapterId}`,
          values,
          metadata: {
            user: userEmail,
            libraryId,
            fileId,
            fileName,
            kind: 'chapterSummary',
            chapterId: c.chapterId,
            chapterTitle: c.title,
            order: c.order,
            startChunk: c.startChunk,
            endChunk: c.endChunk,
            text: c.summary.slice(0, 1200),
            keywords: c.keywords,
            upsertedAt: new Date().toISOString(),
            docModifiedAt,
          } as Record<string, unknown>
        })
      })
    }
    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)

    return NextResponse.json({ status: 'ok', chunks: chunks.length, index: ctx.vectorIndex })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


