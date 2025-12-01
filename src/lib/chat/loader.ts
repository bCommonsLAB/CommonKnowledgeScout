/**
 * @fileoverview Chat Loader - Library Chat Context Loading
 * 
 * @description
 * Loads library chat context including library configuration, vector index name, and
 * normalized chat configuration. Handles both authenticated users and anonymous users
 * (for public libraries). Supports loading by library ID or slug name.
 * 
 * @module chat
 * 
 * @exports
 * - loadLibraryChatContext: Main function to load library chat context
 * - LibraryChatContext: Interface for library chat context
 * 
 * @usedIn
 * - src/app/api/chat/[libraryId]/stream/route.ts: Chat endpoint loads context
 * - src/lib/chat/orchestrator.ts: Orchestrator uses context
 * - src/lib/chat/retrievers: Retrievers use context for configuration
 * 
 * @dependencies
 * - @/lib/services/library-service: Library service for loading libraries
 * - @/lib/mongodb-service: MongoDB access for public library lookup
 * - @/lib/chat/config: Chat configuration normalization
 * - @/types/library: Library type definitions
 */

import { Library } from '@/types/library'
import { LibraryService, type UserLibraries } from '@/lib/services/library-service'
import { normalizeChatConfig } from '@/lib/chat/config'
import { computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'

export interface LibraryChatContext {
  library: Library
  chat: ReturnType<typeof normalizeChatConfig>
}

/**
 * Cache für LibraryChatContext
 * Verhindert wiederholte MongoDB-Queries und Berechnungen
 */
interface CacheEntry {
  context: LibraryChatContext
  timestamp: number
}

const contextCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 Minuten

/**
 * Generiert einen Cache-Key für LibraryChatContext
 */
function getCacheKey(userEmail: string, libraryId: string): string {
  return `${userEmail || 'anonymous'}:${libraryId}`
}

/**
 * Prüft, ob ein Cache-Eintrag noch gültig ist
 */
function getCachedContext(userEmail: string, libraryId: string): LibraryChatContext | null {
  const key = getCacheKey(userEmail, libraryId)
  const entry = contextCache.get(key)
  
  if (!entry) {
    return null
  }
  
  const now = Date.now()
  if (now - entry.timestamp > CACHE_TTL_MS) {
    contextCache.delete(key)
    return null
  }
  
  return entry.context
}

/**
 * Speichert einen LibraryChatContext im Cache
 */
function setCachedContext(userEmail: string, libraryId: string, context: LibraryChatContext): void {
  const key = getCacheKey(userEmail, libraryId)
  contextCache.set(key, {
    context,
    timestamp: Date.now(),
  })
}

/**
 * Löscht einen Cache-Eintrag (z.B. nach Library-Update)
 */
export function invalidateLibraryContextCache(libraryId: string): void {
  // Lösche alle Cache-Einträge für diese Library-ID
  const keysToDelete: string[] = []
  for (const [key] of contextCache) {
    if (key.endsWith(`:${libraryId}`)) {
      keysToDelete.push(key)
    }
  }
  keysToDelete.forEach(key => contextCache.delete(key))
}

/**
 * Findet die Owner-Email einer Library (nur noch für Migration verwendet).
 * @param libraryId Die Library-ID
 * @returns Die Owner-Email oder null wenn nicht gefunden
 * @deprecated Nur noch für Migration verwendet, wird nach Migration entfernt
 */
async function findLibraryOwnerEmailForMigration(libraryId: string): Promise<string | null> {
  const { getCollection } = await import('@/lib/mongodb-service')
  
  try {
    const collection = await getCollection<UserLibraries>('libraries')
    const allEntries = await collection.find({}).toArray()
    
    for (const entry of allEntries) {
      if (entry.libraries && Array.isArray(entry.libraries)) {
        const library = entry.libraries.find((lib: Library) => lib.id === libraryId)
        if (library) {
          return entry.email
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('[findLibraryOwnerEmailForMigration] Fehler:', error)
    return null
  }
}

/**
 * Prüft ob eine Library Migration benötigt.
 * @param library Die zu prüfende Library
 * @returns true wenn Migration benötigt wird
 */
function needsLibraryMigration(library: Library): boolean {
  return !library.config?.chat?.vectorStore?.collectionName || 
         !library.config?.chat?.embeddings?.dimensions ||
         !!(library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride
}

/**
 * Migriert eine Library-Config: Berechnet und speichert collectionName und embeddings.dimensions.
 * @param library Die zu migrierende Library
 * @param userEmail Die User-Email (falls vorhanden, sonst wird Owner-Email ermittelt)
 * @returns Die migrierte Library
 */
async function migrateLibraryConfig(library: Library, userEmail?: string): Promise<Library> {
  // Prüfe ob Migration bereits durchgeführt wurde
  const hasCollectionName = !!library.config?.chat?.vectorStore?.collectionName
  const hasEmbeddingsDimensions = !!library.config?.chat?.embeddings?.dimensions
  
  if (hasCollectionName && hasEmbeddingsDimensions) {
    // Migration bereits durchgeführt
    return library
  }
  
  console.log('[migrateLibraryConfig] Starte Migration für Library:', library.id)
  
  // Ermittle Owner-Email für Collection-Name-Berechnung (nur wenn nicht vorhanden)
  let effectiveEmail = userEmail
  if (!effectiveEmail) {
    effectiveEmail = await findLibraryOwnerEmailForMigration(library.id) || undefined
  }
  
  // Berechne Collection-Name nach alter Logik
  const strategy = (process.env.DOCMETA_COLLECTION_STRATEGY === 'per_tenant' ? 'per_tenant' : 'per_library') as 'per_library' | 'per_tenant'
  const collectionName = computeDocMetaCollectionName(effectiveEmail || '', library.id, strategy)
  
  // Setze embeddings.dimensions wenn nicht vorhanden (basierend auf Model)
  const embeddingsConfig = library.config?.chat?.embeddings
  let dimensions = embeddingsConfig?.dimensions
  if (!dimensions) {
    // Verwende Defaults aus zentralem Schema
    const { getDefaultEmbeddings } = await import('@/lib/chat/config')
    const defaults = getDefaultEmbeddings()
    const model = embeddingsConfig?.embeddingModel || defaults.embeddingModel
    if (model.includes('text-embedding-3-large')) {
      dimensions = 3072
    } else {
      dimensions = defaults.dimensions // Standard aus zentralem Schema
    }
  }
  
  // Erstelle neue Config mit migrierten Werten
  const updatedConfig = {
    ...library.config,
    chat: {
      ...library.config?.chat,
      vectorStore: {
        ...(library.config?.chat?.vectorStore || {}),
        collectionName,
      },
      embeddings: {
        embeddingModel: embeddingsConfig?.embeddingModel || 'voyage-3-large',
        chunkSize: embeddingsConfig?.chunkSize || 1000,
        chunkOverlap: embeddingsConfig?.chunkOverlap || 200,
        dimensions, // Explizit setzen
      },
    },
  }
  
  // Entferne indexOverride und indexName aus vectorStore (falls vorhanden)
  const vectorStore = updatedConfig.chat?.vectorStore as { indexOverride?: string; indexName?: string; collectionName?: string } | undefined;
  if (vectorStore) {
    if ('indexOverride' in vectorStore) {
      delete vectorStore.indexOverride;
    }
    if ('indexName' in vectorStore) {
      delete vectorStore.indexName;
    }
  }
  
  const migratedLibrary: Library = {
    ...library,
    config: updatedConfig,
  }
  
  // Speichere migrierte Library zurück (nur wenn Owner-Email bekannt)
  if (effectiveEmail) {
    const libService = LibraryService.getInstance()
    await libService.updateLibrary(effectiveEmail, migratedLibrary)
    console.log('[migrateLibraryConfig] Migration abgeschlossen für Library:', library.id, {
      collectionName,
      dimensions,
    })
  } else {
    console.warn('[migrateLibraryConfig] Konnte Library nicht speichern, keine Owner-Email gefunden:', library.id)
  }
  
  return migratedLibrary
}

/**
 * Erstellt einen LibraryChatContext aus einer Library.
 * Behandelt Migration und Config-Normalisierung.
 * @param library Die Library
 * @param userEmail Optional: User-Email für Migration
 * @returns LibraryChatContext
 */
async function createLibraryChatContext(
  library: Library,
  userEmail?: string
): Promise<LibraryChatContext> {
  // Migration: Prüfe ob collectionName und embeddings.dimensions vorhanden sind
  if (needsLibraryMigration(library)) {
    library = await migrateLibraryConfig(library, userEmail)
  }

  const chat = normalizeChatConfig(library.config?.chat)
  
  return { library, chat }
}

/**
 * Lädt eine Bibliothek für einen Benutzer (per E-Mail) und liefert
 * die normalisierte Chat-Konfiguration sowie den abgeleiteten Indexnamen.
 * Verwendet Caching, um wiederholte MongoDB-Queries zu vermeiden.
 * Führt automatische Migration durch, wenn collectionName oder indexName fehlen.
 */
export async function loadLibraryChatContext(
  userEmail: string,
  libraryId: string
): Promise<LibraryChatContext | null> {
  // Prüfe Cache zuerst
  const cached = getCachedContext(userEmail, libraryId)
  if (cached) {
    return cached
  }
  
  const libService = LibraryService.getInstance()
  
  // Wenn keine Email vorhanden ist, versuche öffentliche Library zu laden
  if (!userEmail || userEmail === '') {
    // Versuche zuerst direkt über ID, dann über Slug
    const byId = await loadPublicLibraryById(libraryId)
    if (byId) {
      setCachedContext(userEmail, libraryId, byId)
      return byId
    }
    const bySlug = await loadPublicLibraryBySlug(libraryId)
    if (bySlug) {
      setCachedContext(userEmail, libraryId, bySlug)
      return bySlug
    }
    return null
  }
  
  const libraries = await libService.getUserLibraries(userEmail)
  const library = libraries.find(l => l.id === libraryId)
  
  if (!library) {
    // Versuche auch öffentliche Library zu laden (zuerst über ID, dann über Slug)
    const byId = await loadPublicLibraryById(libraryId)
    if (byId) {
      setCachedContext(userEmail, libraryId, byId)
      return byId
    }
    const bySlug = await loadPublicLibraryBySlug(libraryId)
    if (bySlug) {
      setCachedContext(userEmail, libraryId, bySlug)
      return bySlug
    }
    return null
  }

  const context = await createLibraryChatContext(library, userEmail)
  setCachedContext(userEmail, libraryId, context)
  return context
}

/**
 * Lädt eine öffentliche Bibliothek direkt über ihre ID
 * Führt automatische Migration durch, wenn collectionName oder indexName fehlen.
 */
export async function loadPublicLibraryById(
  libraryId: string
): Promise<LibraryChatContext | null> {
  const libService = LibraryService.getInstance()
  const library = await libService.getPublicLibraryById(libraryId)
  
  if (!library) {
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    return null
  }

  return await createLibraryChatContext(library)
}

/**
 * Lädt eine öffentliche Bibliothek nach Slug-Name
 * Führt automatische Migration durch, wenn collectionName oder indexName fehlen.
 */
export async function loadPublicLibraryBySlug(
  slugName: string
): Promise<LibraryChatContext | null> {
  const libService = LibraryService.getInstance()
  const library = await libService.getPublicLibraryBySlug(slugName)
  
  if (!library) {
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    return null
  }

  return await createLibraryChatContext(library)
}


