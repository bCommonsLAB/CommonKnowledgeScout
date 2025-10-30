import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { describeIndex } from '@/lib/chat/pinecone'

/**
 * GET /api/chat/[libraryId]/index-status
 * Prüft den Pinecone-Index-Status für eine spezifische Library
 * 
 * Response:
 * {
 *   exists: boolean
 *   expectedIndexName: string
 *   indexName?: string (falls existiert)
 *   vectorCount?: number
 *   dimension?: number
 *   status?: { ready: boolean, state: string }
 *   host?: string
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || ''

    console.log('[index-status] Request:', { 
      libraryId, 
      userEmail: userEmail ? `${userEmail.split('@')[0]}@...` : 'none'
    })

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Library-Kontext laden → berechnet automatisch den Index-Namen
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      console.log('[index-status] ❌ Library nicht gefunden:', libraryId)
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    console.log('[index-status] Library-Kontext geladen:', {
      libraryId: ctx.library.id,
      libraryLabel: ctx.library.label,
      vectorIndex: ctx.vectorIndex
    })

    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'PINECONE_API_KEY fehlt' }, { status: 500 })
    }

    const expectedIndexName = ctx.vectorIndex

    // Prüfe, ob Index existiert
    try {
      const idx = await describeIndex(expectedIndexName, apiKey)
      
      if (idx && idx.host) {
        // Index existiert - hole Stats
        const statsRes = await fetch(`https://${idx.host}/describe_index_stats`, {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({}),
          cache: 'no-store'
        })
        
        const stats = await statsRes.json().catch(() => ({}))
        const vectorCount = typeof stats?.totalVectorCount === 'number' 
          ? stats.totalVectorCount 
          : (stats?.namespaces?.['']?.vectorCount || 0)

        return NextResponse.json({
          exists: true,
          expectedIndexName,
          indexName: expectedIndexName,
          vectorCount,
          dimension: idx.dimension,
          host: idx.host
        })
      }
    } catch (e) {
      // Index existiert nicht oder andere Fehler
      console.log('[index-status] Index nicht gefunden oder Fehler:', e instanceof Error ? e.message : 'Unknown')
    }

    // Index existiert nicht
    return NextResponse.json({
      exists: false,
      expectedIndexName,
      message: `Index "${expectedIndexName}" existiert noch nicht. Bitte "Index anlegen" klicken.`
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[index-status] ERROR', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

