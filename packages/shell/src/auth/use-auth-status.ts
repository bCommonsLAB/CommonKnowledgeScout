'use client'

/**
 * @ks/shell/auth/use-auth-status.ts
 *
 * Auth-Status-Abstraktion (M3-Folge): entkoppelt Auth-GATING (signed-in vs.
 * signed-out UI) von Clerks eigenen `<SignedIn>`/`<SignedOut>`-Komponenten,
 * die ohne `<ClerkProvider>`-Kontext werfen. Spiegelt exakt das bestehende
 * `useSafeAuth()`-Muster aus `src/contexts/storage-context.tsx` (try/catch
 * um `useAuth()`), damit Komponenten wie `TopNav` denselben Zustand ueber
 * einen Hook statt ueber Clerk-spezifische JSX-Wrapper abfragen koennen —
 * Voraussetzung fuer `SiteConfig.auth.mode: 'public'` (Landkarte §2), ohne
 * dass eine Site zwingend Clerk mitbringen muss.
 *
 * Reine State-Abfrage: `UserButton`/`SignInButton` (echte Clerk-Widgets,
 * kein Gating) bleiben direkte Clerk-Importe an ihren Aufrufstellen — die
 * setzen ohnehin einen vorhandenen ClerkProvider voraus, genau wie heute.
 */
import { useAuth } from '@clerk/nextjs'

export interface AuthStatus {
  isLoaded: boolean
  isSignedIn: boolean
}

export function useAuthStatus(): AuthStatus {
  try {
    const { isLoaded, isSignedIn } = useAuth()
    return { isLoaded, isSignedIn: isSignedIn ?? false }
  } catch {
    return { isLoaded: true, isSignedIn: false }
  }
}
