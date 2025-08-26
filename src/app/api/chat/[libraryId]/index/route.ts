import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    // Prüfen, ob Index existiert
    const listRes = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const listData = await listRes.json().catch(() => ({}))
    if (!listRes.ok) {
      return NextResponse.json({ error: 'Pinecone-Listing fehlgeschlagen', details: listData }, { status: 502 })
    }
    const existing = Array.isArray(listData?.indexes) ? listData.indexes.find((i: { name: string }) => i.name === ctx.vectorIndex) : undefined
    if (existing) {
      return NextResponse.json({ status: 'exists', index: existing })
    }

    // Anlegen
    const dimension = Number(process.env.OPENAI_EMBEDDINGS_DIMENSION || 3072)
    const region = process.env.PINECONE_REGION || 'us-east-1'
    const cloud = process.env.PINECONE_CLOUD || 'aws'
    const body = {
      name: ctx.vectorIndex,
      dimension,
      metric: 'cosine',
      spec: { serverless: { region, cloud } },
    }

    const createRes = await fetch('https://api.pinecone.io/indexes', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const createData = await createRes.json().catch(() => ({}))
    if (!createRes.ok) {
      return NextResponse.json({ error: 'Pinecone-Index konnte nicht erstellt werden', details: createData }, { status: 502 })
    }

    return NextResponse.json({ status: 'created', index: createData })
  } catch {
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}


