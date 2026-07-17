'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLibraryRole } from './use-library-role'
import type {
  OwnUserStatesResponse,
  SetUserStateResponse,
  SourceUserStateValue,
} from '@/types/source-user-state'

/**
 * Per-User-Zustand pro Quelle: lazy bulk-loaded ueber
 * `POST source-user-states/bulk` (fileIds im JSON-Body).
 *
 * Hintergrund: Bei Galerien mit hunderten/tausenden Quellen wuerde ein
 * "alles auf einmal laden"-Pattern den Server bombardieren oder grosse
 * Antworten erzeugen. Stattdessen meldet jede Karte ihre `fileId` an,
 * der Hook batch'd die Anfragen in 200-ms-Fenstern und feuert pro
 * Library nur einen einzigen Request fuer alle in diesem Fenster
 * angemeldeten IDs ab. Mehrere Hook-Instanzen teilen sich den Modul-
 * Cache.
 *
 * Fuer den "Nur Favoriten"-Filter (gallery-root) gibt es einen
 * separaten Helper `useOwnFavoriteIds`, der einmalig alle eigenen
 * Favoriten der Library laedt - das ist eine kleine Liste und
 * unabhaengig von der Karten-Sichtbarkeit.
 */

interface LibraryCache {
  /** Bekannte States pro fileId (nur 'favorite' / 'not_important'; leer = unknown). */
  states: Map<string, SourceUserStateValue>
  /** IDs, fuer die der Server bereits geantwortet hat (auch ohne State). */
  seen: Set<string>
  /** IDs, die im aktuellen 200-ms-Fenster auf den Flush warten. */
  pending: Set<string>
  flushTimer: ReturnType<typeof setTimeout> | null
  inFlight: Promise<void> | null
  subscribers: Set<() => void>
}

const moduleCache = new Map<string, LibraryCache>()

function getLibraryCache(libraryId: string): LibraryCache {
  let cache = moduleCache.get(libraryId)
  if (!cache) {
    cache = {
      states: new Map(),
      seen: new Set(),
      pending: new Set(),
      flushTimer: null,
      inFlight: null,
      subscribers: new Set(),
    }
    moduleCache.set(libraryId, cache)
  }
  return cache
}

function notifySubscribers(cache: LibraryCache): void {
  for (const sub of cache.subscribers) sub()
}

async function flushPending(libraryId: string): Promise<void> {
  const cache = getLibraryCache(libraryId)
  cache.flushTimer = null
  if (cache.pending.size === 0) return
  const ids = Array.from(cache.pending)
  cache.pending.clear()
  // Schon vor der Antwort als "gesehen" markieren, damit parallele
  // Mounts in der Zwischenzeit nichts duplizieren.
  for (const id of ids) cache.seen.add(id)

  // POST mit Body statt GET-Query: bei grossen Libraries sprengen die
  // base64-kodierten fileIds sonst das URL-Limit (HTTP 431).
  const url = `/api/library/${encodeURIComponent(libraryId)}/source-user-states/bulk`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: ids }),
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`Eigene Sterne konnten nicht geladen werden (HTTP ${res.status})`)
    }
    const json = (await res.json()) as OwnUserStatesResponse
    for (const id of json.favorites) cache.states.set(id, 'favorite')
    for (const id of json.notImportant) cache.states.set(id, 'not_important')
    // IDs ohne Eintrag bleiben "seen" mit fehlendem State -> isFavorite/
    // isNotImportant returnen false ohne weiteren Roundtrip.
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.warn('[useUserStates] Bulk-Laden fehlgeschlagen:', message)
    // Bei Fehler die IDs aus `seen` herausnehmen, damit ein spaeterer
    // Mount ggf. erneut versuchen kann (z.B. nach Reconnect).
    for (const id of ids) cache.seen.delete(id)
  } finally {
    notifySubscribers(cache)
  }
}

