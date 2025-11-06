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
    const indexes: Array<{ name: string }> = Array.isArray(listData?.indexes) ? listData.indexes : []
    const indexCount = indexes.length
    const maxServerlessIndexes = 20 // Pinecone Limit für serverlose Indizes
    const existing = indexes.find((i: { name: string }) => i.name === ctx.vectorIndex)
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
      // Detaillierte Fehlerinformationen für Debugging
      const errorMessage = createData?.message || createData?.error?.message || 'Unbekannter Fehler'
      const errorCode = createData?.code || createData?.error?.code
      
      // Spezielle Behandlung für Quota-Limit (403 Fehler)
      let userFriendlyMessage = errorMessage
      if (createRes.status === 403) {
        // Prüfe, ob es ein Quota-Problem ist
        const messageLower = errorMessage.toLowerCase()
        if (messageLower.includes('quota') || messageLower.includes('limit') || messageLower.includes('max') || messageLower.includes('reached')) {
          // Versuche, das tatsächliche Limit aus der Fehlermeldung zu extrahieren
          const limitMatch = errorMessage.match(/max serverless indexes allowed.*?\((\d+)\)/i)
          const actualLimit = limitMatch ? parseInt(limitMatch[1], 10) : maxServerlessIndexes
          
          userFriendlyMessage = `Index-Limit erreicht: Ihr Pinecone-Projekt ist auf ${actualLimit} serverlose Indizes begrenzt. Aktuell sind ${indexCount} Indizes vorhanden.\n\nLösungsmöglichkeiten:\n1. Ungenutzte Indizes in der Pinecone-Konsole löschen\n2. Namespaces verwenden, um Daten in einem Index zu partitionieren\n3. Ihren Pinecone-Plan upgraden, um mehr Indizes zu erhalten`
        } else {
          userFriendlyMessage = `Berechtigungsfehler (403): ${errorMessage}. Mögliche Ursachen: API-Key hat keine Schreibberechtigung oder Index-Limit erreicht (${indexCount}/${maxServerlessIndexes}).`
        }
      }
      
      return NextResponse.json(
        {
          error: 'Pinecone-Index konnte nicht erstellt werden',
          status: createRes.status,
          message: userFriendlyMessage,
          code: errorCode,
          details: createData,
          requestBody: body, // Request-Body für Debugging
          indexCount,
          maxServerlessIndexes,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ status: 'created', index: createData })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.error('[POST /api/chat/[libraryId]/index] Fehler:', errorMessage, err)
    return NextResponse.json({ error: 'Interner Fehler', message: errorMessage }, { status: 500 })
  }
}


