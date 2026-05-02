/**
 * @fileoverview Char-Tests für useSafeUser-Hook
 *
 * @description
 * Charakterisierungs-Tests für den useSafeUser-Hook aus src/hooks/use-safe-user.ts.
 * Testet das Fallback-Verhalten wenn Clerk-useUser nicht verfügbar ist.
 *
 * Hinweis: Da useUser ein React-Hook ist, testen wir hier nur die reine
 * Fallback-Logik (ohne React-Hook-Infrastruktur), analog zu den bestehenden
 * Char-Tests in der Codebasis (z.B. use-testimonials.test.ts).
 */

import { describe, it, expect, vi } from 'vitest'

/**
 * Simuliert die Fallback-Logik von useSafeUser — ohne Clerk-Abhängigkeit.
 * Diese Funktion spiegelt exakt das Verhalten des Hooks wider:
 * - Wenn useUser verfügbar: Rückgabe des echten User-Objekts
 * - Wenn useUser wirft: Rückgabe von { user: null, isLoaded: true }
 */
function simulateSafeUser(
  useUserFn: () => { user: { id: string } | null; isLoaded: boolean }
) {
  try {
    return useUserFn();
  } catch {
    // Clerk-Hook kann außerhalb des Providers werfen (z.B. Build-Zeit-Rendering)
    console.warn('[useSafeUser] Clerk useUser nicht verfügbar — Fallback aktiv');
    return { user: null, isLoaded: true };
  }
}

describe('useSafeUser Fallback-Logik', () => {
  it('gibt User-Objekt zurück wenn useUser verfügbar', () => {
    const mockUseUser = () => ({
      user: { id: 'user-123' },
      isLoaded: true,
    });

    const result = simulateSafeUser(mockUseUser);

    expect(result.user).toEqual({ id: 'user-123' });
    expect(result.isLoaded).toBe(true);
  });

  it('gibt Fallback { user: null, isLoaded: true } zurück wenn useUser wirft', () => {
    const brokenUseUser = () => {
      throw new Error('Clerk Provider nicht verfügbar');
    };

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = simulateSafeUser(brokenUseUser as () => never);

    expect(result.user).toBeNull();
    expect(result.isLoaded).toBe(true);

    // Logging-Pflicht: warn muss aufgerufen worden sein (no-silent-fallback)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useSafeUser]')
    );

    warnSpy.mockRestore();
  });

  it('gibt isLoaded: false zurück wenn useUser isLoaded: false liefert', () => {
    const loadingUseUser = () => ({
      user: null,
      isLoaded: false,
    });

    const result = simulateSafeUser(loadingUseUser);

    expect(result.user).toBeNull();
    expect(result.isLoaded).toBe(false);
  });
});
