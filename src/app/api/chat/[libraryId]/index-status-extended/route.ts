import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { loadLibraryChatContext } from '@/lib/chat/loader'
import { 
  getVectorCollectionName,
  getVectorCollection, 
  getVectorSearchIndexDefinition,
  upsertVectorMeta,
  queryVectors,
  aggregateFacets,
  VECTOR_SEARCH_INDEX_NAME
} from '@/lib/repositories/vector-repo'
import { getEmbeddingDimensionForModel } from '@/lib/chat/config'
import { parseFacetDefs } from '@/lib/chat/dynamic-facets'
import { embedQuestionWithSecretary } from '@/lib/chat/rag-embeddings'
import { buildVectorSearchIndexDefinition } from '@/lib/chat/vector-search-index'

/**
 * GET /api/chat/[libraryId]/index-status-extended
 * Erweiterte Index-Status-Prüfung mit Schreib-/Lese-Tests und Facetten-Prüfung
 * 
 * Response:
 * {
 *   vectorIndex: { exists, status, vectorCount, metaCount, ... },
 *   writeTest: { success, error? },
 *   readTest: { success, error?, document? },
 *   searchTest: { success, error?, results? },
 *   facetTest: { success, error?, facets? }
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

    console.log('[index-status-extended] Request:', { 
      libraryId, 
      userEmail: userEmail ? `${userEmail.split('@')[0]}@...` : 'none'
    })

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
    }

    // Library-Kontext laden
    const ctx = await loadLibraryChatContext(userEmail, libraryId)
    if (!ctx) {
      console.log('[index-status-extended] ❌ Library nicht gefunden:', libraryId)
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 })
    }

    const libraryKey = getVectorCollectionName(ctx.library)
    const dimension = getEmbeddingDimensionForModel(ctx.library.config?.chat)
    const expectedIndexName = libraryKey

    console.log('[index-status-extended] Library-Kontext geladen:', {
      libraryId: ctx.library.id,
      libraryLabel: ctx.library.label,
      collectionName: libraryKey,
      dimension
    })

    const results: {
      vectorIndex: Record<string, unknown>
      writeTest: Record<string, unknown>
      readTest: Record<string, unknown>
      searchTest: Record<string, unknown>
      facetTest: Record<string, unknown>
    } = {
      vectorIndex: {},
      writeTest: {},
      readTest: {},
      searchTest: {},
      facetTest: {}
    }

    // 1. Vector Index Status prüfen
    try {
      // Verwende Library für dynamische Index-Definition
      const col = await getVectorCollection(libraryKey, dimension, ctx.library)
      
      try {
        // Prüfe ob Index existiert durch listSearchIndexes (robuster als Test-Query mit Zero-Vector)
        let indexExists = false
        let indexStatus = 'Unknown'
        try {
          const indexes = await col.listSearchIndexes().toArray()
          const index = indexes.find((idx: { name: string }) => idx.name === VECTOR_SEARCH_INDEX_NAME)
          if (index) {
            indexExists = true
            indexStatus = (index as { status?: string }).status || 'Unknown'
          }
        } catch {
          // Fallback: Versuche Test-Query mit echtem Embedding (nicht Zero-Vector!)
          // Hole ein existierendes Dokument mit Embedding für Test
          const sampleDoc = await col.findOne(
            { 
              embedding: { $exists: true, $type: 'array' },
              kind: { $in: ['chunk', 'chapterSummary'] }
            },
            { projection: { embedding: 1 } }
          ) as { embedding?: number[] } | null
          
          if (sampleDoc?.embedding && Array.isArray(sampleDoc.embedding) && sampleDoc.embedding.length === dimension) {
            // Test-Query mit echtem Embedding (nicht Zero-Vector!)
            await col.aggregate([
              {
                $vectorSearch: {
                  index: VECTOR_SEARCH_INDEX_NAME,
                  path: 'embedding',
                  queryVector: sampleDoc.embedding,
                  numCandidates: 1,
                  limit: 1,
                },
              },
            ]).toArray()
            indexExists = true
            indexStatus = 'READY' // Wenn Query erfolgreich, ist Index bereit
          } else {
            // Kein Dokument mit Embedding gefunden - Index existiert möglicherweise, aber keine Daten
            // Prüfe Index-Definition direkt
            const indexDefinition = await getVectorSearchIndexDefinition(libraryKey, dimension, ctx.library)
            if (indexDefinition) {
              indexExists = true
              indexStatus = indexDefinition.status || 'Unknown'
            }
          }
        }
        
        const vectorCount = await col.countDocuments({ kind: { $in: ['chunk', 'chapterSummary'] } })
        const metaCount = await col.countDocuments({ kind: 'meta' })
        
        const indexDefinition = await getVectorSearchIndexDefinition(libraryKey, dimension, ctx.library)
        
        // Berechne das erwartete Index-Schema basierend auf den aktuellen Facetten
        const expectedIndexDefinition = buildVectorSearchIndexDefinition(ctx.library, dimension)
        
        results.vectorIndex = {
          exists: indexExists,
          expectedIndexName,
          indexName: VECTOR_SEARCH_INDEX_NAME,
          vectorCount,
          metaCount,
          dimension,
          collectionName: libraryKey,
          indexStatus: indexDefinition?.status || indexStatus,
          indexDefinition: indexDefinition?.definition,
          expectedIndexDefinition: expectedIndexDefinition.definition
        }
      } catch (indexError) {
        results.vectorIndex = {
          exists: false,
          expectedIndexName,
          collectionName: libraryKey,
          collectionExists: await col.countDocuments({}).then(count => count > 0).catch(() => false),
          dimension,
          error: indexError instanceof Error ? indexError.message : 'Unknown'
        }
      }
    } catch (e) {
      results.vectorIndex = {
        exists: false,
        expectedIndexName,
        collectionName: libraryKey,
        dimension,
        error: e instanceof Error ? e.message : 'Unknown error'
      }
    }

    // 2. Schreib-Test: Test-Meta-Dokument schreiben
    const testFileId = `__test_index_check_${Date.now()}`
    try {
      const testMetaDoc = {
        libraryId,
        user: userEmail,
        fileId: testFileId,
        fileName: '__test_index_check.md',
        title: 'Index-Prüfung Test-Dokument',
        summary: 'Dieses Dokument wird automatisch für Index-Prüfungen erstellt und sollte nach dem Test gelöscht werden.',
        chunkCount: 0,
        chaptersCount: 0,
        upsertedAt: new Date().toISOString(),
        // Test-Facetten-Werte
        year: 2024,
        authors: ['System'],
        docType: 'test',
        tags: ['index-test']
      }

      await upsertVectorMeta(libraryKey, testMetaDoc, dimension, ctx.library)
      results.writeTest = { success: true, fileId: testFileId }
    } catch (error) {
      results.writeTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 3. Lese-Test: Test-Meta-Dokument lesen
    try {
      const col = await getVectorCollection(libraryKey, dimension, ctx.library)
      const testDoc = await col.findOne({ 
        _id: `${testFileId}-meta`,
        kind: 'meta',
        libraryId,
        fileId: testFileId
      } as Record<string, unknown>)

      if (testDoc) {
        results.readTest = {
          success: true,
          document: {
            fileId: testDoc.fileId,
            fileName: testDoc.fileName,
            title: testDoc.title,
            hasFacets: !!(testDoc.year || testDoc.authors || testDoc.docType)
          }
        }
      } else {
        results.readTest = {
          success: false,
          error: 'Test-Dokument nach Schreib-Test nicht gefunden'
        }
      }
    } catch (error) {
      results.readTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 4. Search-Test: Typischer Vector Search durchführen
    try {
      // Erstelle Test-Embedding für Search
      const testQuery = 'Test-Suche für Index-Prüfung'
      const queryEmbedding = await embedQuestionWithSecretary(testQuery, ctx)
      
      if (!queryEmbedding || queryEmbedding.length !== dimension) {
        throw new Error(`Embedding-Dimension stimmt nicht: erwartet ${dimension}, erhalten ${queryEmbedding?.length || 0}`)
      }

      // Führe Vector Search durch (typischer Filter: nur chunks)
      const searchResults = await queryVectors(
        libraryKey,
        queryEmbedding,
        5, // topK
        { kind: 'chunk', libraryId },
        dimension,
        ctx.library
      )

      results.searchTest = {
        success: true,
        resultsCount: searchResults.length,
        results: searchResults.slice(0, 3).map(r => ({
          id: r.id,
          score: r.score,
          kind: r.metadata.kind,
          fileId: r.metadata.fileId
        }))
      }
    } catch (error) {
      results.searchTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 5. Facetten-Test: Facetten-Aggregation prüfen
    try {
      const facetDefs = parseFacetDefs(ctx.library)
      
      if (facetDefs.length > 0) {
        const facets = await aggregateFacets(
          libraryKey,
          libraryId,
          {},
          facetDefs.map(d => ({ metaKey: d.metaKey, type: d.type, label: d.label }))
        )

        results.facetTest = {
          success: true,
          facetsCount: Object.keys(facets).length,
          facets: Object.entries(facets).map(([key, values]) => ({
            metaKey: key,
            valuesCount: values.length,
            sampleValues: values.slice(0, 3)
          }))
        }
      } else {
        results.facetTest = {
          success: true,
          message: 'Keine Facetten definiert'
        }
      }
    } catch (error) {
      results.facetTest = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Aufräumen: Test-Dokument löschen
    try {
      const col = await getVectorCollection(libraryKey, dimension, ctx.library)
      await col.deleteOne({ 
        _id: `${testFileId}-meta`,
        kind: 'meta',
        fileId: testFileId
      } as Record<string, unknown>)
      console.log('[index-status-extended] Test-Dokument gelöscht:', testFileId)
    } catch (cleanupError) {
      console.warn('[index-status-extended] Fehler beim Löschen des Test-Dokuments:', cleanupError)
      // Nicht kritisch, nur Warnung
    }

    return NextResponse.json(results)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
    console.error('[index-status-extended] ERROR', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

