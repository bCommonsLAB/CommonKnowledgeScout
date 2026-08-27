/**
 * @ks/api-client/libraries.ts
 *
 * Core-API-Client fuer `libraries*` (Modul-Landkarte §3) — bewusst nur die
 * Liste, typisiert gegen den minimalen `LibraryIdentityDto` (siehe dessen
 * Kommentar in `@ks/contracts` fuer die Begruendung). Schreibende Endpunkte
 * (POST/DELETE) und die volle Library-Config folgen, sobald ein konkretes
 * Modul sie ueber den Client braucht (G3).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { LibraryIdentityDto } from '@ks/contracts'
import { apiGet, type ApiClientConfig } from './http'

export function fetchLibraries(
  email: string,
  config?: ApiClientConfig,
): Promise<LibraryIdentityDto[]> {
  return apiGet<LibraryIdentityDto[]>(
    `/api/libraries?email=${encodeURIComponent(email)}`,
    config,
  )
}

export function useLibraries(
  email: string | undefined,
  config?: ApiClientConfig,
): UseQueryResult<LibraryIdentityDto[], Error> {
  return useQuery({
    queryKey: ['ks-api-client', 'libraries', email],
    queryFn: () => fetchLibraries(email as string, config),
    enabled: Boolean(email),
  })
}
