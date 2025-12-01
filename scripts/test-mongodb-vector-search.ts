/**
 * Test-Script für MongoDB Vector Search
 * 
 * Testet ob MongoDB Vector Search Features verfügbar sind und funktionieren.
 * 
 * Verwendung:
 *   pnpm exec tsx scripts/test-mongodb-vector-search.ts
 * 
 * Exit-Code:
 *   - 0: Alle Tests erfolgreich
 *   - 1: Fehler bei Tests
 */

import { MongoClient } from 'mongodb'
import * as dotenv from 'dotenv'

// Dotenv explizit laden
dotenv.config()

const TEST_COLLECTION = 'vector_test'
const TEST_INDEX_NAME = 'vector_search_test_idx'

/**
 * Erstellt Test-Dokumente mit Embeddings
 */
function createTestDocuments(): Array<{ text: string; embedding: number[]; category: string }> {
  // Einfache 4-dimensionale Test-Vektoren
  // Diese sind so gewählt, dass sie unterschiedliche Similarity-Scores ergeben
  return [
    {
      text: 'Machine learning and artificial intelligence',
      embedding: [0.1, 0.2, 0.3, 0.4],
      category: 'AI'
    },
    {
      text: 'Deep learning neural networks',
      embedding: [0.15, 0.25, 0.35, 0.45],
      category: 'AI'
    },
    {
      text: 'Database management systems',
      embedding: [0.9, 0.8, 0.7, 0.6],
      category: 'Database'
    },
    {
      text: 'SQL queries and optimization',
      embedding: [0.85, 0.75, 0.65, 0.55],
      category: 'Database'
    },
    {
      text: 'Web development frameworks',
      embedding: [0.5, 0.5, 0.5, 0.5],
      category: 'Web'
    }
  ]
}

