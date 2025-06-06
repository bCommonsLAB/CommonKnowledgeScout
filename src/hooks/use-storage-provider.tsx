"use client"

import { useEffect, useState } from "react"
import { useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { StorageProvider } from "@/lib/storage/types"
import { StorageFactory } from "@/lib/storage/storage-factory"

export function useStorageProvider() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const [provider, setProvider] = useState<StorageProvider | null>(null)

  useEffect(() => {
    // Logging der aktiven Library und Provider-Initialisierung
    // eslint-disable-next-line no-console
    console.log('[useStorageProvider] useEffect:', {
      activeLibraryId,
      libraries: libraries.map(lib => ({ id: lib.id, label: lib.label })),
    });

    if (!activeLibraryId) {
      console.log('[useStorageProvider] Keine aktive Bibliothek, setze Provider auf null')
      setProvider(null)
      return
    }

    if (libraries.length === 0) {
      console.log('[useStorageProvider] Bibliotheksliste ist leer, warte auf Bibliotheken')
      setProvider(null)
      return
    }

    const libraryExists = libraries.some(lib => lib.id === activeLibraryId)
    if (!libraryExists) {
      console.warn(`[useStorageProvider] Bibliothek mit ID ${activeLibraryId} existiert nicht in der Liste der verfügbaren Bibliotheken`)
      setProvider(null)
      return
    }

    console.log(`[useStorageProvider] Initialisiere Provider für Bibliothek: ${activeLibraryId}`)
    const factory = StorageFactory.getInstance()
    
    factory.setLibraries(libraries)
    
    factory.getProvider(activeLibraryId)
      .then(provider => {
        console.log(`[useStorageProvider] Provider erfolgreich initialisiert: ${provider.name} (ID: ${provider.id})`)
        setProvider(provider)
      })
      .catch(error => {
        console.error(`[useStorageProvider] Fehler beim Laden des Storage Providers für ${activeLibraryId}:`, error)
        setProvider(null)
      })
  }, [activeLibraryId, libraries])

  return provider
} 