import { Library } from '@/types/library'
import { LibraryService, type UserLibraries } from '@/lib/services/library-service'
import { normalizeChatConfig, getVectorIndexForLibrary } from '@/lib/chat/config'

export interface LibraryChatContext {
  library: Library
  vectorIndex: string
  chat: ReturnType<typeof normalizeChatConfig>
}

/**
 * Findet die Owner-Email einer öffentlichen Library
 * @param libraryId Die Library-ID
 * @returns Die Owner-Email oder null wenn nicht gefunden
 */
async function findLibraryOwnerEmail(libraryId: string): Promise<string | null> {
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
 */
export async function loadLibraryChatContext(
  userEmail: string,
  libraryId: string
): Promise<LibraryChatContext | null> {
  console.log('[loadLibraryChatContext] Request:', { 
    userEmail: userEmail ? `${userEmail.split('@')[0]}@...` : 'none', 
    libraryId 
  })
  
  const libService = LibraryService.getInstance()
  
  // Wenn keine Email vorhanden ist, versuche öffentliche Library zu laden
  if (!userEmail || userEmail === '') {
    console.log('[loadLibraryChatContext] Keine Email - versuche öffentliche Library zu laden (ID oder Slug)')
    // Versuche zuerst direkt über ID, dann über Slug
    const byId = await loadPublicLibraryById(libraryId)
    if (byId) return byId
    return loadPublicLibraryBySlug(libraryId)
  }
  
  const libraries = await libService.getUserLibraries(userEmail)
  
  console.log('[loadLibraryChatContext] Geladene Libraries:', {
    count: libraries.length,
    ids: libraries.map(l => ({ id: l.id, label: l.label }))
  })
  
  const library = libraries.find(l => l.id === libraryId)
  
  if (!library) {
    console.log('[loadLibraryChatContext] ❌ Library nicht gefunden! Gesuchte ID:', libraryId)
    // Versuche auch öffentliche Library zu laden (zuerst über ID, dann über Slug)
    const byId = await loadPublicLibraryById(libraryId)
    if (byId) return byId
    return loadPublicLibraryBySlug(libraryId)
  }

  console.log('[loadLibraryChatContext] ✅ Library gefunden:', {
    id: library.id,
    label: library.label,
    type: library.type
  })

  const chat = normalizeChatConfig(library.config?.chat)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat, userEmail)
  
  console.log('[loadLibraryChatContext] Berechneter vectorIndex:', vectorIndex)
  
  return { library, vectorIndex, chat }
}

/**
 * Lädt eine öffentliche Bibliothek direkt über ihre ID
 */
export async function loadPublicLibraryById(
  libraryId: string
): Promise<LibraryChatContext | null> {
  console.log('[loadPublicLibraryById] Request:', { libraryId })
  
  const libService = LibraryService.getInstance()
  const library = await libService.getPublicLibraryById(libraryId)
  
  if (!library) {
    console.log('[loadPublicLibraryById] ❌ Öffentliche Library nicht gefunden! ID:', libraryId)
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    console.log('[loadPublicLibraryById] ❌ Library ist nicht öffentlich! ID:', libraryId)
    return null
  }

  console.log('[loadPublicLibraryById] ✅ Öffentliche Library gefunden:', {
    id: library.id,
    label: library.label,
    slugName: library.config?.publicPublishing?.slugName
  })

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Für öffentliche Libraries: Ermittle Owner-Email für Index-Berechnung
  // Wenn indexOverride gesetzt ist, wird dieser direkt verwendet (ohne Email-Präfix)
  // Ansonsten verwenden wir die Owner-Email für die Index-Berechnung
  const ownerEmail = await findLibraryOwnerEmail(libraryId)
  console.log('[loadPublicLibraryById] Owner-Email:', ownerEmail ? `${ownerEmail.split('@')[0]}@...` : 'nicht gefunden')
  
  // Verwende Owner-Email für Index-Berechnung (auch im anonymen Modus)
  // indexOverride hat Priorität und wird direkt verwendet
  const vectorIndex = getVectorIndexForLibrary(
    { id: library.id, label: library.label }, 
    library.config?.chat, 
    ownerEmail || undefined
  )
  
  console.log('[loadPublicLibraryById] Berechneter vectorIndex:', vectorIndex)
  
  return { library, vectorIndex, chat }
}

/**
 * Lädt eine öffentliche Bibliothek nach Slug-Name
 */
export async function loadPublicLibraryBySlug(
  slugName: string
): Promise<LibraryChatContext | null> {
  console.log('[loadPublicLibraryBySlug] Request:', { slugName })
  
  const libService = LibraryService.getInstance()
  const library = await libService.getPublicLibraryBySlug(slugName)
  
  if (!library) {
    console.log('[loadPublicLibraryBySlug] ❌ Öffentliche Library nicht gefunden! Slug:', slugName)
    return null
  }

  // Prüfe ob Library wirklich öffentlich ist
  if (library.config?.publicPublishing?.isPublic !== true) {
    console.log('[loadPublicLibraryBySlug] ❌ Library ist nicht öffentlich! Slug:', slugName)
    return null
  }

  console.log('[loadPublicLibraryBySlug] ✅ Öffentliche Library gefunden:', {
    id: library.id,
    label: library.label,
    slugName: library.config?.publicPublishing?.slugName
  })

  const chat = normalizeChatConfig(library.config?.chat)
  
  // Für öffentliche Libraries: Ermittle Owner-Email für Index-Berechnung
  // Wenn indexOverride gesetzt ist, wird dieser direkt verwendet (ohne Email-Präfix)
  // Ansonsten verwenden wir die Owner-Email für die Index-Berechnung
  const ownerEmail = await findLibraryOwnerEmailBySlug(slugName)
  console.log('[loadPublicLibraryBySlug] Owner-Email:', ownerEmail ? `${ownerEmail.split('@')[0]}@...` : 'nicht gefunden')
  
  // Verwende Owner-Email für Index-Berechnung (auch im anonymen Modus)
  // indexOverride hat Priorität und wird direkt verwendet
  const vectorIndex = getVectorIndexForLibrary(
    { id: library.id, label: library.label }, 
    library.config?.chat, 
    ownerEmail || undefined
  )
  
  console.log('[loadPublicLibraryBySlug] Berechneter vectorIndex:', vectorIndex)
  
  return { library, vectorIndex, chat }
}