function scheduleFlush(libraryId: string): void {
  const cache = getLibraryCache(libraryId)
  if (cache.flushTimer !== null) return
  cache.flushTimer = setTimeout(() => {
    cache.inFlight = flushPending(libraryId).finally(() => {
      cache.inFlight = null
    })
  }, 200)
}

function enqueueFileIds(libraryId: string, fileIds: readonly string[]): boolean {
  const cache = getLibraryCache(libraryId)
  let queued = false
  for (const id of fileIds) {
    if (!id) continue
    if (cache.seen.has(id)) continue
    if (cache.pending.has(id)) continue
    cache.pending.add(id)
    queued = true
  }
  if (queued) scheduleFlush(libraryId)
  return queued
}

/**
 * Workaround fuer Tests / Logout: Caches komplett oder pro Library
 * leeren, damit der naechste Hook-Mount neu fetched.
 */
export function invalidateUserStatesCache(libraryId?: string): void {
  if (!libraryId) {
    moduleCache.clear()
    return
  }
  moduleCache.delete(libraryId)
}

export interface UseUserStatesResult {
  /**
   * Nur noch privater "nicht wichtig"-Marker; der eigene Stern kommt aus
   * den Doc-Feldern (`isFavorite`) des Galerie-Endpoints.
   */
  isNotImportant: (fileId: string) => boolean
  /** true sobald mindestens ein Bulk-Fetch beantwortet wurde. */
  isReady: boolean
  /**
   * Setzt oder loescht den State fuer eine Quelle. `null` entfernt den
   * Eintrag (zurueck zu undefined). No-op fuer Nicht-Member.
   */
  setState: (fileId: string, state: SourceUserStateValue | null) => Promise<void>
  /** Letzte Fehlermeldung (Set-Operation oder Bulk-Laden). */
  error: string | null
}

/**
 * Lazy-Bulk-Hook fuer per-User-Quellzustaende. `visibleFileIds`
 * bestimmt, welche IDs angefordert werden - typischerweise gibt der
 * Aufrufer hier die aktuell gerenderten Karten weiter.
 *
 * Aktiv ausschliesslich, wenn der User Owner oder Co-Creator ist;
 * Gaeste/Anonyme bekommen `false`-Helper und einen No-op-Setter.
 */
export function useUserStates(
  libraryId: string | undefined,
  visibleFileIds: readonly string[] = [],
): UseUserStatesResult {
  const { isMember, isLoading: isRoleLoading } = useLibraryRole(libraryId)

  // Tick-State, damit React re-rendert, sobald sich der Modul-Cache
  // aendert. Wir lesen die echten Werte direkt aus dem Cache, vermeiden
  // also doppelte State-Replikation.
  const [, setTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!libraryId) return
    const cache = getLibraryCache(libraryId)
    const sub = () => {
      setTick((n) => n + 1)
      setIsReady(true)
    }
    cache.subscribers.add(sub)
    return () => {
      cache.subscribers.delete(sub)
    }
  }, [libraryId])

  // Sichtbare IDs anmelden, sobald sie sich aendern. Memo-Array kommt
  // vom Aufrufer; das ist seine Verantwortung.
  useEffect(() => {
    if (isRoleLoading) return
    if (!libraryId || !isMember || visibleFileIds.length === 0) return
    enqueueFileIds(libraryId, visibleFileIds)
  }, [libraryId, isMember, isRoleLoading, visibleFileIds])

  const isNotImportant = useCallback(
    (fileId: string): boolean => {
      if (!libraryId || !isMember || !fileId) return false
      const cache = getLibraryCache(libraryId)
      return cache.states.get(fileId) === 'not_important'
    },
    [libraryId, isMember],
  )

  const setUserState = useCallback(
    async (fileId: string, nextState: SourceUserStateValue | null) => {
      if (!libraryId || !isMember || !fileId) return
      const cache = getLibraryCache(libraryId)
      const prev = cache.states.get(fileId) ?? null

      if (nextState === null) cache.states.delete(fileId)
      else cache.states.set(fileId, nextState)
      cache.seen.add(fileId)
      notifySubscribers(cache)

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
        if (json.state === null) cache.states.delete(json.fileId)
        else cache.states.set(json.fileId, json.state)
        notifySubscribers(cache)
        setError(null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useUserStates] Set fehlgeschlagen, rollback:', message)
        if (prev === null) cache.states.delete(fileId)
        else cache.states.set(fileId, prev)
        notifySubscribers(cache)
        setError(message)
      }
    },
    [libraryId, isMember],
  )

  return useMemo(
    () => ({ isNotImportant, isReady, setState: setUserState, error }),
    [isNotImportant, isReady, setUserState, error],
  )
}

