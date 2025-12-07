'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { PerspectivePageContent } from '@/components/library/shared/perspective-page-content'

/**
 * Perspektivenauswahl-Seite für Story Mode (Explore-Seiten)
 * 
 * Verwendet die gemeinsame PerspectivePageContent-Komponente
 * Route: /explore/[slug]/perspective
 */
interface PublicLibrary {
  id: string
  label: string
  slugName: string
  description?: string
}

export default function PerspectivePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  
  // Prüfe, ob die Seite vom Story Mode aufgerufen wurde (via Query-Parameter)
  const fromStoryMode = searchParams?.get('from') === 'story'
  
  // Lade Library-Daten für Header
  const [library, setLibrary] = useState<PublicLibrary | null>(null)
  const [libraryLoading, setLibraryLoading] = useState(true)
  
  useEffect(() => {
    async function loadLibrary() {
      if (!slug) {
        setLibraryLoading(false)
        return
      }
      
      try {
        const response = await fetch(`/api/public/libraries/${slug}`)
        if (response.ok) {
          const data = await response.json()
          setLibrary(data.library)
        }
      } catch (err) {
        console.error('Fehler beim Laden der Library:', err)
      } finally {
        setLibraryLoading(false)
      }
    }
    
    loadLibrary()
  }, [slug])

  function handleBack() {
    if (fromStoryMode) {
      // Wenn vom Story Mode aufgerufen, zurück zum Story Mode
      router.push(`/explore/${slug}?mode=story`)
    } else {
      // Wenn automatisch von Gallery->Story Mode aufgerufen, zurück zur Gallery
      router.push(`/explore/${slug}`)
    }
  }
  
  function handleModeChange(mode: 'gallery' | 'story') {
    if (mode === 'story') {
      router.push(`/explore/${slug}?mode=story`)
    } else {
      router.push(`/explore/${slug}`)
    }
  }

  function handleSave() {
    // Navigiere zurück zur Story-Mode-Seite
    router.push(`/explore/${slug}?mode=story`)
  }

  return (
    <PerspectivePageContent
      library={library ? { id: library.id, label: library.label } : null}
      libraryLoading={libraryLoading}
      onBack={handleBack}
      onModeChange={handleModeChange}
      onSave={handleSave}
      fromStoryMode={fromStoryMode}
    />
  )
}

