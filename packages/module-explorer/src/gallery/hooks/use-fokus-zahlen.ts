'use client'

import { useEffect, useState } from 'react'
import { useInstanz } from '../contexts/gallery-host-context'

export interface FokusZahlen {
  /** Eintraege mit mindestens einem Stern (`starred=1`); null solange nicht geladen. */
  fokus: number | null
  /** Alle Eintraege ohne Filter; null solange nicht geladen. */
  alle: number | null
  fehler: string | null
}

/**
 * Die zwei Zahlen des Umschalters „Im Fokus | Alle“ (G2): je ein Aufruf der
 * Docs-Route mit `limit=1`, es zaehlt nur `total`. Laeuft nur, wenn
 * `enabled` (geführtes Profil); Fehler werden genannt, nicht verschluckt.
 */
export function useFokusZahlen(
  libraryId: string | undefined,
  options: { enabled: boolean; excludeDetailViewType?: string; refreshKey?: number },
): FokusZahlen {
  const instanz = useInstanz()
  const { enabled, excludeDetailViewType, refreshKey = 0 } = options
  const [zahlen, setZahlen] = useState<FokusZahlen>({ fokus: null, alle: null, fehler: null })

  useEffect(() => {
    if (!enabled || !libraryId) return
    let cancelled = false
    const basis = new URLSearchParams({ limit: '1' })
    if (excludeDetailViewType) basis.set('excludeDetailViewType', excludeDetailViewType)
    const fokusParams = new URLSearchParams(basis)
    fokusParams.set('starred', '1')
    const url = (p: URLSearchParams) => `/api/chat/${encodeURIComponent(libraryId)}/docs?${p.toString()}`
    const total = async (p: URLSearchParams): Promise<number> => {
      const res = await instanz.fetch(url(p), { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `HTTP ${res.status}`)
      return typeof data?.total === 'number' ? data.total : 0
    }
    Promise.all([total(fokusParams), total(basis)])
      .then(([fokus, alle]) => { if (!cancelled) setZahlen({ fokus, alle, fehler: null }) })
      .catch((e: unknown) => {
        if (cancelled) return
        const meldung = e instanceof Error ? e.message : String(e)
        console.error(`[fokus-zahlen] Zahlen fuer den Umschalter nicht geladen: ${meldung}`)
        setZahlen({ fokus: null, alle: null, fehler: meldung })
      })
    return () => { cancelled = true }
  }, [enabled, libraryId, excludeDetailViewType, refreshKey, instanz])

  return zahlen
}
