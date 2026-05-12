'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { useLibraryRole } from './use-library-role'
import {
  sourceFavoritesAtomFamily,
  type SourceFavoritesState,
} from '@/atoms/source-favorites-atom'
import type {
  SourceFavoriteListResponse,
  SourceFavoriteToggleResponse,
} from '@/types/source-favorite'

interface UseSourceFavoritesResult {
  /** Set der aktuell favorisierten fileIds; leer wenn nicht-Member. */
  favoriteIds: Set<string>
  /** Praktischer Helper fuers Spalten-Render. */
  isFavorite: (fileId: string) => boolean
  /**
   * Toggelt den Favoriten-Status optimistisch und gleicht serverseitig ab.
   * Wenn der User kein Member ist, wird kein Request gesendet (no-op).
   */
  toggle: (fileId: string) => Promise<void>
  /** true sobald der initiale Fetch abgeschlossen ist (oder uebersprungen wurde). */
  isReady: boolean
  /** Fehlermeldung des letzten Fetch/Toggle (null wenn ok). */
  error: string | null
}

const EMPTY_STATE: SourceFavoritesState = {
  ids: new Set<string>(),
  isReady: true,
  error: null,
}

/**
 * Lade- und Toggle-Hook fuer geteilte Quell-Favoriten.
 *
 * State liegt in einem Jotai-Atom-Family pro `libraryId`. Mehrere Aufrufe
 * dieses Hooks (Tabelle + Filter + Sticky-Header) teilen sich denselben
 * State - so propagiert ein Toggle in der Tabelle sofort in den Filter.
 *
 * Aktiv ausschliesslich, wenn der User Owner oder Co-Creator der Library
 * ist. Gaeste/Anonyme bekommen ein leeres Set + No-op-Toggle (UI rendert
 * das Star-Icon ohnehin nicht; siehe `useLibraryRole`).
 */
export function useSourceFavorites(libraryId?: string): UseSourceFavoritesResult {
  const { isMember, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  // Sentinel-Atom fuer "keine Library" - der Atom-Family-Key darf kein
  // undefined sein. Der Hook gibt fuer diesen Pfad ohnehin EMPTY_STATE
  // zurueck (siehe unten).
  const atomKey = libraryId ?? '__none__'
  const [state, setState] = useAtom(sourceFavoritesAtomFamily(atomKey))

  useEffect(() => {
    if (isRoleLoading) return
    if (!libraryId || !isMember) {
      // Reset auf leeren State, damit eine alte Befuellung von einem
      // vorherigen Library-Wechsel nicht zurueckbleibt.
      setState((prev) =>
        prev.ids.size === 0 && prev.isReady && prev.error === null
          ? prev
          : { ids: new Set<string>(), isReady: true, error: null },
      )
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, isReady: false, error: null }))
    ;(async () => {
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-favorites`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          throw new Error(`Favoriten konnten nicht geladen werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as SourceFavoriteListResponse
        if (cancelled) return
        setState({ ids: new Set(json.favorites), isReady: true, error: null })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceFavorites] Laden fehlgeschlagen:', message)
        setState((prev) => ({ ...prev, isReady: true, error: message }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [libraryId, isMember, isRoleLoading, setState])

  const effective = libraryId && isMember ? state : EMPTY_STATE

  const isFavorite = useCallback(
    (fileId: string) => effective.ids.has(fileId),
    [effective.ids],
  )

  const toggle = useCallback(
    async (fileId: string) => {
      if (!libraryId || !isMember || !fileId) return

      let snapshot: Set<string> = new Set()
      setState((prev) => {
        snapshot = prev.ids
        const next = new Set(prev.ids)
        if (next.has(fileId)) next.delete(fileId)
        else next.add(fileId)
        return { ids: next, isReady: prev.isReady, error: null }
      })

      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-favorites`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId }),
          },
        )
        if (!res.ok) {
          throw new Error(`Toggle fehlgeschlagen (HTTP ${res.status})`)
        }
        const json = (await res.json()) as SourceFavoriteToggleResponse
        // Mit Server-Antwort reconcilen - so wird ein konkurrierender
        // Toggle aus einem anderen Tab/Geraet korrigiert.
        setState((prev) => {
          const next = new Set(prev.ids)
          if (json.added) next.add(json.fileId)
          else next.delete(json.fileId)
          return { ids: next, isReady: true, error: null }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useSourceFavorites] Toggle fehlgeschlagen, rollback:', message)
        setState((prev) => ({ ids: snapshot, isReady: prev.isReady, error: message }))
      }
    },
    [libraryId, isMember, setState],
  )

  return useMemo(
    () => ({
      favoriteIds: effective.ids,
      isFavorite,
      toggle,
      isReady: effective.isReady,
      error: effective.error,
    }),
    [effective, isFavorite, toggle],
  )
}
