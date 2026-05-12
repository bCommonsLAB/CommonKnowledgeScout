'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLibraryRole } from './use-library-role'
import type { MemberDisplayNamesResponse } from '@/types/source-user-state'

export interface UseMemberDisplayNamesResult {
  /**
   * Loest fehlende E-Mails on-demand auf. Erste Resolve-Aufrufe bei
   * mehreren Tooltips innerhalb desselben Render-Frames werden zu
   * einem einzigen Bulk-Request gebuendelt.
   *
   * Returnt ein Promise, das aufgeloest wird, sobald die
   * Display-Names im Cache stehen.
   */
  resolveNames: (emails: string[]) => Promise<void>
  /** Liefert den gecachten Namen oder undefined. */
  getCachedName: (email: string) => string | undefined
  /**
   * Reaktive Map (Trigger fuer Re-Render). Tooltip-Komponenten lesen
   * Namen ueber `getCachedName`, koennen aber `names` zur Verschoenerung
   * in eine Memo packen.
   */
  names: Record<string, string>
  /** true solange der erste Bulk-Request laeuft. */
  isLoading: boolean
}

/**
 * Lazy Display-Name-Resolver fuer Library-Member.
 *
 * Modul-globaler Cache pro `libraryId`: Karten, Tabelle und
 * Detail-Overlay teilen sich den gleichen Cache, sodass derselbe User
 * nicht mehrfach aufgeloest wird.
 *
 * Bundle-Verhalten: Aufrufe innerhalb desselben Microtask-Ticks werden
 * zu einem einzigen Bulk-Request gebuendelt.
 *
 * Member-only Hook: Gaeste/Anonyme bekommen No-op + leere Map.
 */

interface LibraryNameCache {
  names: Record<string, string>
  seen: Set<string>
  pending: Set<string>
  pendingPromise: Promise<void> | null
  pendingResolve: (() => void) | null
  subscribers: Set<() => void>
}

const moduleNameCache = new Map<string, LibraryNameCache>()

function getNameCache(libraryId: string): LibraryNameCache {
  let cache = moduleNameCache.get(libraryId)
  if (!cache) {
    cache = {
      names: {},
      seen: new Set(),
      pending: new Set(),
      pendingPromise: null,
      pendingResolve: null,
      subscribers: new Set(),
    }
    moduleNameCache.set(libraryId, cache)
  }
  return cache
}

function notifyNameSubscribers(cache: LibraryNameCache): void {
  for (const sub of cache.subscribers) sub()
}

async function flushNamePending(libraryId: string): Promise<void> {
  const cache = getNameCache(libraryId)
  const emails = Array.from(cache.pending)
  const resolve = cache.pendingResolve
  cache.pending = new Set()
  cache.pendingPromise = null
  cache.pendingResolve = null
  if (emails.length === 0) {
    resolve?.()
    return
  }
  for (const e of emails) cache.seen.add(e)

  try {
    const url = `/api/library/${encodeURIComponent(libraryId)}/members/display-names?emails=${encodeURIComponent(emails.join(','))}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      throw new Error(`Display-Names konnten nicht geladen werden (HTTP ${res.status})`)
    }
    const json = (await res.json()) as MemberDisplayNamesResponse
    cache.names = { ...cache.names, ...json.names }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler'
    console.warn('[useMemberDisplayNames] Laden fehlgeschlagen:', message)
    const fallback: Record<string, string> = {}
    for (const e of emails) fallback[e] = e
    cache.names = { ...cache.names, ...fallback }
  } finally {
    notifyNameSubscribers(cache)
    resolve?.()
  }
}

export function useMemberDisplayNames(
  libraryId: string | undefined,
): UseMemberDisplayNamesResult {
  const { isMember } = useLibraryRole(libraryId)
  const [names, setNames] = useState<Record<string, string>>(() =>
    libraryId ? { ...getNameCache(libraryId).names } : {},
  )
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!libraryId) return
    const cache = getNameCache(libraryId)
    const equalsCachedNames = (prev: Record<string, string>): boolean => {
      const prevKeys = Object.keys(prev)
      const cacheKeys = Object.keys(cache.names)
      if (prevKeys.length !== cacheKeys.length) return false
      for (const k of prevKeys) {
        if (cache.names[k] !== prev[k]) return false
      }
      return true
    }
    const sub = () => {
      setNames((prev) => (equalsCachedNames(prev) ? prev : { ...cache.names }))
      setIsLoading(cache.pendingPromise !== null)
    }
    cache.subscribers.add(sub)
    setNames((prev) => (equalsCachedNames(prev) ? prev : { ...cache.names }))
    return () => {
      cache.subscribers.delete(sub)
    }
  }, [libraryId])

  const resolveNames = useCallback(
    async (emails: string[]) => {
      if (!libraryId || !isMember) return
      const cache = getNameCache(libraryId)
      const missing = emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && !cache.seen.has(e) && !cache.pending.has(e))
      if (missing.length === 0) return
      for (const e of missing) cache.pending.add(e)

      if (!cache.pendingPromise) {
        cache.pendingPromise = new Promise<void>((resolve) => {
          cache.pendingResolve = resolve
        })
        setIsLoading(true)
        queueMicrotask(() => {
          void flushNamePending(libraryId)
        })
      }
      return cache.pendingPromise
    },
    [libraryId, isMember],
  )

  const getCachedName = useCallback(
    (email: string) => {
      if (!libraryId) return undefined
      const cache = getNameCache(libraryId)
      const key = email.trim().toLowerCase()
      return cache.names[key]
    },
    [libraryId],
  )

  return { resolveNames, getCachedName, names, isLoading }
}
