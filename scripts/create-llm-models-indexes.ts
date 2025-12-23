/**
 * Script zum Erstellen der MongoDB-Indizes für die llm_models Collection
 * 
 * Führt die Index-Erstellung explizit aus und zeigt den Status an.
 * 
 * Usage: pnpm tsx scripts/create-llm-models-indexes.ts
 */

import { connectToDatabase } from '@/lib/mongodb-service'
import type { LlmModel } from '@/lib/db/llm-models-repo'

const COLLECTION_NAME = 'llm_models'

async function createLlmModelsIndexes() {
  try {
    console.log('Verbinde mit MongoDB...')
    const db = await connectToDatabase()
    const collection = db.collection<LlmModel>(COLLECTION_NAME)
    
    console.log(`\nErstelle Indizes für Collection "${COLLECTION_NAME}"...`)
    
    // Prüfe vorhandene Indizes
    const existingIndexes = await collection.indexes()
    console.log(`\nVorhandene Indizes (${existingIndexes.length}):`)
    existingIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`)
    })
    
    // Erstelle Indizes
    console.log('\nErstelle neue Indizes...')
    
    try {
      await collection.createIndex(
        { isActive: 1, order: 1 },
        { name: 'isActive_order_asc' }
      )
      console.log('✓ Index "isActive_order_asc" erstellt')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('✓ Index "isActive_order_asc" existiert bereits')
      } else {
        throw error
      }
    }
    
    // Hinweis: _id hat bereits automatisch einen eindeutigen Index in MongoDB
    // Dieser muss nicht explizit erstellt werden
    console.log('✓ Index "_id" existiert bereits automatisch (MongoDB Standard)')
    
    try {
      await collection.createIndex(
        { modelId: 1 },
        { name: 'modelId_index' }
      )
      console.log('✓ Index "modelId_index" erstellt')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('✓ Index "modelId_index" existiert bereits')
      } else {
        throw error
      }
    }
    
    try {
      await collection.createIndex(
        { supportedLanguages: 1 },
        { name: 'supportedLanguages_index' }
      )
      console.log('✓ Index "supportedLanguages_index" erstellt')
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('✓ Index "supportedLanguages_index" existiert bereits')
      } else {
        throw error
      }
    }
    
    // Zeige finale Indizes
    console.log('\nFinale Indizes:')
    const finalIndexes = await collection.indexes()
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`)
    })
    
    // Test-Query mit explain() um zu sehen, ob Index verwendet wird
    console.log('\nTeste Query-Performance...')
    const explainResult = await collection.find({ isActive: true }).sort({ order: 1 }).explain('executionStats')
    const executionStats = explainResult.executionStats
    console.log(`  - Dokumente gescannt: ${executionStats.totalDocsExamined}`)
    console.log(`  - Dokumente zurückgegeben: ${executionStats.nReturned}`)
    console.log(`  - Execution Time (ms): ${executionStats.executionTimeMillis}`)
    
    if (executionStats.executionStages?.stage === 'IXSCAN') {
      console.log('  ✅ Index wird verwendet!')
    } else {
      console.log('  ⚠️ Index wird möglicherweise nicht verwendet (Stage:', executionStats.executionStages?.stage, ')')
    }
    
    console.log('\n✅ Index-Erstellung abgeschlossen!')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Fehler beim Erstellen der Indizes:', error)
    process.exit(1)
  }
}

createLlmModelsIndexes()

