'use client'

/**
 * Das Eintrittsprotokoll des Explorers: Library ueber den Slug laden,
 * Zugriff pruefen, in den Auswahl-Zustand der Schale schreiben.
 *
 * Das Netzwerkprotokoll selbst steht in `explorer-access.ts` (Zugriff) und in
 * `loadPublicOrMember` unten — hier lebt nur die Zustandsmaschine davor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSetActiveLibraryId, useSetLibraries } from '@ks/shell/react'
import { fetchAccessStatus, postAccessRequest } from './explorer-access'
import { toClientLibrary } from './to-client-library'
import type {
  ExplorerAccessStatus,
  ExplorerContext,
  ExplorerLibraryPayload,
  ExplorerViewer,
} from './types'

/** Doppelte Zugriffspruefungen derselben Library innerhalb dieser Spanne verwerfen. */
const ACCESS_CHECK_COOLDOWN_MS = 5000

export interface ExplorerLibraryTexts {
  slugMissing: string
  libraryNotFound: string
  errorLoadingLibrary: string
}

export interface ExplorerLibraryState {
  library: ExplorerLibraryPayload | null
  context: ExplorerContext | null
  loading: boolean
  error: string | null
  accessStatus: ExplorerAccessStatus | null
  requestingAccess: boolean
  requestAccess: () => Promise<void>
}

/** Laedt die Library aus Sicht eines angemeldeten Mitglieds; `null`, wenn keine da ist. */
async function loadMemberLibrary(slug: string): Promise<ExplorerLibraryPayload | null> {
  const response = await fetch(
    `/api/library/explore-by-slug/${encodeURIComponent(slug)}`,
    { cache: 'no-store' },
  )
  if (!response.ok) return null
  const data = await response.json()
  return { ...data.library, exploreContext: 'member' }
}

export function useExplorerLibrary(
  slug: string,
  viewer: ExplorerViewer,
  texts: ExplorerLibraryTexts,
): ExplorerLibraryState {
  const [library, setLibrary] = useState<ExplorerLibraryPayload | null>(null)
  const [context, setContext] = useState<ExplorerContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessStatus, setAccessStatus] = useState<ExplorerAccessStatus | null>(null)
  const [requestingAccess, setRequestingAccess] = useState(false)

  const setLibraries = useSetLibraries()
  const setActiveLibraryId = useSetActiveLibraryId()
  const lastAccessCheckRef = useRef<{ libraryId: string; timestamp: number } | null>(null)

  const { isLoaded: viewerLoaded, isSignedIn } = viewer
  const { slugMissing, libraryNotFound, errorLoadingLibrary } = texts

  useEffect(() => {
    if (!slug) {
      setError(slugMissing)
      setLoading(false)
      return
    }

    let cancelled = false

    /** Uebernimmt eine geladene Library und entscheidet, ob erst geprueft wird. */
    async function adopt(loaded: ExplorerLibraryPayload, ctx: ExplorerContext) {
      setLibrary(loaded)
      setContext(ctx)

      if (!loaded.requiresAuth) {
        setLibraries([toClientLibrary(loaded, ctx)])
        setActiveLibraryId(loaded.id)
        setLoading(false)
        return
      }

      const now = Date.now()
      const lastCheck = lastAccessCheckRef.current
      const inCooldown = lastCheck
        && lastCheck.libraryId === loaded.id
        && (now - lastCheck.timestamp) < ACCESS_CHECK_COOLDOWN_MS
      if (inCooldown) {
        setLoading(false)
        return
      }
      lastAccessCheckRef.current = { libraryId: loaded.id, timestamp: now }

      const status = await fetchAccessStatus(loaded.id)
      if (cancelled) return
      setAccessStatus(status)
      if (status.hasAccess) {
        setLibraries([toClientLibrary(loaded, ctx)])
        setActiveLibraryId(loaded.id)
      }
      setLoading(false)
    }

    async function loadLibrary() {
      setLoading(true)
      setError(null)

      const pubRes = await fetch(`/api/public/libraries/${slug}`, { cache: 'no-store' })
      if (cancelled) return

      if (pubRes.ok) {
        const data = await pubRes.json()
        // Standard: anonyme / fremde Nutzer = public. Eingeloggte Owner/Co-Autoren zusätzlich
        // explore-by-slug → "member", damit Startseiten-Toggle + Storage-Draft (web/) sichtbar sind.
        let loaded: ExplorerLibraryPayload = { ...data.library, exploreContext: 'public' }
        let ctx: ExplorerContext = 'public'

        if (viewerLoaded && isSignedIn) {
          const member = await loadMemberLibrary(slug)
          if (cancelled) return
          if (member) {
            loaded = member
            ctx = 'member'
          }
        }

        await adopt(loaded, ctx)
        return
      }

      // Private Slug / nicht gelistet: nur für eingeloggte Owner/Co-Creator über explore-by-slug
      if (pubRes.status === 404) {
        if (!viewerLoaded) return
        if (!isSignedIn) {
          setError(libraryNotFound)
          setLoading(false)
          return
        }
        const member = await loadMemberLibrary(slug)
        if (cancelled) return
        if (member) {
          await adopt(member, 'member')
          return
        }
        setError(libraryNotFound)
        setLoading(false)
        return
      }

      setError(errorLoadingLibrary)
      setLoading(false)
    }

    loadLibrary()
    return () => {
      cancelled = true
    }
  }, [
    slug, slugMissing, libraryNotFound, errorLoadingLibrary,
    viewerLoaded, isSignedIn, setLibraries, setActiveLibraryId,
  ])

  const requestAccess = useCallback(async () => {
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
  }, [library])

  return { library, context, loading, error, accessStatus, requestingAccess, requestAccess }
}
