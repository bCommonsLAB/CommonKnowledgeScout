/**
 * @fileoverview Shadow-Twin Config Helpers
 *
 * @description
 * Liefert stabile Default-Werte fuer Shadow-Twin-Flags pro Library.
 * MongoDB ist der primaere Store; das Dateisystem ist nur Backup-Spiegel
 * und Lese-Fallback. `primaryStore: 'filesystem'` existiert nur noch fuer
 * den Inbox-Kontrakt (ADR-0004 II) und explizit so konfigurierte Alt-Libraries.
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
 *
 * Ohne Library (Inbox-/Quarantaene-Scope, ADR-0004 II) gibt es keinen
 * Mongo-Shadow-Twin: Es gilt immer der Provider-Schreibpfad. Dieser Fall
 * ist hier explizit, damit der Mongo-Default fuer echte Libraries die
 * Inbox-Jobs nicht umleitet.
 */
export function getShadowTwinConfig(library: Library | null | undefined): ShadowTwinConfigDefaults {
  if (!library) {
    return {
      primaryStore: 'filesystem',
      persistToFilesystem: true,
      cleanupFilesystemOnMigrate: false,
      allowFilesystemFallback: true,
    }
  }

  const cfg = library.config?.shadowTwin

  return {
    primaryStore: cfg?.primaryStore || 'mongo',
    persistToFilesystem: cfg?.persistToFilesystem ?? true,
    cleanupFilesystemOnMigrate: cfg?.cleanupFilesystemOnMigrate ?? false,
    allowFilesystemFallback: cfg?.allowFilesystemFallback ?? true,
  }
}
