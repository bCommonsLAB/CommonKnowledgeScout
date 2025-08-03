"use client"

import { useEffect, useState } from "react"
import { useAtomValue } from "jotai"
import { activeLibraryIdAtom, librariesAtom } from "@/atoms/library-atom"
import { StorageProvider } from "@/lib/storage/types"
import { StorageFactory } from "@/lib/storage/storage-factory"
import { UseStorageProviderLogger } from "@/lib/storage/storage-logger"

export function useStorageProvider() {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom)
  const libraries = useAtomValue(librariesAtom)
  const [provider, setProvider] = useState<StorageProvider | null>(null)

  useEffect(() => {
    // Logging der aktiven Library und Provider-Initialisierung
    UseStorageProviderLogger.debug('useEffect aufgerufen', {
      activeLibraryId,
      libraries: libraries.map(lib => ({ id: lib.id, label: lib.label })),
    });

    if (!activeLibraryId) {
      UseStorageProviderLogger.info('Keine aktive Bibliothek, setze Provider auf null')
      setProvider(null)
      return
    }

    if (libraries.length === 0) {
      UseStorageProviderLogger.info('Bibliotheksliste ist leer, warte auf Bibliotheken')
      setProvider(null)
      return
    }

    const libraryExists = libraries.some(lib => lib.id === activeLibraryId)
    if (!libraryExists) {
      UseStorageProviderLogger.warn('Bibliothek existiert nicht in der Liste', { activeLibraryId })
      setProvider(null)
      return
    }

    UseStorageProviderLogger.info('Initialisiere Provider für Bibliothek', { activeLibraryId })
    const factory = StorageFactory.getInstance()
    
    factory.getProvider(activeLibraryId)
      .then(provider => {
        UseStorageProviderLogger.info('Provider erfolgreich initialisiert', { 
          providerName: provider.name, 
          providerId: provider.id 
        })
        setProvider(provider)
      })
      .catch(error => {
        UseStorageProviderLogger.error('Fehler beim Laden des Storage Providers', error)
        setProvider(null)
      })
  }, [activeLibraryId, libraries])

  return provider
} 