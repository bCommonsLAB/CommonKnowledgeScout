import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { describeIndex, queryVectors } from '@/lib/chat/pinecone'
import { loadLibraryChatContext } from '@/lib/chat/loader'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userId || !userEmail) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ ok: true, indexExists: false, totals: { docs: 0, chunks: 0 } })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ ok: true, indexExists: false, totals: { docs: 0, chunks: 0 } })

    // Schätze grob via Random-Query (Pinecone hat keine Count-API im Serverless-Modus)
    // Heuristik: Query mit Null-Vektor und großem topK, filter by user+libraryId, zähle IDs
    const zero = new Array<number>(3072).fill(0)
    const matches = await queryVectors(idx.host, apiKey, zero, 128, { user: { $eq: userEmail }, libraryId: { $eq: libraryId } })
    const chunkIds = matches.filter(m => !String(m.id).endsWith('-meta')).length
    const docIds = new Set(matches.filter(m => String(m.id).endsWith('-meta')).map(m => String(m.id))).size

    return NextResponse.json({ ok: true, indexExists: true, totals: { docs: docIds, chunks: chunkIds } })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


