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
import { normalizeChatConfig, getVectorIndexForLibrary } from '@/lib/chat/config'
import { computeDocMetaCollectionName } from '@/lib/repositories/doc-meta-repo'

export interface LibraryChatContext {
  library: Library
  vectorIndex: string
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
 * Migriert eine Library-Config: Berechnet und speichert collectionName und indexName.
 * Migriert auch indexOverride → indexName.
 * @param library Die zu migrierende Library
 * @param userEmail Die User-Email (falls vorhanden, sonst wird Owner-Email ermittelt)
 * @returns Die migrierte Library
 */
async function migrateLibraryConfig(library: Library, userEmail?: string): Promise<Library> {
  // Prüfe ob Migration bereits durchgeführt wurde
  const hasCollectionName = !!library.config?.chat?.vectorStore?.collectionName
  const hasIndexName = !!library.config?.chat?.vectorStore?.indexName   
  const hasIndexOverride = !!(library.config?.chat?.vectorStore as { indexOverride?: boolean })?.indexOverride
  
  if (hasCollectionName && hasIndexName && !hasIndexOverride) {
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
  
  // Berechne Index-Name nach alter Logik (mit Email-Präfix) für Migration
  // Diese Funktion bildet die alte Logik nach, die Email-Präfix verwendet hat
  const { slugifyIndexName } = await import('@/lib/chat/config')
  
  // Alte Logik: indexOverride hat Priorität
  const oldIndexOverride = (library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride
  let indexName: string
  
  if (oldIndexOverride && oldIndexOverride.trim().length > 0) {
    // indexOverride wurde verwendet (ohne Email-Präfix)
    indexName = slugifyIndexName(oldIndexOverride)
  } else {
    // Basis aus Label berechnen
    const base = slugifyIndexName(library.label) || slugifyIndexName(`lib-${library.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'default'}`)
    
    // Alte Logik: Mit Email-Präfix (wenn Email vorhanden)
    if (effectiveEmail && effectiveEmail.trim().length > 0) {
      const emailSlug = slugifyIndexName(effectiveEmail)
      indexName = slugifyIndexName(`${emailSlug}-${base}`)
    } else {
      indexName = base
    }
  }
  
  // Erstelle neue Config mit migrierten Werten
  const updatedConfig = {
    ...library.config,
    chat: {
      ...library.config?.chat,
      vectorStore: {
        ...library.config?.chat?.vectorStore,
        collectionName,
        // Migration: indexOverride → indexName
        indexName: (library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride || indexName,
      },
    },
  }
  
  // Entferne indexOverride aus vectorStore (falls vorhanden)
  const vectorStore = updatedConfig.chat?.vectorStore as { indexOverride?: string; collectionName?: string; indexName?: string } | undefined;
  if (vectorStore && 'indexOverride' in vectorStore) {
    delete vectorStore.indexOverride;
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
      indexName: migratedLibrary.config?.chat?.vectorStore?.indexName,
    })
  } else {
    console.warn('[migrateLibraryConfig] Konnte Library nicht speichern, keine Owner-Email gefunden:', library.id)
  }
  
  return migratedLibrary
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
  let library = libraries.find(l => l.id === libraryId)
  
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

  // Migration: Prüfe ob collectionName und indexName vorhanden sind
  const needsMigration = !library.config?.chat?.vectorStore?.collectionName || 
                         !library.config?.chat?.vectorStore?.indexName ||
                         !!(library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride
  
  if (needsMigration) {
    library = await migrateLibraryConfig(library, userEmail)
  }

  const chat = normalizeChatConfig(library.config?.chat)
  // Verwende indexName aus Config (deterministisch, getVectorIndexForLibrary prüft Config automatisch)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat)
  
  const context = { library, vectorIndex, chat }
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
  let library = await libService.getPublicLibraryById(libraryId)
  
  if (!library) {
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    return null
  }

  // Migration: Prüfe ob collectionName und indexName vorhanden sind
  const needsMigration = !library.config?.chat?.vectorStore?.collectionName || 
                         !library.config?.chat?.vectorStore?.indexName ||
                         !!(library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride
  
  if (needsMigration) {
    library = await migrateLibraryConfig(library)
  }

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Verwende indexName aus Config (deterministisch, keine Owner-Email mehr, getVectorIndexForLibrary prüft Config automatisch)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat)
  
  return { library, vectorIndex, chat }
}

/**
 * Lädt eine öffentliche Bibliothek nach Slug-Name
 * Führt automatische Migration durch, wenn collectionName oder indexName fehlen.
 */
export async function loadPublicLibraryBySlug(
  slugName: string
): Promise<LibraryChatContext | null> {
  const libService = LibraryService.getInstance()
  let library = await libService.getPublicLibraryBySlug(slugName)
  
  if (!library) {
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    return null
  }

  // Migration: Prüfe ob collectionName und indexName vorhanden sind
  const needsMigration = !library.config?.chat?.vectorStore?.collectionName || 
                         !library.config?.chat?.vectorStore?.indexName ||
                         !!(library.config?.chat?.vectorStore as { indexOverride?: string })?.indexOverride
  
  if (needsMigration) {
    library = await migrateLibraryConfig(library)
  }

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Verwende indexName aus Config (deterministisch, keine Owner-Email mehr, getVectorIndexForLibrary prüft Config automatisch)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat)
  
  return { library, vectorIndex, chat }
}


