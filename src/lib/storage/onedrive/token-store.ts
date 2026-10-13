/**
 * @fileoverview OneDrive-Token-Store — Schnittstelle (client-sicher, nur Typen).
 *
 * @description
 * Der OneDriveProvider laeuft in BEIDEN Kontexten: Im Browser wohnen die
 * Tokens im localStorage, auf dem Server in der Library-Config (MongoDB).
 * Bis zur Testsession 25.08.2026 erreichte der Server seine eigene DB per
 * HTTP-Selbst-Aufruf (`GET/PATCH/DELETE /api/libraries/{id}/tokens`) — ein
 * kompletter Roundtrip durch den eigenen Next-Server pro Verifizieren, und
 * jeder Fehlkonfigurations-Fall von `INTERNAL_SELF_BASE_URL` liess ihn ins
 * Leere laufen (ECONNREFUSED, Ergebnis-Dokument §2/§4).
 *
 * Diese Schnittstelle ersetzt den Selbst-Aufruf durch einen direkten
 * Funktionsaufruf: Die StorageFactory injiziert im Server-Kontext die
 * DB-Implementierung (`token-db.ts`, dynamischer Import — MongoDB bleibt aus
 * dem Client-Bundle). Ohne injizierten Store faellt der Provider auf den
 * bisherigen HTTP-Weg zurueck (z.B. Auth-Hilfsinstanzen ausserhalb der
 * Factory) — der Rueckfall ist im Log benannt, nie still.
 *
 * @module storage/onedrive
 */

export interface OneDriveTokens {
  accessToken: string
  refreshToken: string
  /** Unix-Sekunden (wie in der Library-Config persistiert). */
  tokenExpiry: number
}

/** Ergebnis eines Token-Refresh (Form der Refresh-Route). */
export interface OneDriveRefreshResult {
  accessToken: string
  refreshToken: string
  /** Sekunden bis zum Ablauf. */
  expiresIn: number
}

/** Direkter Server-Zugriff auf die Token-Ablage einer Library. */
export interface OneDriveTokenStore {
  /**
   * Erneuert die Tokens mit der Azure-App der Speicher-Verbindung, ohne
   * HTTP-Selbst-Aufruf. Wirft bei Fehlern; `code` am Fehler ist der
   * OAuth-Code (`invalid_grant` = Refresh-Token tot).
   */
  refresh(refreshToken: string): Promise<OneDriveRefreshResult>
  /** Frische Tokens aus der DB; null = keine (Authentifizierung erforderlich). */
  load(): Promise<OneDriveTokens | null>
  save(tokens: OneDriveTokens): Promise<void>
  /** Entfernt die Tokens und leert den Provider-Cache der Factory. */
  clear(): Promise<void>
}
