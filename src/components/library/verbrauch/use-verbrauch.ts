'use client'

/**
 * Daten der Verbrauchsseite: die Library zum Slug (oeffentliche Angaben) und
 * der Verbrauch eines Monats, gesamt oder fuer die eigene Sitzung.
 */

import { useQuery } from '@tanstack/react-query'
import { useUser } from '@clerk/nextjs'
import { SAME_ORIGIN_API, useSessionHeaders } from '@ks/api-client'
import type { VerbrauchAuswertung } from '@/lib/verbrauch/rechnen'

export type VerbrauchSicht = 'all' | 'session'

export interface VerbrauchAntwort extends VerbrauchAuswertung {
  month: string
  scope: VerbrauchSicht
  kostenVerfuegbar: boolean
  whPro1000Tokens: number
  abgeschnitten: boolean
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: unknown }
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`)
  return body
}

export function useVerbrauch(slug: string, monat: string, sicht: VerbrauchSicht) {
  const { isLoaded, isSignedIn } = useUser()
  const sessionHeaders = useSessionHeaders(isSignedIn === true)

  const library = useQuery({
    queryKey: ['verbrauch', 'library', slug],
    queryFn: async () => (await json<{ library: { id: string; label: string } }>(await SAME_ORIGIN_API.fetch(`/api/public/libraries/${encodeURIComponent(slug)}`, { cache: 'no-store' }))).library,
    enabled: slug !== '',
  })
  const libraryId = library.data?.id

  const verbrauch = useQuery({
    queryKey: ['verbrauch', libraryId, monat, sicht, isSignedIn === true],
    queryFn: async () =>
      json<VerbrauchAntwort>(
        await SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId ?? '')}/verbrauch?month=${monat}&scope=${sicht}`, { cache: 'no-store', headers: sessionHeaders }),
      ),
    enabled: isLoaded && libraryId !== undefined,
  })

  return { library, verbrauch }
}
