"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useUser, SignInButton } from "@clerk/nextjs"
import { Alert, AlertDescription, AlertTitle, Button } from '@ks/ui'
import { AlertCircle, Loader2, Lock } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslation } from "@ks/i18n/react"
import { useSetActiveLibraryId, useSetLibraries } from '@ks/shell/react'
import { LibraryVerificationWarning } from '@/components/library/library-verification-warning'
import {
  fetchAccessStatus,
  postAccessRequest,
  toClientLibrary,
  type ExplorerAccessStatus,
  type ExplorerContext,
  type ExplorerLibraryPayload,
} from '@ks/module-explorer/react'

const GalleryClient = dynamic(() => import("@/app/library/gallery/client").then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
})

export default function ExplorePage() {
  const params = useParams()
  const { t } = useTranslation()
  const { user, isLoaded: userLoaded } = useUser()
  const slug = params?.slug as string
  const [library, setLibrary] = useState<ExplorerLibraryPayload | null>(null)
  const [exploreContext, setExploreContext] = useState<ExplorerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<ExplorerAccessStatus | null>(null)
  const [requestingAccess, setRequestingAccess] = useState(false)

  const setLibraries = useSetLibraries()
  const setActiveLibraryId = useSetActiveLibraryId()

  const loadLibraryIntoState = useCallback((
    loadedLibrary: ExplorerLibraryPayload,
    ctx: ExplorerContext,
  ) => {
    setLibraries([toClientLibrary(loadedLibrary, ctx)])
    setActiveLibraryId(loadedLibrary.id)
  }, [setLibraries, setActiveLibraryId])

  const lastAccessCheckRef = React.useRef<{ libraryId: string; timestamp: number } | null>(null)
  const ACCESS_CHECK_COOLDOWN_MS = 5000

  const checkAccess = useCallback(async (
    libraryId: string,
    libraryToLoad: ExplorerLibraryPayload | undefined,
    ctx: ExplorerContext,
  ) => {
    const now = Date.now()
    const lastCheck = lastAccessCheckRef.current
    if (lastCheck && lastCheck.libraryId === libraryId && (now - lastCheck.timestamp) < ACCESS_CHECK_COOLDOWN_MS) {
      return
    }

    lastAccessCheckRef.current = { libraryId, timestamp: now }

    const status = await fetchAccessStatus(libraryId)
    setAccessStatus(status)

    if (status.hasAccess && libraryToLoad) {
      loadLibraryIntoState(libraryToLoad, ctx)
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
        let loaded: ExplorerLibraryPayload = {
          ...data.library,
          exploreContext: 'public',
        }
        let ctx: ExplorerContext = 'public'

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
          const loaded: ExplorerLibraryPayload = {
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
      setAccessStatus(await postAccessRequest(library.id))
    } catch (err) {
      console.error('Fehler beim Erstellen der Zugriffsanfrage:', err)
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Zugriffsanfrage')
    } finally {
      setRequestingAccess(false)
    }
  }

  // Website-Landingpage (WebsiteLandingLive) speist sich aus Live-Docs und ist
  // fuer alle (auch anonyme) Besucher der oeffentlichen Library nutzbar.
  // Trigger ist allein das Flag `siteEnabled` — kein Legacy-web/-Snapshot mehr.
  const showSiteTab = library?.siteEnabled === true

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
        {library.logoUrl ? (
          <>
            {/* Website-Logo uebernimmt ab sm+ die Markenrolle (TopNav, ueberlappend) —
               Text-Titel dort ausblenden. Der schmale Spacer gibt nur dem Logo-
               Ueberhang Luft (kein voller Header-Block, sonst wird Platz verschwendet).
               Mobil rendert die TopNav kein Logo, darum bleibt der Titel dort. */}
            <h1 className="px-3 py-2 text-lg font-bold truncate sm:hidden">{library.label}</h1>
            <div className="hidden sm:block sm:h-10" aria-hidden="true" />
          </>
        ) : (
          <div className="flex flex-col gap-3 px-3 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold truncate">{library.label}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                {t('explore.publicLibrary')}
              </p>
            </div>
          </div>
        )}
        {/* A1: Nicht-blockierende Warnung beim Öffnen, falls die Library nicht geprüft ist. */}
        <div className="px-3 pb-2 sm:px-4 sm:pb-3">
          <LibraryVerificationWarning context="public-open" libraryId={library.id} />
        </div>
      </div>

      {/* Padding-Top bewusst auf 0: die Tabs (Inhalte / Story Mode) sollen direkt unter der
         Trennlinie des Page-Headers andocken — analog zur Library-Gallery-Ansicht.
         Seitliches und unteres Padding bleiben wie zuvor (Inhalte sollen nicht am Rand kleben). */}
      <div className="flex-1 min-h-0 overflow-hidden px-2 pt-0 pb-2 sm:px-4 sm:pb-4">
        {/* flex flex-col noetig: sonst ist das flex-1 des GalleryClient-Rootes wirkungslos,
           der Inhalt waechst ueber die Wrapper-Hoehe hinaus und overflow-hidden schneidet
           unten ab (Symptom: Summen-Fusszeile der Tabelle nicht/halb sichtbar). */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <GalleryClient
            libraryIdProp={library.id}
            showSiteTab={showSiteTab}
            defaultToSite={showSiteTab}
            hideWebsiteDocs={true}
          />
        </div>
      </div>
    </div>
  )
}
