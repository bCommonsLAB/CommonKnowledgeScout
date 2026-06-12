/**
 * In-Memory-Cache fuer Access-Check-Ergebnisse.
 *
 * Ausgelagert aus app/api/libraries/[id]/access-check/route.ts
 * (D4-Fix, 2026-06-12): Statusaenderungen und Loeschungen von
 * Zugriffsanfragen invalidieren den Cache jetzt aktiv — vorher konnte
 * ein entzogener Zugriff bis zu CACHE_TTL_MS weiterleben.
 *
 * Zweck des Caches: verhindert Clerk-Rate-Limits bei schnellen
 * aufeinanderfolgenden Access-Checks desselben Users.
 */

const accessCheckCache = new Map<string, { result: unknown; timestamp: number }>();
const CACHE_TTL_MS = 10000; // 10 Sekunden Cache

function getCacheKey(libraryId: string, userEmail: string): string {
  return `${libraryId}:${userEmail}`;
}

/** Gecachtes Ergebnis abrufen (oder null, wenn fehlend/abgelaufen). */
export function getCachedResult(libraryId: string, userEmail: string): unknown | null {
  const key = getCacheKey(libraryId, userEmail);
  const cached = accessCheckCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    accessCheckCache.delete(key);
    return null;
  }

  return cached.result;
}

/** Ergebnis cachen. */
export function setCachedResult(libraryId: string, userEmail: string, result: unknown): void {
  const key = getCacheKey(libraryId, userEmail);
  accessCheckCache.set(key, { result, timestamp: Date.now() });
}

/**
 * Cache-Eintrag gezielt verwerfen — aufzurufen, wenn sich der
 * Zugriffsstatus eines Users aendert (Genehmigen/Ablehnen/Loeschen).
 */
export function invalidateAccessCheckCache(libraryId: string, userEmail: string): void {
  accessCheckCache.delete(getCacheKey(libraryId, userEmail));
}
