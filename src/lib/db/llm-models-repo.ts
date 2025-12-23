/**
 * @fileoverview LLM Models Repository - MongoDB Repository for LLM Model Configuration
 * 
 * @description
 * Repository for managing LLM model configurations in MongoDB. Handles CRUD operations
 * for LLM models, including model metadata, supported languages, strengths, and ordering.
 * 
 * @module chat
 * 
 * @exports
 * - getAllLlmModels: Loads all active models, sorted by order field
 * - getLlmModelById: Loads a model by ID
 * - getSupportedLanguagesForModel: Returns supported languages for a model
 * - getDefaultLlmModel: Returns the default model (first model after sorting)
 * 
 * @usedIn
 * - src/app/api/llm-models: API routes use repository
 * - src/components/library/shared/perspective-page-content.tsx: UI loads models
 * 
 * @dependencies
 * - @/lib/mongodb-service: MongoDB connection and collection access
 * - @/lib/chat/constants: TargetLanguage type
 */

import { getCollection } from '@/lib/mongodb-service'
import type { TargetLanguage } from '@/lib/chat/constants'

const COLLECTION_NAME = 'llm_models'

/**
 * LLM Model Configuration Interface
 */
export interface LlmModel {
  _id: string // Modell-ID (z.B. 'google/gemini-2.5-flash')
  name: string // Anzeigename (z.B. 'Gemini 2.5 Flash')
  provider: string // Provider (z.B. 'google', 'openai', 'anthropic')
  modelId: string // Vollständige Modell-ID für API (z.B. 'google/gemini-2.5-flash')
  supportedLanguages: TargetLanguage[] // Unterstützte Sprachen
  strengths: string // Beschreibung der Stärken (z.B. 'Schnell, kostengünstig, gut für einfache Fragen')
  url?: string // URL zur OpenRouter Detailseite (z.B. 'https://openrouter.ai/models/google/gemini-2.5-flash')
  isActive: boolean // Ob das Modell aktiviert ist
  order: number // Sortierreihenfolge
  createdAt: string
  updatedAt: string
}

/**
 * Erstellt optimierte Indizes für die llm_models Collection
 * Wird automatisch beim ersten Zugriff aufgerufen
 */
async function ensureLlmModelsIndexes(): Promise<void> {
  try {
    const collection = await getCollection<LlmModel>(COLLECTION_NAME)
    await Promise.all([
      // Zusammengesetzter Index für die Haupt-Query: isActive + order
      // Dieser Index beschleunigt getAllLlmModels() erheblich
      collection.createIndex(
        { isActive: 1, order: 1 },
        { name: 'isActive_order_asc' }
      ),
      // Index für modelId-Lookups
      collection.createIndex(
        { modelId: 1 },
        { name: 'modelId_index' }
      ),
      // Index für supportedLanguages (Array-Feld) - für zukünftige serverseitige Filterung
      collection.createIndex(
        { supportedLanguages: 1 },
        { name: 'supportedLanguages_index' }
      ),
      // Hinweis: _id hat bereits automatisch einen eindeutigen Index in MongoDB
    ])
  } catch (error) {
    // Ignoriere Fehler beim Index-Erstellen (z.B. wenn Index bereits existiert)
    console.warn('[llm-models-repo] Warnung beim Erstellen der Indizes:', error)
  }
}

/**
 * Lädt alle aktiven Modelle, sortiert nach `order`-Feld (aufsteigend)
 * 
 * @returns Array von aktiven LLM-Modellen, sortiert nach order
 */
export async function getAllLlmModels(): Promise<LlmModel[]> {
  try {
    // Stelle sicher, dass Indizes existieren (beim ersten Aufruf)
    await ensureLlmModelsIndexes()
    
    const collection = await getCollection<LlmModel>(COLLECTION_NAME)
    const models = await collection
      .find({ isActive: true })
      .sort({ order: 1 }) // Aufsteigend sortieren
      .toArray()
    
    return models
  } catch (error) {
    console.error('[llm-models-repo] Fehler beim Laden der Modelle:', error)
    throw new Error(`Fehler beim Laden der LLM-Modelle: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  }
}

/**
 * Lädt ein Modell nach ID
 * 
 * @param id Modell-ID (z.B. 'google/gemini-2.5-flash')
 * @returns Modell oder null wenn nicht gefunden
 */
export async function getLlmModelById(id: string): Promise<LlmModel | null> {
  try {
    // Stelle sicher, dass Indizes existieren (beim ersten Aufruf)
    await ensureLlmModelsIndexes()
    
    const collection = await getCollection<LlmModel>(COLLECTION_NAME)
    const model = await collection.findOne({ _id: id, isActive: true })
    return model
  } catch (error) {
    console.error(`[llm-models-repo] Fehler beim Laden des Modells ${id}:`, error)
    throw new Error(`Fehler beim Laden des LLM-Modells: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`)
  }
}

/**
 * Gibt unterstützte Sprachen für ein Modell zurück
 * 
 * @param modelId Modell-ID (z.B. 'google/gemini-2.5-flash')
 * @returns Array von unterstützten Sprachen
 */
export async function getSupportedLanguagesForModel(modelId: string): Promise<TargetLanguage[]> {
  try {
    const model = await getLlmModelById(modelId)
    if (!model) {
      return []
    }
    return model.supportedLanguages
  } catch (error) {
    console.error(`[llm-models-repo] Fehler beim Laden der unterstützten Sprachen für ${modelId}:`, error)
    return []
  }
}

/**
 * Gibt das Standard-Modell zurück (erstes Modell nach Sortierung, d.h. niedrigste `order`-Nummer)
 * 
 * @returns Standard-Modell oder null wenn keine Modelle vorhanden
 */
export async function getDefaultLlmModel(): Promise<LlmModel | null> {
  try {
    const models = await getAllLlmModels()
    if (models.length === 0) {
      return null
    }
    return models[0] // Erstes Modell nach Sortierung
  } catch (error) {
    console.error('[llm-models-repo] Fehler beim Laden des Standard-Modells:', error)
    return null
  }
}

