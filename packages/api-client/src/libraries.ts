/**
 * @ks/api-client/libraries.ts
 *
 * Core-API-Client fuer `libraries*` (Modul-Landkarte §3) — bewusst nur die
 * Liste. Sie ist gegen den vollen Steckbrief `ClientLibrary` typisiert, weil
 * `GET /api/libraries` genau den liefert; der minimale `LibraryIdentityDto`
 * aus Welle M2 war eine Handkopie davon und ist mit M4d abgeloest.
 * Schreibende Endpunkte (POST/DELETE) folgen, sobald ein konkretes Modul sie
 * ueber den Client braucht (G3).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ClientLibrary } from '@ks/contracts'
import { apiGet, type ApiClientConfig } from './http'

export function fetchLibraries(
  email: string,
  config?: ApiClientConfig,
): Promise<ClientLibrary[]> {
  return apiGet<ClientLibrary[]>(
    `/api/libraries?email=${encodeURIComponent(email)}`,
    config,
  )
}

export function useLibraries(
  email: string | undefined,
  config?: ApiClientConfig,
): UseQueryResult<ClientLibrary[], Error> {
  return useQuery({
    queryKey: ['ks-api-client', 'libraries', email],
    queryFn: () => fetchLibraries(email as string, config),
    enabled: Boolean(email),
  })
}
