'use client'

import { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { useAuth } from '@clerk/nextjs'
import { librariesAtom } from '@/atoms/library-atom'

/**
 * Hook zur Prüfung, ob der aktuelle User Owner einer bestimmten Library ist
 * 
 * @param libraryId Die Library-ID, die geprüft werden soll
 * @returns Object mit:
 * - isOwner: boolean - true wenn User Owner der Library ist
 * - isLoading: boolean - true wenn Auth-Status noch geladen wird
 */
export function useIsLibraryOwner(libraryId?: string) {
  const { isLoaded, isSignedIn } = useAuth()
  const libraries = useAtomValue(librariesAtom)

  const isOwner = useMemo(() => {
    // Wenn Auth noch nicht geladen oder User nicht angemeldet, ist er kein Owner
    if (!isLoaded || !isSignedIn) {
      return false
    }

    // Wenn keine Library-ID angegeben, ist User kein Owner
    if (!libraryId) {
      return false
    }

    // Prüfe ob Library in der Liste der Libraries des Users ist
    // Wenn Library in Liste, ist User automatisch Owner
    return libraries.some(lib => lib.id === libraryId)
  }, [isLoaded, isSignedIn, libraryId, libraries])

  return {
    isOwner,
    isLoading: !isLoaded,
  }
}

