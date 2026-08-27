/**
 * @ks/api-client/user.ts
 *
 * Core-API-Client fuer `user*` (Modul-Landkarte §3) — bisher nur die lesende
 * Identitaets-Route; weitere `user/*`-Endpunkte (z.B. `accept-pending-invites`)
 * folgen bedarfsgetrieben (G3), sobald ein Modul sie ueber den Client braucht.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { UserInfoDto } from '@ks/contracts'
import { apiGet, type ApiClientConfig } from './http'

export function fetchUserInfo(config?: ApiClientConfig): Promise<UserInfoDto> {
  return apiGet<UserInfoDto>('/api/user-info', config)
}

export function useUserInfo(config?: ApiClientConfig): UseQueryResult<UserInfoDto, Error> {
  return useQuery({
    queryKey: ['ks-api-client', 'user-info'],
    queryFn: () => fetchUserInfo(config),
  })
}
