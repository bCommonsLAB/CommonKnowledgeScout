import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getCollectionNameForLibrary, getVectorCollection, getVectorSearchIndexDefinition, VECTOR_SEARCH_INDEX_NAME } from '@/lib/repositories/vector-repo'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'

/**
 * GET /api/chat/[libraryId]/index-status
 * Prüft den MongoDB Vector Search Index-Status für eine spezifische Library
 * 
 * Response:
 * {
 *   exists: boolean
 *   expectedIndexName: string
 *   indexName?: string (falls existiert)
 *   vectorCount?: number
 *   dimension?: number
 *   collectionName?: string
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

    const libraryKey = getCollectionNameForLibrary(ctx.library)
    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)
    const expectedIndexName = libraryKey

    console.log('[index-status] Library-Kontext geladen:', {
      libraryId: ctx.library.id,
      libraryLabel: ctx.library.label,
      collectionName: libraryKey,
      dimension
    })

    // Prüfe, ob Vector Search Index existiert
    try {
      // Verwende Library für Index-Setup
      const col = await getVectorCollection(libraryKey, dimension, ctx.library)
      
      // Hole Index-Definition für Details
      const indexDefinition = await getVectorSearchIndexDefinition(libraryKey, dimension, ctx.library)
      
      if (indexDefinition) {
        // Index existiert - hole Stats
        const vectorCount = await col.countDocuments({ kind: { $in: ['chunk', 'chapterSummary'] } })
        const metaCount = await col.countDocuments({ kind: 'meta' })
        
        // Analysiere Index-Definition für Filter-Felder
        let filterFieldsInfo: { dynamic?: boolean; explicitFields?: string[]; hasKind?: boolean; hasLibraryId?: boolean; hasUser?: boolean } | undefined
        if (indexDefinition?.definition) {
          const def = indexDefinition.definition as { mappings?: { fields?: Record<string, unknown>; dynamic?: boolean } } | undefined
          if (def?.mappings) {
            const fields = def.mappings.fields || {}
            const dynamic = def.mappings.dynamic !== false
            filterFieldsInfo = {
              dynamic,
              explicitFields: Object.keys(fields),
              hasKind: 'kind' in fields,
              hasLibraryId: 'libraryId' in fields,
              hasUser: 'user' in fields,
            }
          }
        }

        return NextResponse.json({
          exists: true,
          expectedIndexName,
          indexName: VECTOR_SEARCH_INDEX_NAME,
          vectorCount,
          metaCount,
          dimension,
          collectionName: libraryKey,
          indexDefinition: indexDefinition.definition,
          indexStatus: indexDefinition.status,
          filterFieldsInfo,
        })
      } else {
        // Index existiert nicht
        console.log('[index-status] Vector Search Index nicht gefunden')
        
        // Prüfe ob Collection existiert
        const collectionExists = await col.countDocuments({}).then(count => count > 0).catch(() => false)
        
        return NextResponse.json({
          exists: false,
          expectedIndexName,
          collectionName: libraryKey,
          collectionExists,
          dimension,
          message: `Vector Search Index für Collection "${libraryKey}" existiert noch nicht. Der Index wird automatisch beim ersten Upsert erstellt.`
        })
      }
    } catch (e) {
      // Andere Fehler
      console.log('[index-status] Fehler:', e instanceof Error ? e.message : 'Unknown')
      return NextResponse.json({
        exists: false,
        expectedIndexName,
        collectionName: libraryKey,
        dimension,
        error: e instanceof Error ? e.message : 'Unknown error'
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[index-status] ERROR', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

