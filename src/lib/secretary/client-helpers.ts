/**
 * @fileoverview Hilfs-Helper fuer src/lib/secretary/client.ts
 *
 * Extrahiert in Welle 2.1 (siehe `docs/refactor/secretary/04-altlast-pass.md`)
 * aus `client.ts` (vorher 1.222 Zeilen). Ziel: Helper-Module mit
 * klar abgrenzbaren Verantwortungen, damit `client.ts` ueber den
 * 800-Zeilen-Schwellenwert kommt und der Token-Refresh-Pfad
 * isoliert getestet werden kann.
 *
 * @module secretary/client-helpers
 */

/**
 * Persistierte OneDrive-Tokens, wie sie im Browser-`localStorage`
 * unter dem Schluessel `onedrive_tokens_<libraryId>` liegen.
 */
export interface OneDriveTokens {
  accessToken: string;
  refreshToken: string;
  /** Absoluter Ablauf-Zeitpunkt in Millisekunden (epoch). */
  expiry: number;
}

/**
 * Liest OneDrive-Tokens aus dem `localStorage` einer bestimmten
 * Bibliothek.
 *
 * Server-Code-Pfade (window === undefined) liefern null zurueck —
 * **kein** silent fallback, weil das Fehlen von `window` bewusst
 * dokumentiert ist (siehe secretary-contracts.mdc §6).
 *
 * @returns Token-Objekt oder null wenn kein Eintrag existiert oder
 *   wir nicht im Browser sind.
 */
export function readOneDriveTokensFromStorage(
  libraryId: string,
): OneDriveTokens | null {
  if (typeof window === 'undefined') return null;
  const key = `onedrive_tokens_${libraryId}`;
  const json = window.localStorage.getItem(key);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as OneDriveTokens;
    return parsed;
  } catch (parseErr) {
    // Bewusster Fehler-Pfad: localStorage ist beschaedigt. Wir geben
    // null zurueck und loggen den Fehler explizit, damit der Aufrufer
    // mit "kein Token-Sync moeglich" weiterarbeiten kann. Das ist
    // KEIN silent fallback, sondern Resilienz gegen User-Modifikation
    // des localStorage. (secretary-contracts.mdc §2)
    console.warn('[secretary/client-helpers] localStorage-Token kaputt:', parseErr);
    return null;
  }
}

/**
 * Schreibt aktualisierte OneDrive-Tokens in den `localStorage`.
 * Server-Code-Pfade sind no-op.
 */
export function writeOneDriveTokensToStorage(
  libraryId: string,
  tokens: OneDriveTokens,
): void {
  if (typeof window === 'undefined') return;
  const key = `onedrive_tokens_${libraryId}`;
  window.localStorage.setItem(key, JSON.stringify(tokens));
}

/**
 * Prueft ob ein Token-Refresh noetig ist (abgelaufen oder bald
 * abgelaufen). Pure Funktion, deterministisch.
 *
 * @param expiryMs Ablauf-Zeitpunkt in ms (epoch). 0 oder NaN gilt als
 *   "abgelaufen" → Refresh.
 * @param nowMs Aktueller Zeitpunkt in ms (epoch).
 * @param bufferMs Sicherheits-Puffer; Default 2 Minuten.
 */
export function shouldRefreshOneDriveToken(
  expiryMs: number,
  nowMs: number,
  bufferMs = 120_000,
): boolean {
  if (!expiryMs || Number.isNaN(expiryMs)) return true;
  return expiryMs - nowMs <= bufferMs;
}

/**
 * Synchronisiert OneDrive-Tokens vom localStorage in die DB
 * (Server-Side), damit Webhook/Server-Gates Zugriff haben.
 *
 * **Best-effort**: Fehler werden geloggt, aber NICHT geworfen. Der
 * eigentliche PDF-Transform soll auch dann starten koennen, wenn
 * der Token-Sync fehlschlaegt — das ist die explizite Vertrags-Default-
 * Semantik aus secretary-contracts.mdc §4.
 *
 * Refactoring der frueheren leer-gefangenen Stelle in `client.ts:731` —
 * jetzt mit explizitem Logging und Kommentar (vgl. AGENT-BRIEF E5).
 */
export async function syncOneDriveTokensToServer(
  libraryId: string,
): Promise<void> {
  try {
    const tokens = readOneDriveTokensFromStorage(libraryId);
    if (!tokens) return;
    const now = Date.now();
    let { accessToken, refreshToken } = tokens;
    let expiryMs = Number(tokens.expiry);

    if (shouldRefreshOneDriveToken(expiryMs, now)) {
      const refreshResp = await fetch('/api/auth/onedrive/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId, refreshToken }),
      });
      if (refreshResp.ok) {
        const data = (await refreshResp.json()) as {
          accessToken: string;
          refreshToken?: string;
          expiresIn?: number;
        };
        accessToken = data.accessToken;
        refreshToken = data.refreshToken || refreshToken;
        // Secretary-Service liefert expiresIn in Sekunden
        expiryMs = now + Number(data.expiresIn || 0) * 1000;
        writeOneDriveTokensToStorage(libraryId, {
          accessToken,
          refreshToken,
          expiry: expiryMs,
        });
      } else {
        // Refresh fehlgeschlagen: nicht werfen, weil der Aufrufer
        // (transformPdf) auch ohne Refresh weiterlaufen darf.
        // Server-Gates greifen dann mit dem alten Token oder werfen
        // selbst. Logging ist Pflicht (no-silent-fallbacks.mdc).
        console.warn(
          '[secretary/client-helpers] OneDrive-Refresh fehlgeschlagen:',
          refreshResp.status,
          refreshResp.statusText,
        );
        return;
      }
    }

    // Persistiere Tokens in DB (Server), damit Webhook/Server-Gates
    // Zugriff haben. Fehler hier sind nicht kritisch, weil der
    // localStorage bereits gefuellt ist.
    const persistResp = await fetch(`/api/libraries/${libraryId}/tokens`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        refreshToken,
        tokenExpiry: Math.floor(expiryMs / 1000).toString(),
      }),
    });
    if (!persistResp.ok) {
      console.warn(
        '[secretary/client-helpers] OneDrive-Token-Persist fehlgeschlagen:',
        persistResp.status,
        persistResp.statusText,
      );
    }
  } catch (err) {
    // Best-effort: Fehler beim Token-Sync sind nicht kritisch fuer
    // den eigentlichen Transform. Wir loggen und werfen NICHT, damit
    // der Pipeline-Job auch dann startet, wenn z.B. das DB-Backend
    // gerade nicht erreichbar ist. Begruendung in der Funktions-
    // Beschreibung oben.
    console.warn(
      '[secretary/client-helpers] Token-Sync unerwartet fehlgeschlagen:',
      err,
    );
  }
}