/**
 * Berechnet Cosine Similarity zwischen zwei Vektoren
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vektoren müssen gleiche Dimension haben')
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function main(): Promise<void> {
  console.log('=== MongoDB Vector Search Test ===\n')
  
  const uri = process.env.MONGODB_URI
  const dbName = process.env.MONGODB_DATABASE_NAME
  
  if (!uri) {
    console.error('❌ FEHLER: MONGODB_URI ist nicht definiert')
    process.exit(1)
  }
  
  if (!dbName) {
    console.error('❌ FEHLER: MONGODB_DATABASE_NAME ist nicht definiert')
    process.exit(1)
  }
  
  console.log(`📊 Datenbank: ${dbName}`)
  console.log(`🔗 URI: ${uri.replace(/\/\/.*@/, '//***:***@')}`) // Passwort maskieren
  console.log(`📁 Test-Collection: ${TEST_COLLECTION}\n`)
  
  let client: MongoClient | null = null
  
  try {
    // Schritt 1: Verbindung herstellen
    console.log('1️⃣ Verbindung zu MongoDB herstellen...')
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    
    await client.connect()
    console.log('✅ Verbindung erfolgreich\n')
    
    const db = client.db(dbName)
    
    // Schritt 2: MongoDB-Version prüfen
    console.log('2️⃣ MongoDB-Version prüfen...')
    const serverInfo = await db.admin().serverStatus()
    const version = serverInfo.version
    console.log(`   Version: ${version}`)
    
    const majorVersion = parseInt(version.split('.')[0] || '0', 10)
    if (majorVersion < 7) {
      console.warn(`⚠️  WARNUNG: MongoDB Version ${majorVersion} erkannt. Vector Search benötigt MongoDB Atlas ≥7.0`)
      console.warn('   Das Script wird fortgesetzt, aber Vector Search könnte nicht funktionieren.\n')
    } else {
      console.log('✅ Version unterstützt Vector Search\n')
    }
    
    // Schritt 3: Test-Collection bereinigen (falls vorhanden)
    console.log('3️⃣ Test-Collection bereinigen...')
    const testCollection = db.collection(TEST_COLLECTION)
    const existingCount = await testCollection.countDocuments()
    if (existingCount > 0) {
      await testCollection.deleteMany({})
      console.log(`   ${existingCount} alte Dokumente gelöscht`)
    }
    console.log('✅ Collection bereit\n')
    
    // Schritt 4: Test-Dokumente einfügen
    console.log('4️⃣ Test-Dokumente einfügen...')
    const testDocs = createTestDocuments()
    const insertResult = await testCollection.insertMany(
      testDocs.map(doc => ({
        text: doc.text,
        embedding: doc.embedding,
        category: doc.category,
        createdAt: new Date(),
      }))
    )
    console.log(`   ${insertResult.insertedCount} Dokumente eingefügt`)
    console.log('✅ Dokumente eingefügt\n')
    
    // Schritt 5: Vector Search Index erstellen
    console.log('5️⃣ Vector Search Index erstellen...')
    const dimension = testDocs[0].embedding.length
    
    try {
      // Verwende db.command() für MongoDB Atlas Vector Search Index
      await db.command({
        createSearchIndexes: TEST_COLLECTION,
        indexes: [
          {
            name: TEST_INDEX_NAME,
            definition: {
              mappings: {
                dynamic: true,
                fields: {
                  embedding: {
                    type: 'knnVector',
                    dimensions: dimension,
                    similarity: 'cosine',
                  },
                },
              },
            },
          },
        ],
      })
      console.log(`   Index "${TEST_INDEX_NAME}" erstellt`)
      console.log(`   Dimension: ${dimension}`)
      console.log(`   Similarity: cosine`)
      console.log('✅ Index erstellt\n')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      // Prüfe ob es ein "Index bereits vorhanden" Fehler ist
      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        console.log(`   Index "${TEST_INDEX_NAME}" existiert bereits`)
        console.log('✅ Index vorhanden\n')
      } else {
        console.error(`❌ FEHLER beim Erstellen des Index: ${errorMsg}`)
        console.error('\n💡 Mögliche Ursachen:')
        console.error('   - MongoDB Atlas Vector Search ist nicht aktiviert')
        console.error('   - Falsche MongoDB-Version (< 7.0)')
        console.error('   - Fehlende Berechtigungen')
        throw error
      }
    }
    
    // Schritt 6: Warten bis Index bereit ist (kann einige Sekunden dauern)
    console.log('6️⃣ Warten bis Index bereit ist...')
    let indexReady = false
    let attempts = 0
    const maxAttempts = 30 // 30 Sekunden max
    
    while (!indexReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1 Sekunde warten
      attempts++
      
      try {
        // Versuche eine einfache Query (wenn Index nicht bereit ist, schlägt sie fehl)
        const testQuery = [0.1, 0.2, 0.3, 0.4]
        await testCollection.aggregate([
          {
            $vectorSearch: {
              index: TEST_INDEX_NAME,
              path: 'embedding',
              queryVector: testQuery,
              numCandidates: 2,
              limit: 1,
            },
          },
        ]).toArray()
        
        indexReady = true
        console.log(`   Index bereit nach ${attempts} Sekunden`)
      } catch {
        // Index noch nicht bereit, weiter warten
        if (attempts % 5 === 0) {
          console.log(`   Warte... (${attempts}s)`)
        }
      }
    }
    
    if (!indexReady) {
      throw new Error('Index wurde nach 30 Sekunden nicht bereit')
    }
    console.log('✅ Index bereit\n')
    
    // Schritt 7: Vector Search Query testen
    console.log('7️⃣ Vector Search Query testen...')
    const queryVector = [0.12, 0.22, 0.32, 0.42] // Ähnlich zu ersten beiden AI-Dokumenten
    
    const searchResults = await testCollection.aggregate([
      {
        $vectorSearch: {
          index: TEST_INDEX_NAME,
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 5,
          limit: 3,
        },
      },
      {
        $project: {
          _id: 1,
          text: 1,
          category: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray()
    
    console.log(`   ${searchResults.length} Ergebnisse gefunden:`)
    searchResults.forEach((result, idx) => {
      const score = typeof result.score === 'number' ? result.score.toFixed(4) : 'N/A'
      console.log(`   ${idx + 1}. "${result.text}" (Score: ${score}, Category: ${result.category})`)
    })
    console.log('✅ Vector Search Query erfolgreich\n')
    
    // Schritt 8: Filter mit Vector Search testen
    console.log('8️⃣ Vector Search mit Filter testen...')
    const filteredResults = await testCollection.aggregate([
      {
        $vectorSearch: {
          index: TEST_INDEX_NAME,
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 5,
          limit: 3,
          filter: {
            category: { $eq: 'AI' },
          },
        },
      },
      {
        $project: {
          _id: 1,
          text: 1,
          category: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]).toArray()
    
    console.log(`   ${filteredResults.length} Ergebnisse mit Filter "category: AI":`)
    filteredResults.forEach((result, idx) => {
      const score = typeof result.score === 'number' ? result.score.toFixed(4) : 'N/A'
      console.log(`   ${idx + 1}. "${result.text}" (Score: ${score})`)
    })
    
    // Validiere dass alle Ergebnisse den Filter erfüllen
    const allMatchFilter = filteredResults.every(r => r.category === 'AI')
    if (!allMatchFilter) {
      throw new Error('Filter funktioniert nicht korrekt - nicht alle Ergebnisse erfüllen den Filter')
    }
    console.log('✅ Filter funktioniert korrekt\n')
    
    // Schritt 9: Cosine Similarity manuell berechnen (zum Vergleich)
    console.log('9️⃣ Cosine Similarity manuell berechnen (Vergleich)...')
    const manualSimilarities = testDocs.map(doc => ({
      text: doc.text,
      similarity: cosineSimilarity(queryVector, doc.embedding),
    }))
    manualSimilarities.sort((a, b) => b.similarity - a.similarity)
    
    console.log('   Top 3 nach manueller Berechnung:')
    manualSimilarities.slice(0, 3).forEach((item, idx) => {
      console.log(`   ${idx + 1}. "${item.text}" (Similarity: ${item.similarity.toFixed(4)})`)
    })
    console.log('✅ Vergleich abgeschlossen\n')
    
    // Schritt 10: Cleanup (optional)
    console.log('🔟 Cleanup...')
    const cleanup = process.env.VECTOR_TEST_KEEP_COLLECTION !== 'true'
    if (cleanup) {
      await testCollection.drop()
      console.log('   Test-Collection gelöscht')
    } else {
      console.log('   Test-Collection behalten (VECTOR_TEST_KEEP_COLLECTION=true)')
    }
    console.log('✅ Cleanup abgeschlossen\n')
    
    // Zusammenfassung
    console.log('=== ✅ ALLE TESTS ERFOLGREICH ===')
    console.log('\nMongoDB Vector Search ist funktionsfähig!')
    console.log('Du kannst jetzt mit der Migration fortfahren.\n')
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error instanceof Error ? error.message : String(error))
    console.error('\n💡 Tipps:')
    console.error('   - Stelle sicher, dass MongoDB Atlas ≥7.0 verwendet wird')
    console.error('   - Prüfe ob Vector Search in deinem Atlas-Cluster aktiviert ist')
    console.error('   - Überprüfe die MongoDB-Verbindungsdaten')
    process.exit(1)
  } finally {
    if (client) {
      await client.close()
      console.log('🔌 Verbindung geschlossen')
    }
  }
}

// Script ausführen
if (require.main === module) {
  void main().catch(error => {
    console.error('Unbehandelter Fehler:', error)
    process.exit(1)
  })
}

