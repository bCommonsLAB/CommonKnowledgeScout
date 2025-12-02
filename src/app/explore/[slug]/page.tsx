"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSetAtom } from 'jotai'
import { useUser, SignInButton } from "@clerk/nextjs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, ArrowLeft, Lock } from "lucide-react"
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
  requiresAuth?: boolean
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
  const { user, isLoaded: userLoaded } = useUser()
  const slug = params?.slug as string
  const [library, setLibrary] = useState<PublicLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<{
    hasAccess: boolean
    status?: 'pending' | 'approved' | 'rejected'
    requiresAuth?: boolean
    message?: string
    rateLimited?: boolean
  } | null>(null)
  const [requestingAccess, setRequestingAccess] = useState(false)
  
  // Jotai State setzen
  const setLibraries = useSetAtom(librariesAtom)
  const setActiveLibraryId = useSetAtom(activeLibraryIdAtom)
  
  // Mode aus URL-Parametern lesen
  const modeParam = searchParams?.get('mode')
  const mode = (modeParam === 'story' ? 'story' : 'gallery') as 'gallery' | 'story'
  
  const handleModeChange = (value: string) => {
    const newMode = value as 'gallery' | 'story'
    const params = new URLSearchParams(searchParams?.toString() || '')
    
    // WICHTIG: Entferne doc Parameter beim Wechsel zum Story-Mode
    // Der doc Parameter sollte nicht im Story-Mode vorhanden sein
    if (newMode === 'story') {
      const hadDoc = params.has('doc')
      params.delete('doc')
      params.set('mode', 'story')
      console.log('[ExplorePage] ✅ Story-Mode: doc Parameter entfernt:', {
        hatteDoc: hadDoc,
        docWertVorher: searchParams?.get('doc'),
        paramsNachher: params.toString(),
      })
    } else {
      params.delete('mode')
    }
    
    router.replace(`/explore/${slug}${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const loadLibraryIntoState = useCallback((loadedLibrary: PublicLibrary) => {
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
          description: loadedLibrary.description || '',
          icon: loadedLibrary.icon,
          isPublic: true,
          requiresAuth: loadedLibrary.requiresAuth,
        }
      }
    }
    
    // Setze Library in State (als Array mit einem Element)
    setLibraries([clientLibrary])
    // Setze als aktive Library
    setActiveLibraryId(loadedLibrary.id)
  }, [setLibraries, setActiveLibraryId])

  // Rate Limiting auf Client-Seite: Verhindere zu häufige Aufrufe
  const lastAccessCheckRef = React.useRef<{ libraryId: string; timestamp: number } | null>(null)
  const ACCESS_CHECK_COOLDOWN_MS = 5000 // 5 Sekunden Cooldown zwischen Aufrufen

  const checkAccess = useCallback(async (libraryId: string, libraryToLoad?: PublicLibrary) => {
    // Prüfe Cooldown
    const now = Date.now()
    const lastCheck = lastAccessCheckRef.current
    if (lastCheck && lastCheck.libraryId === libraryId && (now - lastCheck.timestamp) < ACCESS_CHECK_COOLDOWN_MS) {
      console.log('[ExplorePage] Access-Check übersprungen (Cooldown)')
      return
    }

    try {
      lastAccessCheckRef.current = { libraryId, timestamp: now }
      
      const response = await fetch(`/api/libraries/${libraryId}/access-check`, {
        cache: 'no-store', // Kein Browser-Cache, da wir Server-Cache haben
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        // Rate Limit Error behandeln
        if (response.status === 429) {
          console.warn('[ExplorePage] Rate Limit erreicht, warte...')
          setAccessStatus({
            hasAccess: false,
            requiresAuth: true,
            message: errorData.message || 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
            rateLimited: true,
          })
          return
        }
        
        console.error('[ExplorePage] Access-Check Fehler:', response.status, errorData)
        setAccessStatus({
          hasAccess: false,
          requiresAuth: true,
          message: errorData.error || 'Fehler beim Prüfen des Zugriffs',
        })
        return
      }

      const data = await response.json()
      setAccessStatus(data)

      if (data.hasAccess && libraryToLoad) {
        // Zugriff vorhanden - Library laden
        loadLibraryIntoState(libraryToLoad)
      }
    } catch (err) {
      console.error('[ExplorePage] Fehler beim Prüfen des Zugriffs:', err)
      setAccessStatus({
        hasAccess: false,
        requiresAuth: true,
        message: 'Fehler beim Prüfen des Zugriffs',
      })
    }
  }, [loadLibraryIntoState])

  // Ref um zu verhindern, dass die Library mehrfach geladen wird
  const libraryLoadedRef = React.useRef<string | null>(null)

  useEffect(() => {
    async function loadLibrary() {
      if (!slug) {
        setError(t('explore.slugMissing'))
        setLoading(false)
        return
      }

      // Verhindere mehrfaches Laden derselben Library
      if (libraryLoadedRef.current === slug) {
        return
      }

      libraryLoadedRef.current = slug
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/public/libraries/${slug}`, {
          cache: 'force-cache', // Cache für 5 Minuten (Browser-Cache)
        })
        if (!response.ok) {
          libraryLoadedRef.current = null // Reset bei Fehler
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
        
        setLibrary(loadedLibrary)
        
        // Prüfe Zugriff wenn requiresAuth aktiv ist
        if (loadedLibrary.requiresAuth) {
          await checkAccess(loadedLibrary.id, loadedLibrary)
        } else {
          // Keine Zugriffsprüfung nötig - Library direkt laden
          loadLibraryIntoState(loadedLibrary)
        }
      } catch (err) {
        libraryLoadedRef.current = null // Reset bei Fehler
        console.error("Fehler beim Laden der Library:", err)
        setError(t('explore.errorLoadingLibrary'))
      } finally {
        setLoading(false)
      }
    }

    // Nur laden wenn userLoaded true ist (oder wenn kein Auth benötigt wird)
    // Warte nicht auf userLoaded, wenn die Library keine Auth benötigt
    if (userLoaded !== false) {
      loadLibrary()
    }

    // Reset Ref wenn slug sich ändert
    return () => {
      if (libraryLoadedRef.current !== slug) {
        libraryLoadedRef.current = null
      }
    }
  }, [slug, t, userLoaded, checkAccess, loadLibraryIntoState]) // checkAccess und loadLibraryIntoState sind durch useCallback stabil

  async function requestAccess() {
    if (!library) return

    setRequestingAccess(true)
    try {
      const response = await fetch(`/api/libraries/${library.id}/access-request`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen der Zugriffsanfrage')
      }

      // Zugriffsstatus aktualisieren
      setAccessStatus({
        hasAccess: false,
        status: 'pending',
        requiresAuth: true,
        message: 'Ihre Anfrage wurde erfolgreich erstellt und wird bearbeitet',
      })
    } catch (err) {
      console.error('Fehler beim Erstellen der Zugriffsanfrage:', err)
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Zugriffsanfrage')
    } finally {
      setRequestingAccess(false)
    }
  }

  if (loading || !userLoaded) {
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

  // Zugriffsprüfung für requiresAuth Libraries
  if (library.requiresAuth && accessStatus) {
    if (!accessStatus.hasAccess) {
      // Nicht angemeldet
      if (!user) {
        return (
          <div className="container mx-auto px-4 py-8">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>Anmeldung erforderlich</AlertTitle>
              <AlertDescription>
                Diese Library erfordert eine Anmeldung und Freigabe. Bitte melden Sie sich an, um fortzufahren.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <SignInButton 
                mode="modal"
                fallbackRedirectUrl={`/explore/${slug}`}
              >
                <Button>
                  Zur Anmeldung
                </Button>
              </SignInButton>
            </div>
          </div>
        )
      }

      // Anfrage pending
      if (accessStatus.status === 'pending') {
        return (
          <div className="container mx-auto px-4 py-8">
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Ihre Anfrage wird bearbeitet</AlertTitle>
              <AlertDescription>
                Ihre Zugriffsanfrage wurde erhalten und wird von den Administratoren geprüft. Sie erhalten eine E-Mail, sobald über Ihre Anfrage entschieden wurde.
              </AlertDescription>
            </Alert>
          </div>
        )
      }

      // Kein Zugriff - Zeige Anfrage-Button
      return (
        <div className="container mx-auto px-4 py-8">
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Zugriff erforderlich</AlertTitle>
            <AlertDescription>
              Diese Library erfordert eine Freigabe. Bitte stellen Sie eine Zugriffsanfrage.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button 
              onClick={requestAccess} 
              disabled={requestingAccess}
            >
              {requestingAccess ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                'Zugriff anfragen'
              )}
            </Button>
          </div>
        </div>
      )
    }
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

