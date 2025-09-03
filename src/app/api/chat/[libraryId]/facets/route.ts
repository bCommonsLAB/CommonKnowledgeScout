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
    const dim = typeof idx.dimension === 'number' ? idx.dimension : Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)

    const vector = Array(dim).fill(0)
    // Optional: Falls eine Library spezifische Facetten vorgibt, nutzen wir sie nur clientseitig zur Anzeige
    const filter = { libraryId: { $eq: libraryId }, kind: { $eq: 'doc' } }
    const matches = await queryVectors(idx.host, apiKey, vector, 500, filter)

    const authorsCount = new Map<string, number>()
    const regionsCount = new Map<string, number>()
    const yearsCount = new Map<string | number, number>()
    const docTypesCount = new Map<string, number>()
    const sourcesCount = new Map<string, number>()
    const tagsCount = new Map<string, number>()

    for (const m of matches) {
      const md = (m.metadata || {}) as Record<string, unknown>
      const authors = Array.isArray(md.authors) ? md.authors as Array<unknown> : []
      for (const a of authors) if (typeof a === 'string' && a) authorsCount.set(a, (authorsCount.get(a) || 0) + 1)
      const region = (md as { region?: unknown }).region
      if (typeof region === 'string' && region) regionsCount.set(region, (regionsCount.get(region) || 0) + 1)
      const year = (md as { year?: unknown }).year
      if ((typeof year === 'number' || typeof year === 'string') && year !== '') yearsCount.set(year, (yearsCount.get(year) || 0) + 1)
      const docType = (md as { docType?: unknown }).docType
      if (typeof docType === 'string' && docType) docTypesCount.set(docType, (docTypesCount.get(docType) || 0) + 1)
      const source = (md as { source?: unknown }).source
      if (typeof source === 'string' && source) sourcesCount.set(source, (sourcesCount.get(source) || 0) + 1)
      const tags = Array.isArray((md as { tags?: unknown }).tags) ? (md as { tags: unknown[] }).tags : []
      for (const t of tags) if (typeof t === 'string' && t) tagsCount.set(t, (tagsCount.get(t) || 0) + 1)
    }

    return NextResponse.json({
      authors: Array.from(authorsCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => a.value.localeCompare(b.value)),
      regions: Array.from(regionsCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => a.value.localeCompare(b.value)),
      years: Array.from(yearsCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => String(a.value).localeCompare(String(b.value))),
      docTypes: Array.from(docTypesCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => a.value.localeCompare(b.value)),
      sources: Array.from(sourcesCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => a.value.localeCompare(b.value)),
      tags: Array.from(tagsCount.entries()).map(([value, count]) => ({ value, count })).sort((a,b) => a.value.localeCompare(b.value)),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


