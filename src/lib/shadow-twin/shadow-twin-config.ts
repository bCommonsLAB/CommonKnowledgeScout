/**
 * @fileoverview Shadow-Twin Config Helpers
 *
 * @description
 * Liefert stabile Default-Werte fuer Shadow-Twin-Flags pro Library.
 * Diese Defaults sind bewusst konservativ, um Legacy-Verhalten nicht zu brechen.
 */

import type { Library } from '@/types/library'

export type ShadowTwinPrimaryStore = 'filesystem' | 'mongo'

export interface ShadowTwinConfigDefaults {
  primaryStore: ShadowTwinPrimaryStore
  persistToFilesystem: boolean
  cleanupFilesystemOnMigrate: boolean
  allowFilesystemFallback: boolean
}

/**
 * Liefert die effektive Shadow-Twin-Konfiguration fuer eine Library.
 */
export function getShadowTwinConfig(library: Library | null | undefined): ShadowTwinConfigDefaults {
  const cfg = library?.config?.shadowTwin

  const primaryStore: ShadowTwinPrimaryStore = cfg?.primaryStore || 'filesystem'
  const persistToFilesystem =
    typeof cfg?.persistToFilesystem === 'boolean'
      ? cfg.persistToFilesystem
      : primaryStore === 'filesystem'

  return {
    primaryStore,
    persistToFilesystem,
    cleanupFilesystemOnMigrate: cfg?.cleanupFilesystemOnMigrate ?? false,
    allowFilesystemFallback: cfg?.allowFilesystemFallback ?? true,
  }
}
