'use client'

/**
 * @fileoverview React-Query-Provider fuer geteilten Server-State.
 *
 * @description
 * Stellt einen prozess-stabilen QueryClient bereit, damit gleiche Server-Abrufe
 * (z.B. die Shadow-Twin-Artefakte einer Quelle) ueber mehrere Komponenten hinweg
 * EINMAL laufen und denselben Cache teilen — statt dass jede Komponente unabhaengig
 * dasselbe holt (siehe Re-Trace R2: Datei-Oeffnen lud denselben Shadow-Twin 3x).
 *
 * Konservative Defaults: kein automatisches Refetch bei Fenster-Fokus; Aktualitaet
 * wird gezielt ueber invalidateQueries gesteuert (z.B. nach Job-Ende).
 */

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState-Initializer: EIN Client pro Browser-Tab, stabil ueber Re-Renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Innerhalb dieses Fensters gilt ein Ergebnis als frisch: parallele/kurz
            // aufeinanderfolgende Abrufe derselben queryKey teilen sich den Cache.
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
