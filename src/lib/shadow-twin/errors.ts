/**
 * @fileoverview Shadow-Twin Errors (v2-only)
 *
 * @description
 * Central error types to enforce that the application runtime is v2-only.
 * If legacy/v1 logic is accidentally triggered (e.g. by calling a legacy resolver),
 * we want to fail fast with an actionable error.
 */

export type ShadowTwinErrorCode = 'shadow_twin_v1_not_allowed'

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
 * Helper: Fail fast if legacy was requested.
 */
export function assertShadowTwinV2Only(mode: string): asserts mode is 'v2' {
  if (mode !== 'v2') {
    throw new ShadowTwinLegacyNotAllowedError(
      `Shadow‑Twin legacy/v1 ist nicht erlaubt (mode="${mode}").`
    )
  }
}



