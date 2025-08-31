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
  const libService = LibraryService.getInstance()
  const libraries = await libService.getUserLibraries(userEmail)
  const library = libraries.find(l => l.id === libraryId)
  if (!library) return null

  const chat = normalizeChatConfig(library.config?.chat)
  const vectorIndex = getVectorIndexForLibrary({ id: library.id, label: library.label }, library.config?.chat, userEmail)
  return { library, vectorIndex, chat }
}


