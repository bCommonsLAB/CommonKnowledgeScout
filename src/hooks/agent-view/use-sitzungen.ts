'use client'

/**
 * @fileoverview Client-Hook fuer die Routen des Reiters „Sitzungen" (Register, Welle R3).
 *
 * @description
 * Server-State via TanStack Query: GET liefert alle Register-Zeilen samt
 * Bilanz, PATCH pflegt eine Zeile (Felder von `sitzung_setzen`) und laedt
 * danach neu — der Stand wird auf dem Server gerechnet, der Client rechnet
 * ihn nicht nach. Fehler erreichen den Aufrufer mit der Server-Begruendung.
 * Die UI kennt nur diese API, keinen Provider und kein Mongo.
 *
 * @module hooks/agent-view
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SitzungSetzenAntwort, SitzungenAntwort } from '@/lib/agent-view/sitzungen-register/reiter-antwort'
import type { SetzEingabe } from '@/lib/agent-view/sitzungen-register/schreib-plaene'

async function lesen<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Sitzungs-Route antwortete ${response.status}`)
  }
  return (await response.json()) as T
}

function basisUrl(libraryId: string): string {
  return `/api/library/${encodeURIComponent(libraryId)}/agent-view/sitzungen`
}

export function useSitzungen(libraryId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['agent-view-sitzungen', libraryId]

  const query = useQuery({
    queryKey,
    queryFn: async () => lesen<SitzungenAntwort>(await fetch(basisUrl(libraryId))),
    staleTime: 30_000,
  })

  const setzen = useMutation({
    mutationFn: async (args: { registerId: string; eingabe: SetzEingabe }) =>
      lesen<SitzungSetzenAntwort>(
        await fetch(`${basisUrl(libraryId)}/${encodeURIComponent(args.registerId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args.eingabe),
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return {
    daten: query.data ?? null,
    isLoading: query.isLoading,
    fehler: query.error instanceof Error ? query.error.message : null,
    neuLaden: () => void query.refetch(),
    setzen: setzen.mutateAsync,
    speichert: setzen.isPending,
  }
}
