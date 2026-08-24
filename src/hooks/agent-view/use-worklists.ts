'use client'

/**
 * @fileoverview Client-Hook fuer die Arbeitslisten-Routen (F7, Welle W6).
 *
 * @description
 * Buch 3 „persoenlich": Listen des Users je Library, Server-State via
 * TanStack Query (Projektregel §7). Mutationen invalidieren die Liste;
 * Fehler erreichen den Aufrufer mit der Server-Begruendung (409
 * `name_vergeben` inklusive) — kein stilles Schlucken. Die UI kennt nur
 * diese API, keinen Provider und kein Mongo.
 *
 * @module hooks/agent-view
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { WorklistDoc, WorklistFolderEntry } from '@/lib/repositories/agent-view-worklists-repo'

export type Worklist = Pick<WorklistDoc, 'listId' | 'name' | 'position' | 'folders'>

async function lesen<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Worklist-Route antwortete ${response.status}`)
  }
  return (await response.json()) as T
}

function basisUrl(libraryId: string): string {
  return `/api/library/${encodeURIComponent(libraryId)}/agent-view/worklists`
}

export function useWorklists(libraryId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['agent-view-worklists', libraryId]
  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const query = useQuery({
    queryKey,
    queryFn: async () => (await lesen<{ lists: Worklist[] }>(await fetch(basisUrl(libraryId)))).lists,
    staleTime: 30_000,
  })

  const anlegen = useMutation({
    mutationFn: async (args: { name: string; folders?: Omit<WorklistFolderEntry, 'addedAt'>[] }) =>
      lesen<{ list: Worklist }>(
        await fetch(basisUrl(libraryId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args),
        }),
      ),
    onSuccess: invalidate,
  })

  const patch = useMutation({
    mutationFn: async (args: {
      listId: string
      body:
        | { name: string }
        | { add: Omit<WorklistFolderEntry, 'addedAt'> }
        | { remove: string }
    }) =>
      lesen<{ list: Worklist; unchanged?: boolean }>(
        await fetch(`${basisUrl(libraryId)}/${encodeURIComponent(args.listId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args.body),
        }),
      ),
    onSuccess: invalidate,
  })

  const loeschen = useMutation({
    mutationFn: async (listId: string) =>
      lesen<{ deleted: true }>(
        await fetch(`${basisUrl(libraryId)}/${encodeURIComponent(listId)}`, { method: 'DELETE' }),
      ),
    onSuccess: invalidate,
  })

  return { query, anlegen, patch, loeschen }
}
