import { auth, currentUser } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex, queryVectors } from '@/lib/chat/pinecone'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ libraryId: string }> }) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })

    const { libraryId } = await params
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''
    if (!userEmail) return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 })

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    const idx = await describeIndex(ctx.vectorIndex, apiKey)
    if (!idx?.host) return NextResponse.json({ error: 'Index nicht gefunden' }, { status: 404 })

    // Dummy-Vektor, aber Filter selektiert nur Meta-Vektoren (kind: 'doc') dieser Library/User
    const vector = Array(Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)).fill(0)
    // Zeige alle Dokumente der Library, unabhängig vom Benutzer (gemeinsamer Library-Kontext)
    const filter = { libraryId: { $eq: libraryId }, kind: { $eq: 'doc' } }
    const matches = await queryVectors(idx.host, apiKey, vector, 200, filter)

    const items = matches.map(m => {
      const md = (m.metadata || {}) as Record<string, unknown>
      const docMeta = typeof md.docMetaJson === 'string' ? (JSON.parse(md.docMetaJson) as Record<string, unknown>) : {}
      return {
        id: m.id,
        fileId: typeof md.fileId === 'string' ? md.fileId : undefined,
        fileName: typeof md.fileName === 'string' ? md.fileName : undefined,
        title: typeof docMeta.title === 'string' ? docMeta.title : undefined,
        shortTitle: typeof docMeta.shortTitle === 'string' ? docMeta.shortTitle : undefined,
        authors: Array.isArray(docMeta.authors) ? (docMeta.authors as Array<unknown>).filter(a => typeof a === 'string') as string[] : undefined,
        year: typeof docMeta.year === 'number' || typeof docMeta.year === 'string' ? docMeta.year : undefined
      }
    })

    return NextResponse.json({ items }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 })
  }
}


