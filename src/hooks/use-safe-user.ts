/**
 * @fileoverview Build-Zeit-sicherer Wrapper für Clerk's useUser-Hook.
 *
 * @description
 * Kapselt den useUser-Hook von Clerk und fängt Fehler ab, die auftreten
 * wenn der Clerk-Provider nicht verfügbar ist (z.B. Build-Zeit-Rendering,
 * Server-Side-Rendering ohne Clerk-Kontext).
 *
 * Extrahiert aus library-form.tsx und public-form.tsx (H1 + D1 aus dem
 * Altlast-Pass der Welle 3-IV). Löst das DRY-Problem: beide Formulare
 * hatten identische Inline-Kopien dieser Funktion.
 *
 * @example
 * ```tsx
 * import { useSafeUser } from "@/hooks/use-safe-user";
 *
 * function MyForm() {
 *   const { user, isLoaded } = useSafeUser();
 *   if (!isLoaded) return null;
 *   return <div>{user?.emailAddresses[0]?.emailAddress}</div>;
 * }
 * ```
 */

import { useUser } from "@clerk/nextjs";

/**
 * Build-Zeit-sicherer Wrapper für useUser.
 *
 * Gibt { user: null, isLoaded: true } zurück, wenn der Clerk-Provider
 * nicht verfügbar ist (z.B. bei Build-Zeit-Rendering oder SSR ohne
 * Clerk-Kontext). In diesem Fall wird ein console.warn ausgelöst, um
 * das Fallback-Verhalten sichtbar zu machen (no-silent-fallbacks-Rule).
 */
export function useSafeUser() {
  try {
    return useUser();
  } catch {
    // Clerk-Hook kann außerhalb des Providers werfen (z.B. Build-Zeit-Rendering)
    // Explizites Logging gemäß no-silent-fallbacks.mdc — kein stilles Fallback
    console.warn('[useSafeUser] Clerk useUser nicht verfügbar — Fallback aktiv');
    return { user: null, isLoaded: true };
  }
}
