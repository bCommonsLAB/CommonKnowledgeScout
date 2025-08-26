import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import * as z from 'zod'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, upsertVectorsChunked, deleteByFilter } from '@/lib/chat/pinecone'
import { embedTexts } from '@/lib/chat/embeddings'

const bodySchema = z.object({
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  content: z.string().min(1),
  mode: z.enum(['A', 'B']).default('A')
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
    const { fileId, fileName, content, mode } = parsed.data

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
    const vectors = embeddings.map((values, i) => ({
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
        text: chunks[i].slice(0, 1000)
      }
    }))
    await upsertVectorsChunked(idx.host, apiKey, vectors, 8)

    return NextResponse.json({ status: 'ok', chunks: chunks.length, index: ctx.vectorIndex })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Interner Fehler'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


