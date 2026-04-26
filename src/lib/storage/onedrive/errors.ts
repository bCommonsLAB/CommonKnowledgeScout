/**
 * @fileoverview OneDrive Error- & URL-Helper
 *
 * Pure (state-less) Helper-Funktionen, die in Welle 1 / Schritt 4 aus
 * `src/lib/storage/onedrive-provider.ts` extrahiert wurden. Die Logik ist
 * unveraendert; nur der Code-Ort wird kanonisch.
 *
 * @module storage/onedrive
 */

/**
 * Extrahiert einen Endpoint-Pfad aus einer Microsoft-Graph-URL fuer
 * Telemetrie-Logging. Bei Parser-Fehler wird der erste 100-Zeichen-Prefix
 * der Original-URL zurueckgegeben (Fallback fuer ungueltige URLs).
 *
 * Beispiele:
 *   `https://graph.microsoft.com/v1.0/me/drive/items/abc/children`
 *     -> `me/drive/items/abc/children`
 *   `not-a-url` -> `not-a-url` (Fallback, max. 100 Zeichen)
 */
export function extractGraphEndpoint(url: string): string {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/(v1\.0|beta)\/(.+)$/);
    return match ? match[2] : urlObj.pathname;
  } catch {
    // Ungueltige URL: Fallback auf ersten 100-Zeichen-Prefix der Original-URL.
    return url.substring(0, 100);
  }
}

/**
 * Liest einen Retry-After-Wert aus einem HTTP-Header.
 *
 * Microsoft Graph liefert `Retry-After` entweder als Sekunden-Zahl
 * (z.B. `"60"`) oder als HTTP-Date (z.B. `"Wed, 21 Oct 2026 07:28:00 GMT"`).
 * Diese Funktion vereinheitlicht das auf Sekunden.
 *
 * @returns Sekunden bis Retry oder `null`, wenn der Header weder eine Zahl
 *          noch ein parsbares Datum ist.
 */
export function parseRetryAfter(headerValue: string | null | undefined): number | null {
  if (!headerValue) return null;
  const asNumber = parseInt(headerValue, 10);
  if (!isNaN(asNumber)) return asNumber;
  const asDate = new Date(headerValue);
  if (!isNaN(asDate.getTime())) {
    return Math.max(1, Math.ceil((asDate.getTime() - Date.now()) / 1000));
  }
  return null;
}