/**
 * Holt einmalig alle eigenen Favoriten-IDs der Library. Wird vom
 * "Nur Favoriten"-Filter und der Sortierung in gallery-root genutzt.
 *
 * `enabled = false` schaltet den Fetch aus (kein Request, leeres Set).
 * Damit kann der Aufrufer den Endpoint komplett vermeiden, wenn der
 * Filter nicht aktiv ist - ideal bei riesigen Libraries.
 */
const allFavoritesFetched = new Set<string>()
const allFavoritesInFlight = new Map<string, Promise<void>>()

export interface UseOwnFavoriteIdsResult {
  favoriteIds: Set<string>
  notImportantIds: Set<string>
  isReady: boolean
}

export function useOwnFavoriteIds(
  libraryId: string | undefined,
  options: { enabled: boolean } = { enabled: true },
): UseOwnFavoriteIdsResult {
  const { isMember, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set())
  const [notImportantIds, setNotImportantIds] = useState<Set<string>>(() => new Set())
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (isRoleLoading) return
    if (!options.enabled || !libraryId || !isMember) {
      setFavoriteIds((prev) => (prev.size === 0 ? prev : new Set()))
      setNotImportantIds((prev) => (prev.size === 0 ? prev : new Set()))
      setIsReady(false)
      return
    }
    if (allFavoritesFetched.has(libraryId)) {
      // Bereits geladen - State aus Cache rekonstruieren.
      const cache = getLibraryCache(libraryId)
      const fav = new Set<string>()
      const ni = new Set<string>()
      for (const [id, state] of cache.states) {
        if (state === 'favorite') fav.add(id)
        else if (state === 'not_important') ni.add(id)
      }
      setFavoriteIds(fav)
      setNotImportantIds(ni)
      setIsReady(true)
      return
    }
    if (allFavoritesInFlight.has(libraryId)) return

    const promise = (async () => {
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/source-user-states`,
          { cache: 'no-store' },
        )
        if (!res.ok) {
          throw new Error(`Eigene Sterne konnten nicht geladen werden (HTTP ${res.status})`)
        }
        const json = (await res.json()) as OwnUserStatesResponse
        const cache = getLibraryCache(libraryId)
        for (const id of json.favorites) {
          cache.states.set(id, 'favorite')
          cache.seen.add(id)
        }
        for (const id of json.notImportant) {
          cache.states.set(id, 'not_important')
          cache.seen.add(id)
        }
        allFavoritesFetched.add(libraryId)
        setFavoriteIds(new Set(json.favorites))
        setNotImportantIds(new Set(json.notImportant))
        setIsReady(true)
        notifySubscribers(cache)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
        console.warn('[useOwnFavoriteIds] Laden fehlgeschlagen:', message)
        setIsReady(true)
      } finally {
        allFavoritesInFlight.delete(libraryId)
      }
    })()
    allFavoritesInFlight.set(libraryId, promise)
  }, [libraryId, isMember, isRoleLoading, options.enabled])

  return useMemo(
    () => ({ favoriteIds, notImportantIds, isReady }),
    [favoriteIds, notImportantIds, isReady],
  )
}
