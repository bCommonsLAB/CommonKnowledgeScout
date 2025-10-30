import { Library } from '@/types/library'
import { LibraryService } from '@/lib/services/library-service'
import { normalizeChatConfig, getVectorIndexForLibrary } from '@/lib/chat/config'

export interface LibraryChatContext {
  library: Library
  vectorIndex: string
  chat: ReturnType<typeof normalizeChatConfig>
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
  const libraries = await libService.getUserLibraries(userEmail)
  
  console.log('[loadLibraryChatContext] Geladene Libraries:', {
    count: libraries.length,
    ids: libraries.map(l => ({ id: l.id, label: l.label }))
  })
  
  const library = libraries.find(l => l.id === libraryId)
  
  if (!library) {
    console.log('[loadLibraryChatContext] ❌ Library nicht gefunden! Gesuchte ID:', libraryId)
    return null
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


