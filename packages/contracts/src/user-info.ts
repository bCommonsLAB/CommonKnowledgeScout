/**
 * @ks/contracts/user-info.ts
 *
 * Core-API-DTO fuer `GET /api/user-info` (Welle M2) — bildet die von der
 * Route (`src/app/api/user-info/route.ts`) zurueckgegebene Clerk-Teilmenge ab.
 */
export interface UserInfoEmailDto {
  id: string
  email: string
  isPrimary: boolean
}

export interface UserInfoDto {
  isSignedIn: boolean
  userId?: string
  email?: UserInfoEmailDto[]
  fullName?: string
  firstName?: string | null
  lastName?: string | null
  imageUrl?: string
  timestamp?: string
  message?: string
}
