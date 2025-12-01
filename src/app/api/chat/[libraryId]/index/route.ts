import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { getVectorCollection, getVectorSearchIndexDefinition, getVectorCollectionName, getCollectionOnly, VECTOR_SEARCH_INDEX_NAME, clearVectorSearchIndexCache } from '@/lib/repositories/vector-repo'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'

/**
 * DELETE /api/chat/[libraryId]/index
 * Löscht den Vector Search Index für die Library.
 * Der Index kann anschließend mit POST neu erstellt werden.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Library-Kontext laden
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const libraryKey = getVectorCollectionName(ctx.library)
    const col = await getCollectionOnly(libraryKey)
    const db = col.db

    try {
      // Index löschen über MongoDB Atlas Search API
      // Verwende Collection-Methode dropSearchIndex() falls verfügbar, sonst db.command()
      try {
        await col.dropSearchIndex(VECTOR_SEARCH_INDEX_NAME)
      } catch {
        // Fallback: Verwende db.command() falls dropSearchIndex() nicht verfügbar ist
        await db.command({
          dropSearchIndex: col.collectionName,
          name: VECTOR_SEARCH_INDEX_NAME,
        })
      }

      // Cache leeren, damit der Index beim nächsten Erstellen nicht übersprungen wird
      clearVectorSearchIndexCache(libraryKey)
      console.log(`[index/route] Index gelöscht und Cache geleert für Collection "${libraryKey}"`)

      return NextResponse.json({
        status: 'deleted',
        index: {
          name: VECTOR_SEARCH_INDEX_NAME,
        },
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      
      // Prüfe ob Index nicht existiert (dann ist Löschen erfolgreich)
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
        return NextResponse.json({
          status: 'not_found',
          message: 'Index existiert nicht',
          index: {
            name: VECTOR_SEARCH_INDEX_NAME,
          },
        })
      }
      
      throw err
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[index/route] Fehler beim Löschen des Index:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/chat/[libraryId]/index
 * Erstellt den Vector Search Index für die Library.
 * Der Index wird automatisch mit allen konfigurierten Facetten erstellt.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { libraryId } = await params
    const { userId } = await auth()
    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Library-Kontext laden
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)
    const libraryKey = getVectorCollectionName(ctx.library)
    
    // Cache leeren, damit Index definitiv neu erstellt wird (falls vorher gelöscht wurde)
    // Dies stellt sicher, dass ensureVectorSearchIndex() den Index wirklich prüft und erstellt
    clearVectorSearchIndexCache(libraryKey)
    console.log(`[index/route] Cache geleert für Collection "${libraryKey}", erstelle Index neu`)
    
    try {
      // Index wird automatisch erstellt durch getVectorCollection()
      // (ruft ensureVectorSearchIndex() auf, das jetzt den Index prüft und erstellt)
      await getVectorCollection(libraryKey, dimension, ctx.library)
      console.log(`[index/route] getVectorCollection() erfolgreich aufgerufen für Collection "${libraryKey}"`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[index/route] Fehler beim Erstellen des Index über getVectorCollection():`, errorMsg)
      throw new Error(`Fehler beim Erstellen des Vector Search Index: ${errorMsg}`)
    }

    // Prüfe ob Index jetzt existiert
    const indexDef = await getVectorSearchIndexDefinition(libraryKey, dimension, ctx.library)

    if (indexDef) {
      console.log(`[index/route] Index erfolgreich erstellt/gefunden:`, {
        name: indexDef.name,
        status: indexDef.status,
        isActualDefinition: indexDef.isActualDefinition
      })
      return NextResponse.json({
        status: indexDef.status === 'READY' || indexDef.status === 'ACTIVE' ? 'exists' : 'created',
        index: {
          name: indexDef.name,
          status: indexDef.status,
        },
      })
    }

    // Index wurde nicht gefunden - möglicherweise wird er noch erstellt
    console.warn(`[index/route] Index wurde nicht gefunden nach Erstellung für Collection "${libraryKey}"`)
    return NextResponse.json({
      status: 'creating',
      index: {
        name: VECTOR_SEARCH_INDEX_NAME,
        status: 'INITIAL_SYNC',
      },
      message: 'Index wird erstellt, kann einige Minuten dauern',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Interner Fehler'
    console.error('[index/route] Fehler beim Erstellen des Index:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

