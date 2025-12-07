'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PerspectivePageContent } from '@/components/library/shared/perspective-page-content'
import { useAtomValue } from 'jotai'
import { librariesAtom } from '@/atoms/library-atom'

/**
 * Perspektivenauswahl-Seite für Story Mode (normale Library-Seiten)
 * 
 * Verwendet die gemeinsame PerspectivePageContent-Komponente
 * Route: /library/gallery/perspective?libraryId=...
 */
interface Library {
  id: string
  label: string
}

export default function LibraryPerspectivePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const libraries = useAtomValue(librariesAtom)
  const libraryId = searchParams?.get('libraryId')
  
  // Prüfe, ob die Seite vom Story Mode aufgerufen wurde (via Query-Parameter)
  const fromStoryMode = searchParams?.get('from') === 'story'
  
  // Lade Library-Daten für Header
  const [library, setLibrary] = useState<Library | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(true)
  
  useEffect(() => {
    if (!libraryId) {
      setLibraryLoading(false)
      return
    }
    
    // Finde Library aus Atom
    const foundLibrary = libraries.find(lib => lib.id === libraryId)
    if (foundLibrary) {
      setLibrary({
        id: foundLibrary.id,
        label: foundLibrary.label,
      })
    }
    setLibraryLoading(false)
  }, [libraryId, libraries])

  function handleBack() {
    if (fromStoryMode) {
      // Wenn vom Story Mode aufgerufen, zurück zum Story Mode
      const params = new URLSearchParams()
      if (libraryId) params.set('libraryId', libraryId)
      params.set('mode', 'story')
      router.push(`/library/gallery?${params.toString()}`)
    } else {
      // Wenn automatisch von Gallery->Story Mode aufgerufen, zurück zur Gallery
      const params = new URLSearchParams()
      if (libraryId) params.set('libraryId', libraryId)
      router.push(`/library/gallery?${params.toString()}`)
    }
  }

  function handleModeChange(mode: 'gallery' | 'story') {
    const params = new URLSearchParams()
    if (libraryId) params.set('libraryId', libraryId)
    if (mode === 'story') {
      params.set('mode', 'story')
    }
    router.push(`/library/gallery?${params.toString()}`)
  }

  function handleSave() {
    // Navigiere zurück zur Gallery (Story Mode)
    const params = new URLSearchParams()
    if (libraryId) params.set('libraryId', libraryId)
    params.set('mode', 'story')
    router.push(`/library/gallery?${params.toString()}`)
  }

  return (
    <PerspectivePageContent
      library={library}
      libraryLoading={libraryLoading}
      onBack={handleBack}
      onModeChange={handleModeChange}
      onSave={handleSave}
      fromStoryMode={fromStoryMode}
    />
  )
}

