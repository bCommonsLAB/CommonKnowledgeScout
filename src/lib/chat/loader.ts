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
 * Findet die Owner-Email einer öffentlichen Library
 * @param libraryId Die Library-ID
 * @returns Die Owner-Email oder null wenn nicht gefunden
 */
export async function findLibraryOwnerEmail(libraryId: string): Promise<string | null> {
  const { getCollection } = await import('@/lib/mongodb-service')
  
  try {
    const collection = await getCollection<UserLibraries>('libraries')
    const allEntries = await collection.find({}).toArray()
    
    for (const entry of allEntries) {
      if (entry.libraries && Array.isArray(entry.libraries)) {
        const library = entry.libraries.find(
          (lib: Library) =>
            lib.id === libraryId &&
            lib.config?.publicPublishing?.isPublic === true
        )
        
        if (library) {
          return entry.email
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('[findLibraryOwnerEmail] Fehler:', error)
    return null
  }
}

/**
 * Findet die Owner-Email einer öffentlichen Library nach Slug
 * @param slugName Der Slug-Name der Library
 * @returns Die Owner-Email oder null wenn nicht gefunden
 */
async function findLibraryOwnerEmailBySlug(slugName: string): Promise<string | null> {
  const { getCollection } = await import('@/lib/mongodb-service')
  
  try {
    const collection = await getCollection<UserLibraries>('libraries')
    const allEntries = await collection.find({}).toArray()
    
    for (const entry of allEntries) {
      if (entry.libraries && Array.isArray(entry.libraries)) {
        const library = entry.libraries.find(
          (lib: Library) =>
            lib.config?.publicPublishing?.isPublic === true &&
            lib.config?.publicPublishing?.slugName === slugName
        )
        
        if (library) {
          return entry.email
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('[findLibraryOwnerEmailBySlug] Fehler:', error)
    return null
  }
}

/**
 * Lädt eine Bibliothek für einen Benutzer (per E-Mail) und liefert
 * die normalisierte Chat-Konfiguration sowie den abgeleiteten Indexnamen.
 * Verwendet Caching, um wiederholte MongoDB-Queries zu vermeiden.
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

  const chat = normalizeChatConfig(library.config?.chat)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat, userEmail)
  
  const context = { library, vectorIndex, chat }
  setCachedContext(userEmail, libraryId, context)
  return context
}

/**
 * Lädt eine öffentliche Bibliothek direkt über ihre ID
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

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Für öffentliche Libraries: Ermittle Owner-Email für Index-Berechnung
  // Wenn indexOverride gesetzt ist, wird dieser direkt verwendet (ohne Email-Präfix)
  // Ansonsten verwenden wir die Owner-Email für die Index-Berechnung
  const ownerEmail = await findLibraryOwnerEmail(libraryId)
  
  // Verwende Owner-Email für Index-Berechnung (auch im anonymen Modus)
  // indexOverride hat Priorität und wird direkt verwendet
  const vectorIndex = getVectorIndexForLibrary(
    { id: library.id, label: library.label }, 
    library.config?.chat, 
    ownerEmail || undefined
  )
  
  return { library, vectorIndex, chat }
}

/**
 * Lädt eine öffentliche Bibliothek nach Slug-Name
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

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Für öffentliche Libraries: Ermittle Owner-Email für Index-Berechnung
  // Wenn indexOverride gesetzt ist, wird dieser direkt verwendet (ohne Email-Präfix)
  // Ansonsten verwenden wir die Owner-Email für die Index-Berechnung
  const ownerEmail = await findLibraryOwnerEmailBySlug(slugName)
  
  // Verwende Owner-Email für Index-Berechnung (auch im anonymen Modus)
  // indexOverride hat Priorität und wird direkt verwendet
  const vectorIndex = getVectorIndexForLibrary(
    { id: library.id, label: library.label }, 
    library.config?.chat, 
    ownerEmail || undefined
  )
  
  return { library, vectorIndex, chat }
}


