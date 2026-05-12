'use client'

import { useEffect, useRef, useState } from 'react'
import { useLibraryRole } from './use-library-role'
import type { AggregatedFavoritesResponse } from '@/types/source-user-state'

/**
 * Flacher Vergleich von Records mit primitiven Werten / String-Arrays.
 * Verhindert unnoetige State-Updates, die sonst zu Render-Loops fuehren,
 * wenn der Hook von vielen Karten gleichzeitig genutzt wird.
 */
function shallowRecordEqual<T>(a: Record<string, T>, b: Record<string, T>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false
    const va = a[k]
    const vb = b[k]
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false
      for (let i = 0; i < va.length; i++) {
        if (va[i] !== vb[i]) return false
      }
    } else if (va !== vb) {
      return false
    }
  }
  return true
}

export interface UseAggregatedFavoritesResult {
  /** Anzahl der Sterne pro fileId (0 wenn unbekannt; fehlende Keys = 0). */
  counts: Record<string, number>
  /** Voter-E-Mails pro fileId (sortiert; leer wenn unbekannt). */
  voters: Record<string, string[]>
  isLoading: boolean
  /** true sobald mindestens ein Bulk-Fetch erfolgreich war. */
  isReady: boolean
}

/**
 * Bulk-Aggregator fuer Sterne-Counts + Voter-Mail-Listen pro Quelle.
 *
 * - Member-only (Endpoint liefert sonst 403). Gaeste/Anonyme erhalten
 *   leere Maps und es wird kein Request abgesetzt.
 * - Geteilter Modul-Cache pro `libraryId`: Tabelle, Galerie-Karten und
 *   Detail-Overlay reden mit demselben Cache, sodass die Karten-Badges
 *   keinen zusaetzlichen Round-Trip ausloesen.
 * - Pending-Requests werden in einem 200-ms-Fenster gebatched (alle
 *   Hook-Instanzen, die in diesem Fenster fileIds anmelden, landen in
 *   einem einzigen `?fileIds=...`-GET).
 *
 * Hinweis: `invalidate(fileId)` wirft den Eintrag aus dem Cache, sodass
 * der naechste Render ihn neu laedt.
 */

interface LibraryCache {
  counts: Record<string, number>
  voters: Record<string, string[]>
  seen: Set<string>
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
      counts: {},
      voters: {},
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
  // Markiere als "gesehen", damit parallele Mounts keine doppelten
  // Anfragen erzeugen, waehrend dieser Request laeuft.
  for (const id of ids) cache.seen.add(id)

  const url = `/api/library/${encodeURIComponent(libraryId)}/source-favorites/aggregated?fileIds=${encodeURIComponent(ids.join(','))}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Aggregierte Sterne konnten nicht geladen werden (HTTP ${res.status})`)
    }
    const json = (await res.json()) as AggregatedFavoritesResponse
    cache.counts = { ...cache.counts, ...json.counts }
    cache.voters = { ...cache.voters, ...json.voters }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.warn('[useAggregatedFavorites] Laden fehlgeschlagen:', message)
    // Bei Fehler "seen" wieder zuruecksetzen, sonst bleiben die IDs
    // permanent uneingeloest.
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

function enqueueFileIds(libraryId: string, fileIds: string[]): boolean {
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

export function useAggregatedFavorites(
  libraryId: string | undefined,
  visibleFileIds: string[],
): UseAggregatedFavoritesResult & { invalidate: (fileId: string) => void } {
  const { isMember, isLoading: isRoleLoading } = useLibraryRole(libraryId)
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    libraryId ? { ...getLibraryCache(libraryId).counts } : {},
  )
  const [voters, setVoters] = useState<Record<string, string[]>>(() =>
    libraryId ? { ...getLibraryCache(libraryId).voters } : {},
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const lastLibraryRef = useRef<string | undefined>(libraryId)

  // Bei Library-Wechsel den lokalen State zuruecksetzen (Cache bleibt
  // pro Library im Modul erhalten).
  useEffect(() => {
    if (lastLibraryRef.current !== libraryId) {
      lastLibraryRef.current = libraryId
      if (libraryId) {
        const cache = getLibraryCache(libraryId)
        setCounts((prev) => (shallowRecordEqual(prev, cache.counts) ? prev : { ...cache.counts }))
        setVoters((prev) => (shallowRecordEqual(prev, cache.voters) ? prev : { ...cache.voters }))
      } else {
        setCounts((prev) => (Object.keys(prev).length === 0 ? prev : {}))
        setVoters((prev) => (Object.keys(prev).length === 0 ? prev : {}))
      }
      setIsReady(false)
    }
  }, [libraryId])

  // Subscriber registrieren, damit alle Hook-Instanzen aktualisiert
  // werden, sobald ein Batch zurueckkommt.
  useEffect(() => {
    if (!libraryId) return
    const cache = getLibraryCache(libraryId)
    const sub = () => {
      setCounts((prev) => (shallowRecordEqual(prev, cache.counts) ? prev : { ...cache.counts }))
      setVoters((prev) => (shallowRecordEqual(prev, cache.voters) ? prev : { ...cache.voters }))
      setIsReady(true)
      setIsLoading(cache.inFlight !== null || cache.pending.size > 0)
    }
    cache.subscribers.add(sub)
    return () => {
      cache.subscribers.delete(sub)
    }
  }, [libraryId])

  // Sichtbare IDs anmelden, sobald sie sich aendern.
  useEffect(() => {
    if (isRoleLoading) return
    if (!libraryId || !isMember || visibleFileIds.length === 0) return
    const queued = enqueueFileIds(libraryId, visibleFileIds)
    const cache = getLibraryCache(libraryId)
    if (queued) setIsLoading(true)
    // Falls alles schon im Cache ist, sofort synchronisieren - aber nur,
    // wenn sich tatsaechlich was geandert hat (Equality-Check verhindert
    // Render-Loops).
    setCounts((prev) => (shallowRecordEqual(prev, cache.counts) ? prev : { ...cache.counts }))
    setVoters((prev) => (shallowRecordEqual(prev, cache.voters) ? prev : { ...cache.voters }))
  }, [libraryId, isMember, isRoleLoading, visibleFileIds])

  const invalidate = (fileId: string) => {
    if (!libraryId || !fileId) return
    const cache = getLibraryCache(libraryId)
    delete cache.counts[fileId]
    delete cache.voters[fileId]
    cache.seen.delete(fileId)
    notifySubscribers(cache)
    // Direkt neu anmelden, damit der Counter den eigenen Toggle reflektiert.
    enqueueFileIds(libraryId, [fileId])
  }

  return { counts, voters, isLoading, isReady, invalidate }
}
