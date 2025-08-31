import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) return NextResponse.json({ ok: false, error: 'PINECONE_API_KEY fehlt' }, { status: 500 })

    const res = await fetch('https://api.pinecone.io/indexes', {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      // Verhindert Next.js Caching der Management-Abfrage
      cache: 'no-store',
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: data?.message || 'Fehler von Pinecone' }, { status: 500 })
    }

    const expectedIndex = process.env.PINECONE_INDEX
    const indexes: Array<{ name: string }> = Array.isArray(data?.indexes) ? data.indexes : []
    const hasExpected = expectedIndex ? indexes.some(i => i.name === expectedIndex) : undefined

    return NextResponse.json({ ok: true, indexes, expectedIndex, exists: hasExpected })
  } catch {
    return NextResponse.json({ ok: false, error: 'Interner Fehler' }, { status: 500 })
  }
}


