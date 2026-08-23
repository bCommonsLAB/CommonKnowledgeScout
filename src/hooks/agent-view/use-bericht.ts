'use client'

/**
 * @fileoverview Client-Hook fuer die Bericht-Lese-Route (F9, Werkbank W4).
 *
 * @description
 * Laedt den BERICHT.md eines Vorhabens lazy ueber die W2-Route — der Body
 * wird nie persistiert, `kopf` kommt serverseitig. Server-State via TanStack
 * Query (Projektregel §7); die UI kennt AUSSCHLIESSLICH diese API, keinen
 * Provider (`storage-abstraction.mdc`). Ein non-OK-Status ist ein Fehler mit
 * Server-Begruendung — `kein_bericht`/`zu_gross` sind dagegen legitime
 * 200-Domaenenzustaende und erreichen den Aufrufer als Daten.
 *
 * @module hooks/agent-view
 */

import { useQuery } from '@tanstack/react-query'
import type { BerichtAntwort } from '@/lib/agent-view/bericht-laden'

async function fetchBericht(libraryId: string, folderId: string): Promise<BerichtAntwort> {
  const response = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/agent-view/bericht?folderId=${encodeURIComponent(folderId)}`,
  )
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Bericht-Route antwortete ${response.status}`)
  }
  return (await response.json()) as BerichtAntwort
}

/** Laedt den Bericht des gewaehlten Vorhabens; `folderId: null` laedt nichts. */
export function useBericht(libraryId: string, folderId: string | null) {
  return useQuery({
    queryKey: ['agent-view-bericht', libraryId, folderId],
    queryFn: () => fetchBericht(libraryId, folderId as string),
    enabled: folderId !== null,
    staleTime: 30_000,
    retry: 1,
  })
}
