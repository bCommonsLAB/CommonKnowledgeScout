/**
 * @fileoverview Shadow-Twin Errors (v2-only)
 *
 * @description
 * Central error types to enforce that the application runtime is v2-only.
 * If legacy/v1 logic is accidentally triggered (e.g. by calling a legacy resolver),
 * we want to fail fast with an actionable error.
 */

export type ShadowTwinErrorCode = 'shadow_twin_v1_not_allowed' | 'shadow_twin_provider_incomplete'

/**
 * Thrown when code attempts to use Shadow‑Twin legacy/v1 logic.
 *
 * WICHTIG:
 * - Das ist **kein** Hinweis für Nutzer, dass Daten \"kaputt\" sind.
 * - Es ist ein Engineering-Guard, damit wir keine stille doppelte Logik mehr haben.
 */
export class ShadowTwinLegacyNotAllowedError extends Error {
  public readonly code: ShadowTwinErrorCode = 'shadow_twin_v1_not_allowed'

  constructor(message?: string) {
    super(message || 'Shadow‑Twin legacy/v1 ist nicht erlaubt. Bitte nur v2 verwenden.')
    this.name = 'ShadowTwinLegacyNotAllowedError'
  }
}

/**
 * Thrown when shadow-twin code receives a storage object that lacks a
 * required provider method.
 *
 * WICHTIG:
 * - Programmierfehler, kein Lesefehler. Typischer Ausloeser: ein per Object
 *   Spread (`{ ...provider }`) kopierter Provider — die Methoden der
 *   Provider-Klassen liegen auf dem Prototype und gehen dabei verloren.
 * - Darf NICHT als „leere Variante" oder „nicht gefunden" geschluckt werden.
 *   Wer Reads cachen will, nimmt `withRequestStorageCache`
 *   (`@/lib/storage/provider-request-cache`).
 */
export class ShadowTwinProviderIncompleteError extends Error {
  public readonly code: ShadowTwinErrorCode = 'shadow_twin_provider_incomplete'
  public readonly method: string

  constructor(method: string, context: string) {
    super(
      `${context}: Provider ohne Methode "${method}" — unvollstaendiger Provider ` +
        '(z.B. per { ...provider } kopiert). Programmierfehler, kein Lesefehler.'
    )
    this.name = 'ShadowTwinProviderIncompleteError'
    this.method = method
  }
}

/**
 * Helper: Fail fast if legacy was requested.
 */
export function assertShadowTwinV2Only(mode: string): asserts mode is 'v2' {
  if (mode !== 'v2') {
    throw new ShadowTwinLegacyNotAllowedError(
      `Shadow‑Twin legacy/v1 ist nicht erlaubt (mode="${mode}").`
    )
  }
}
