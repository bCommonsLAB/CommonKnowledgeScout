/**
 * @fileoverview useStorageProvider Hook - React Hook for Storage Provider Access
 * 
 * @description
 * React hook that provides access to the current storage provider based on the
 * active library. Automatically updates when the active library changes and handles
 * provider initialization and error states gracefully.
 * 
 * @module storage
 * 
 * @exports
 * - useStorageProvider: Hook that returns the current storage provider
 * 
 * @usedIn
 * - src/contexts/storage-context.tsx: Uses hook for provider access
 * - src/components/library: Library components use hook
 * 
 * @dependencies
 * - @/atoms/library-atom: Library state atoms
 * - @/lib/storage/storage-factory: Storage provider factory
 * - @/lib/storage/types: Storage types
 * - @/lib/storage/supported-types: Supported library types
 */

"use client"

import { useEffect, useState } from "react"
import { useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { StorageProvider } from "@/lib/storage/types"
import { StorageFactory } from "@/lib/storage/storage-factory"
import { SUPPORTED_LIBRARY_TYPES } from "@/lib/storage/supported-types"

export function useStorageProvider() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const [provider, setProvider] = useState<StorageProvider | null>(null)

  useEffect(() => {
    console.log('[useStorageProvider] 🔄 Provider-Loading gestartet:', {
      activeLibraryId: activeLibraryId ? activeLibraryId.substring(0, 8) + '...' : null,
      librariesCount: libraries.length,
      timestamp: new Date().toISOString()
    });
    
    if (!activeLibraryId) {
      console.log('[useStorageProvider] ⏸️ Keine activeLibraryId - setze Provider auf null');
      setProvider(null)
      return
    }

    if (libraries.length === 0) {
      console.log('[useStorageProvider] ⏸️ Keine Libraries vorhanden - setze Provider auf null');
      setProvider(null)
      return
    }

    const libraryExists = libraries.some(lib => lib.id === activeLibraryId)
    if (!libraryExists) {
      console.warn(`[useStorageProvider] ⚠️ Bibliothek mit ID ${activeLibraryId.substring(0, 8)}... existiert nicht in der Liste`)
      setProvider(null)
      return
    }

    // OPTIMIERUNG: Prüfe ob es eine öffentliche Library ist
    // Öffentliche Libraries brauchen normalerweise keinen Storage Provider (werden nur für Gallery/Chat verwendet)
    // ABER: Für die normale Library-Ansicht (Archiv) brauchen sie trotzdem einen Provider
    const currentLibrary = libraries.find(lib => lib.id === activeLibraryId)
    const isPublicLibrary = currentLibrary?.config?.publicPublishing?.isPublic === true
    
    // Prüfe ob wir auf der Library-Seite sind (Archiv-Ansicht)
    // In diesem Fall brauchen wir auch für öffentliche Libraries einen Provider
    const isLibraryPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/library')
    
    if (isPublicLibrary && !isLibraryPage) {
      console.log('[useStorageProvider] ⏸️ Öffentliche Library - kein Provider benötigt (nicht auf Library-Seite)', {
        libraryId: activeLibraryId.substring(0, 8) + '...',
        currentPath: typeof window !== 'undefined' ? window.location.pathname : 'SSR',
        isPublicLibrary: true,
        isLibraryPage: false
      });
      setProvider(null)
      return
    }
    
    if (isPublicLibrary && isLibraryPage) {
      console.log('[useStorageProvider] ℹ️ Öffentliche Library auf Library-Seite - Provider wird trotzdem geladen', {
        libraryId: activeLibraryId.substring(0, 8) + '...',
        currentPath: window.location.pathname,
        isPublicLibrary: true,
        isLibraryPage: true
      });
    }

    console.log('[useStorageProvider] 🚀 Lade Provider für Library:', {
      libraryId: activeLibraryId.substring(0, 8) + '...',
      libraryType: currentLibrary?.type,
      libraryLabel: currentLibrary?.label,
      isPublicLibrary: isPublicLibrary,
      isLibraryPage: isLibraryPage,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'SSR',
      timestamp: new Date().toISOString()
    });

    const factory = StorageFactory.getInstance()
    
    factory.getProvider(activeLibraryId)
      .then(provider => {
        console.log('[useStorageProvider] ✅ Provider geladen:', {
          providerId: provider.id.substring(0, 8) + '...',
          providerName: provider.name,
          timestamp: new Date().toISOString()
        });
        setProvider(provider)
      })
      .catch(error => {
        console.error('[useStorageProvider] ❌ Fehler beim Laden des Providers:', {
          libraryId: activeLibraryId.substring(0, 8) + '...',
          errorName: error.name,
          errorMessage: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Graceful handling für verschiedene Fehlertypen
        if (error.name === 'LibraryNotFoundError') {
          console.warn(`[useStorageProvider] ⚠️ Library nicht im StorageFactory gefunden: ${activeLibraryId.substring(0, 8)}...`, {
            libraryId: activeLibraryId,
            libraryLabel: currentLibrary?.label,
            isPublicLibrary
          })
          setProvider(null)
          return
        }
        
        if (error.name === 'UnsupportedLibraryTypeError') {
          const currentLibrary = libraries.find(lib => lib.id === activeLibraryId)
          console.warn(`[useStorageProvider] ⚠️ Nicht unterstützter Bibliothekstyp "${error.libraryType}" für Bibliothek "${currentLibrary?.label}"`, {
            libraryId: activeLibraryId,
            libraryType: error.libraryType,
            libraryLabel: currentLibrary?.label
          })
          
          // Versuche eine andere Bibliothek zu finden
          const supportedLibrary = libraries.find(lib => 
            lib.id !== activeLibraryId && 
            SUPPORTED_LIBRARY_TYPES.includes(lib.type as unknown as (typeof SUPPORTED_LIBRARY_TYPES)[number])
          )
          
          if (supportedLibrary) {
            // TODO: activeLibraryId auf supportedLibrary.id setzen
            // Für jetzt setzen wir Provider auf null
          }
          
          setProvider(null)
        } else {
          console.error(`[useStorageProvider] ❌ Fehler beim Laden des Storage Providers für ${activeLibraryId.substring(0, 8)}...:`, error)
          setProvider(null)
        }
      })
  }, [activeLibraryId, libraries])

  return provider
} 