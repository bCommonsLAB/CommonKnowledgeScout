"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useSetAtom } from 'jotai'
import { useUser, SignInButton } from "@clerk/nextjs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2, Lock } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslation } from "@/lib/i18n/hooks"
import { Button } from "@/components/ui/button"
import { librariesAtom, activeLibraryIdAtom } from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'
import type { Character, SocialContext, TargetLanguage } from '@/lib/chat/constants'

const GalleryClient = dynamic(() => import("@/app/library/gallery/client").then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
})

/** Antwort von GET /api/public/libraries/[slug] oder /api/library/explore-by-slug/[slug] */
interface ExploreLibraryPayload {
  id: string
  label: string
  slugName: string
  description?: string
  icon?: string
  requiresAuth?: boolean
  /** Nur bei Member-Explore: ob die Library öffentlich geschaltet ist */
  isPublic?: boolean
  siteEnabled?: boolean
  sitePublished?: boolean
  siteUrl?: string
  siteVersion?: number
  sitePublishedAt?: string
  exploreContext?: 'public' | 'member'
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
    character?: Character[]
    socialContext?: SocialContext
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: TargetLanguage
      character?: Character[]
      socialContext?: SocialContext
      genderInclusive?: boolean
    }
  }
}

export default function ExplorePage() {
  const params = useParams()
  const { t } = useTranslation()
  const { user, isLoaded: userLoaded } = useUser()
  const slug = params?.slug as string
  const [library, setLibrary] = useState<ExploreLibraryPayload | null>(null)
  const [exploreContext, setExploreContext] = useState<'public' | 'member' | null>(null)
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

  const setLibraries = useSetAtom(librariesAtom)
  const setActiveLibraryId = useSetAtom(activeLibraryIdAtom)

  const loadLibraryIntoState = useCallback((loadedLibrary: ExploreLibraryPayload, ctx: 'public' | 'member') => {
    const clientLibrary: ClientLibrary = {
      id: loadedLibrary.id,
      label: loadedLibrary.label,
      type: 'local',
      path: '',
      isEnabled: true,
      config: {
        chat: loadedLibrary.chat,
        publicPublishing: {
          slugName: loadedLibrary.slugName,
          publicName: loadedLibrary.label,
          description: loadedLibrary.description || '',
          icon: loadedLibrary.icon,
          isPublic: ctx === 'public' ? true : (loadedLibrary.isPublic === true),
          requiresAuth: loadedLibrary.requiresAuth,
          siteEnabled: loadedLibrary.siteEnabled,
          sitePublished: loadedLibrary.sitePublished,
          siteUrl: loadedLibrary.siteUrl,
          siteVersion: loadedLibrary.siteVersion,
          sitePublishedAt: loadedLibrary.sitePublishedAt,
        }
      }
    }
    setLibraries([clientLibrary])
    setActiveLibraryId(loadedLibrary.id)
  }, [setLibraries, setActiveLibraryId])

  const lastAccessCheckRef = React.useRef<{ libraryId: string; timestamp: number } | null>(null)
  const ACCESS_CHECK_COOLDOWN_MS = 5000

  const checkAccess = useCallback(async (
    libraryId: string,
    libraryToLoad: ExploreLibraryPayload | undefined,
    ctx: 'public' | 'member',
  ) => {
    const now = Date.now()
    const lastCheck = lastAccessCheckRef.current
    if (lastCheck && lastCheck.libraryId === libraryId && (now - lastCheck.timestamp) < ACCESS_CHECK_COOLDOWN_MS) {
      return
    }

    try {
      lastAccessCheckRef.current = { libraryId, timestamp: now }

      const response = await fetch(`/api/libraries/${libraryId}/access-check`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 429) {
          setAccessStatus({
            hasAccess: false,
            requiresAuth: true,
            message: errorData.message || 'Zu viele Anfragen. Bitte warten Sie einen Moment.',
            rateLimited: true,
          })
          return
        }

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
        loadLibraryIntoState(libraryToLoad, ctx)
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

  useEffect(() => {
    if (!slug) {
      setError(t('explore.slugMissing'))
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadLibrary() {
      setLoading(true)
      setError(null)

      const pubRes = await fetch(`/api/public/libraries/${slug}`, { cache: 'no-store' })
      if (cancelled) return

      if (pubRes.ok) {
        const data = await pubRes.json()
        // Standard: anonyme / fremde Nutzer = public. Eingeloggte Owner/Co-Autoren zusätzlich
        // explore-by-slug → "member", damit Startseiten-Toggle + Storage-Draft (web/) sichtbar sind.
        let loaded: ExploreLibraryPayload = {
          ...data.library,
          exploreContext: 'public',
        }
        let ctx: 'public' | 'member' = 'public'

        if (userLoaded && user) {
          const memRes = await fetch(
            `/api/library/explore-by-slug/${encodeURIComponent(slug)}`,
            { cache: 'no-store' },
          )
          if (!cancelled && memRes.ok) {
            const memData = await memRes.json()
            loaded = {
              ...memData.library,
              exploreContext: 'member',
            }
            ctx = 'member'
          }
        }

        setLibrary(loaded)
        setExploreContext(ctx)
        if (loaded.requiresAuth) {
          await checkAccess(loaded.id, loaded, ctx)
        } else {
          loadLibraryIntoState(loaded, ctx)
        }
        setLoading(false)
        return
      }

      // Private Slug / nicht gelistet: nur für eingeloggte Owner/Co-Creator über explore-by-slug
      if (pubRes.status === 404) {
        if (!userLoaded) {
          return
        }
        if (!user) {
          setError(t('explore.libraryNotFound'))
          setLoading(false)
          return
        }
        const memRes = await fetch(`/api/library/explore-by-slug/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        })
        if (cancelled) return
        if (memRes.ok) {
          const data = await memRes.json()
          const loaded: ExploreLibraryPayload = {
            ...data.library,
            exploreContext: 'member',
          }
          setLibrary(loaded)
          setExploreContext('member')
          if (loaded.requiresAuth) {
            await checkAccess(loaded.id, loaded, 'member')
          } else {
            loadLibraryIntoState(loaded, 'member')
          }
          setLoading(false)
          return
        }
        setError(t('explore.libraryNotFound'))
        setLoading(false)
        return
      }

      setError(t('explore.errorLoadingLibrary'))
      setLoading(false)
    }

    loadLibrary()
    return () => {
      cancelled = true
    }
  }, [slug, t, userLoaded, user])

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

  const draftSitePath = library
    ? `/api/library/${encodeURIComponent(library.id)}/web/web/index.html`
    : ''

  const showSiteTab =
    library?.siteEnabled === true &&
    (
      exploreContext === 'member' ||
      (library?.sitePublished === true && Boolean(library?.siteUrl))
    )

  const siteIframeSrc =
    library
      ? exploreContext === 'member'
        ? draftSitePath
        : library.sitePublished && library.siteUrl
          ? library.siteUrl
          : ''
      : ''

  if (loading || !userLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !library || !exploreContext) {
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

  if (library.requiresAuth && accessStatus) {
    if (!accessStatus.hasAccess) {
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
      <div className="border-b bg-background flex-shrink-0">
        <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
              {t('explore.publicLibrary')}
            </p>
          </div>
        </div>
      </div>

      {/* Padding-Top bewusst auf 0: die Tabs (Inhalte / Story Mode) sollen direkt unter der
         Trennlinie des Page-Headers andocken — analog zur Library-Gallery-Ansicht.
         Seitliches und unteres Padding bleiben wie zuvor (Inhalte sollen nicht am Rand kleben). */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 pt-0 pb-2 sm:px-4 sm:pb-4">
        <div className="h-full min-h-0 overflow-hidden">
          <GalleryClient
            libraryIdProp={library.id}
            hideTabs={false}
            showSiteTab={showSiteTab}
            siteViewSrc={siteIframeSrc}
            siteSandbox={
              exploreContext === 'member'
                ? "allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                : "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            }
          />
        </div>
      </div>
    </div>
  )
}
