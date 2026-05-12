'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useAtom } from 'jotai'
import { useLibraryRole } from './use-library-role'
import {
  sourceUserStatesAtomFamily,
  type SourceUserStatesState,
} from '@/atoms/source-user-states-atom'
import type {
  OwnUserStatesResponse,
  SetUserStateResponse,
  SourceUserStateValue,
} from '@/types/source-user-state'

export interface UseUserStatesResult {
  /** Set der eigenen Sterne (`fileId`s); leer wenn nicht-Member. */
  favoriteIds: Set<string>
  /** Set der eigenen "nicht wichtig"-Markierungen; leer wenn nicht-Member. */
  notImportantIds: Set<string>
  /** Praktische Helper. */
  isFavorite: (fileId: string) => boolean
  isNotImportant: (fileId: string) => boolean
  /**
   * Setzt oder loescht den State fuer eine Quelle. `null` entfernt den
   * Eintrag (zurueck zu undefined). No-op fuer Nicht-Member.
   */
  setState: (fileId: string, state: SourceUserStateValue | null) => Promise<void>
  /** true sobald der initiale Fetch abgeschlossen ist (oder uebersprungen wurde). */
  isReady: boolean
  /** Fehlermeldung des letzten Fetch/Set (null wenn ok). */
  error: string | null
}

const EMPTY_STATE: SourceUserStatesState = {
  favoriteIds: new Set<string>(),
  notImportantIds: new Set<string>(),
  isReady: true,
  error: null,
}

/**
 * Lade- und Set-Hook fuer per-User-Quellzustaende (Sterne + "nicht
 * wichtig"). State liegt in einem Jotai-Atom-Family pro `libraryId` -
 * mehrere Hook-Instanzen teilen sich denselben State.
 *
 * Aktiv ausschliesslich, wenn der User Owner oder Co-Creator der
 * Library ist. Gaeste/Anonyme bekommen leere Sets + No-op-Setter
 * (UI rendert die Sterne ohnehin nicht).
 */
export function useUserStates(libraryId?: string): UseUserStatesResult {
  const { isMember, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  // Sentinel-Atom fuer "keine Library" - der Atom-Family-Key darf kein
  // undefined sein. Der Hook gibt fuer diesen Pfad ohnehin EMPTY_STATE
  // zurueck (siehe unten).
  const atomKey = libraryId ?? '__none__'
  const [state, setStateAtom] = useAtom(sourceUserStatesAtomFamily(atomKey))

  useEffect(() => {
    if (isRoleLoading) return
    if (!libraryId || !isMember) {
      setStateAtom((prev) =>
        prev.favoriteIds.size === 0 &&
        prev.notImportantIds.size === 0 &&
        prev.isReady &&
        prev.error === null
          ? prev
          : {
              favoriteIds: new Set<string>(),
              notImportantIds: new Set<string>(),
              isReady: true,
              error: null,
            },
      )
      return
    }

    let cancelled = false
    setStateAtom((prev) => ({ ...prev, isReady: false, error: null }))
    ;(async () => {
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-user-states`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          throw new Error(`Sterne konnten nicht geladen werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as OwnUserStatesResponse
        if (cancelled) return
        setStateAtom({
          favoriteIds: new Set(json.favorites),
          notImportantIds: new Set(json.notImportant),
          isReady: true,
          error: null,
        })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useUserStates] Laden fehlgeschlagen:', message)
        setStateAtom((prev) => ({ ...prev, isReady: true, error: message }))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [libraryId, isMember, isRoleLoading, setStateAtom])

  const effective = libraryId && isMember ? state : EMPTY_STATE

  const isFavorite = useCallback(
    (fileId: string) => effective.favoriteIds.has(fileId),
    [effective.favoriteIds],
  )
  const isNotImportant = useCallback(
    (fileId: string) => effective.notImportantIds.has(fileId),
    [effective.notImportantIds],
  )

  const setUserState = useCallback(
    async (fileId: string, nextState: SourceUserStateValue | null) => {
      if (!libraryId || !isMember || !fileId) return

      // Optimistic update: Sets entsprechend dem Ziel-State setzen.
      let snapshotFav: Set<string> = new Set()
      let snapshotNotImp: Set<string> = new Set()
      setStateAtom((prev) => {
        snapshotFav = prev.favoriteIds
        snapshotNotImp = prev.notImportantIds
        const fav = new Set(prev.favoriteIds)
        const ni = new Set(prev.notImportantIds)
        // Beim Setzen eines Wertes muss der jeweils andere geleert
        // werden (ein User hat genau einen State pro Quelle).
        fav.delete(fileId)
        ni.delete(fileId)
        if (nextState === 'favorite') fav.add(fileId)
        if (nextState === 'not_important') ni.add(fileId)
        return { favoriteIds: fav, notImportantIds: ni, isReady: prev.isReady, error: null }
      })

      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-user-states`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, state: nextState }),
          },
        )
        if (!res.ok) {
          throw new Error(`State konnte nicht gespeichert werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as SetUserStateResponse
        // Mit Server-Antwort reconcilen.
        setStateAtom((prev) => {
          const fav = new Set(prev.favoriteIds)
          const ni = new Set(prev.notImportantIds)
          fav.delete(json.fileId)
          ni.delete(json.fileId)
          if (json.state === 'favorite') fav.add(json.fileId)
          if (json.state === 'not_important') ni.add(json.fileId)
          return { favoriteIds: fav, notImportantIds: ni, isReady: true, error: null }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useUserStates] Set fehlgeschlagen, rollback:', message)
        setStateAtom((prev) => ({
          favoriteIds: snapshotFav,
          notImportantIds: snapshotNotImp,
          isReady: prev.isReady,
          error: message,
        }))
      }
    },
    [libraryId, isMember, setStateAtom],
  )

  return useMemo(
    () => ({
      favoriteIds: effective.favoriteIds,
      notImportantIds: effective.notImportantIds,
      isFavorite,
      isNotImportant,
      setState: setUserState,
      isReady: effective.isReady,
      error: effective.error,
    }),
    [effective, isFavorite, isNotImportant, setUserState],
  )
}
