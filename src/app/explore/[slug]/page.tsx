"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSetAtom } from 'jotai'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslation } from "@/lib/i18n/hooks"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { librariesAtom, activeLibraryIdAtom } from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'
import type { Character, SocialContext, TargetLanguage } from '@/lib/chat/constants'

// Gallery dynamisch laden
const GalleryClient = dynamic(() => import("@/app/library/gallery/client").then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
})

interface PublicLibrary {
  id: string
  label: string
  slugName: string
  description?: string
  icon?: string
  chat?: {
    gallery?: {
      detailViewType?: 'book' | 'session'
      facets?: Array<{
        metaKey: string
        label?: string
        type?: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
        multi?: boolean
        visible?: boolean
        buckets?: Array<{ label: string; min: number; max: number }>
      }>
    }
    placeholder?: string
    maxChars?: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    targetLanguage?: TargetLanguage
    character?: Character[] // Array (kann leer sein)
    socialContext?: SocialContext
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: TargetLanguage
      character?: Character[] // Array (kann leer sein)
      socialContext?: SocialContext
      genderInclusive?: boolean
    }
  }
}

export default function ExplorePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { t } = useTranslation()
  const slug = params?.slug as string
  const [library, setLibrary] = useState<PublicLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Jotai State setzen
  const setLibraries = useSetAtom(librariesAtom)
  const setActiveLibraryId = useSetAtom(activeLibraryIdAtom)
  
  // Mode aus URL-Parametern lesen
  const modeParam = searchParams?.get('mode')
  const mode = (modeParam === 'story' ? 'story' : 'gallery') as 'gallery' | 'story'
  
  const handleModeChange = (value: string) => {
    const newMode = value as 'gallery' | 'story'
    const params = new URLSearchParams(searchParams?.toString() || '')
    if (newMode === 'story') {
      params.set('mode', 'story')
    } else {
      params.delete('mode')
    }
    router.replace(`/explore/${slug}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  useEffect(() => {
    async function loadLibrary() {
      if (!slug) {
        setError(t('explore.slugMissing'))
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/public/libraries/${slug}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError(t('explore.libraryNotFound'))
          } else if (response.status === 403) {
            setError(t('explore.libraryNotPublic'))
          } else {
            setError(t('explore.errorLoadingLibrary'))
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        const loadedLibrary = data.library
        
        // WICHTIG: Library direkt in Jotai-State setzen
        // Erstelle ClientLibrary-Format aus der API-Response
        const clientLibrary: ClientLibrary = {
          id: loadedLibrary.id,
          label: loadedLibrary.label,
          type: 'local',
          path: '',
          isEnabled: true,
          config: {
            chat: loadedLibrary.chat, // Vollständige Chat-Config
            publicPublishing: {
              slugName: loadedLibrary.slugName,
              publicName: loadedLibrary.label,
              description: loadedLibrary.description,
              icon: loadedLibrary.icon,
              isPublic: true,
            }
          }
        }
        
        // Setze Library in State (als Array mit einem Element)
        setLibraries([clientLibrary])
        // Setze als aktive Library
        setActiveLibraryId(loadedLibrary.id)
        
        setLibrary(loadedLibrary)
      } catch (err) {
        console.error("Fehler beim Laden der Library:", err)
        setError(t('explore.errorLoadingLibrary'))
      } finally {
        setLoading(false)
      }
    }

    loadLibrary()
  }, [slug, t, setLibraries, setActiveLibraryId])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !library) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('explore.error')}</AlertTitle>
          <AlertDescription>{error || t('explore.libraryNotFound')}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden">
      {/* Header mit integrierten Tabs */}
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex items-start justify-between gap-2 sm:gap-4 px-3 py-2 sm:py-4">
          {/* Linker Bereich: Zurück-Button + Titel als Logo/Label */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Prominenter Zurück-Button zur Homepage */}
            <Link href="/" className="flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-10 sm:w-10 hover:bg-muted/50"
                aria-label={t('common.backToHome')}
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </Link>
            {/* Titel als Logo/Label */}
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {t('explore.publicLibrary')}
              </p>
            </div>
          </div>
          {/* Tabs rechts oben in der Ecke (auch auf mobil) */}
          <div className="flex-shrink-0 self-start pt-0.5">
            <Tabs value={mode} onValueChange={handleModeChange} className="w-auto">
              <TabsList className="h-8 sm:h-10">
                <TabsTrigger value="gallery" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.gallery')}</TabsTrigger>
                <TabsTrigger value="story" className="text-xs sm:text-sm px-2 sm:px-3">{t('gallery.story')}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-4">
        <div className="h-full min-h-0 overflow-hidden">
          <GalleryClient libraryIdProp={library.id} hideTabs={true} />
        </div>
      </div>
    </div>
  )
}

