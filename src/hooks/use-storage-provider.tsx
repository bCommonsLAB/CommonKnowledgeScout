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
    if (!activeLibraryId) {
      setProvider(null)
      return
    }

    if (libraries.length === 0) {
      setProvider(null)
      return
    }

    const libraryExists = libraries.some(lib => lib.id === activeLibraryId)
    if (!libraryExists) {
      console.warn(`[useStorageProvider] Bibliothek mit ID ${activeLibraryId} existiert nicht in der Liste der verfügbaren Bibliotheken`)
      setProvider(null)
      return
    }

    // OPTIMIERUNG: Prüfe ob es eine öffentliche Library ist
    // Öffentliche Libraries brauchen keinen Storage Provider (werden nur für Gallery/Chat verwendet)
    const currentLibrary = libraries.find(lib => lib.id === activeLibraryId)
    const isPublicLibrary = currentLibrary?.config?.publicPublishing?.isPublic === true
    
    if (isPublicLibrary) {
      setProvider(null)
      return
    }

    const factory = StorageFactory.getInstance()
    
    factory.getProvider(activeLibraryId)
      .then(provider => {
        setProvider(provider)
      })
      .catch(error => {
        // Graceful handling für verschiedene Fehlertypen
        if (error.name === 'LibraryNotFoundError') {
          console.warn(`[useStorageProvider] Library nicht im StorageFactory gefunden: ${activeLibraryId}`, {
            libraryId: activeLibraryId,
            libraryLabel: currentLibrary?.label,
            isPublicLibrary
          })
          setProvider(null)
          return
        }
        
        if (error.name === 'UnsupportedLibraryTypeError') {
          const currentLibrary = libraries.find(lib => lib.id === activeLibraryId)
          console.warn(`[useStorageProvider] Nicht unterstützter Bibliothekstyp "${error.libraryType}" für Bibliothek "${currentLibrary?.label}" - Bibliothek wird übersprungen`, {
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
          console.error(`[useStorageProvider] Fehler beim Laden des Storage Providers für ${activeLibraryId}:`, error)
          setProvider(null)
        }
      })
  }, [activeLibraryId, libraries])

  return provider
} 