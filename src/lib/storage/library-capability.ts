/**
 * @fileoverview Library-Capability-Helper
 *
 * Zentrale Helper, die abstrakte Faehigkeiten einer Library ableiten,
 * damit UI/Hooks **nicht** direkt `library.type === '...'` oder
 * `library.config.shadowTwin.primaryStore` lesen muessen.
 *
 * Hintergrund: Welle 1 / Schritt 4 — siehe `.cursor/rules/storage-contracts.mdc`
 * §5 und [`docs/refactor/storage/04-altlast-pass.md`](../../../docs/refactor/storage/04-altlast-pass.md).
 *
 * @module storage
 */

import type { ClientLibrary, Library } from '@/types/library'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'

/**
 * Library-Shape, das fuer Capability-Helper ausreichend ist.
 *
 * Wir akzeptieren bewusst beide Library-Shapes (Server-`Library` und
 * Client-`ClientLibrary`), weil die Helper sowohl in API-Routes als auch
 * in UI-Komponenten verwendet werden duerfen. Storage-Backend-Details
 * werden nicht durchgereicht — die Helper liefern nur ein boolean.
 */
export type LibraryLike = Pick<ClientLibrary, 'config'> & { config?: ClientLibrary['config'] | null }

/**
 * Liefert `true`, wenn Shadow-Twin-Daten dieser Library auf einem
 * Filesystem-aehnlichen Provider persistiert werden:
 *
 * - `primaryStore === 'filesystem'` (Default), ODER
 * - `persistToFilesystem === true` (auch im `mongo`-Primary-Modus,
 *   wenn die Library bewusst zusaetzlich aufs Filesystem schreibt).
 *
 * Der Helper kapselt die Logik aus `file-preview.tsx:1134`. Aufrufer
 * muessen die Logik nicht mehr selbst inlinen.
 *
 * Diese Funktion ist Teil der **storage-agnostischen** API: Aufrufer
 * lernen nicht, **welcher** Provider verwendet wird, nur **dass** das
 * Filesystem mitspielt — z.B. um die Anzeige eines "Mongo-Transkript-Link"
 * zu unterdruecken, weil die Datei lokal liegt.
 */
export function isFilesystemBacked(library: Library | ClientLibrary | null | undefined): boolean {
  if (!library) return false
  // getShadowTwinConfig kennt beide Library-Shapes. Cast nach Library, weil
  // Server-Library strenger typisiert ist; Runtime-Felder sind identisch.
  const config = getShadowTwinConfig(library as Library)
  return config.primaryStore === 'filesystem' || config.persistToFilesystem
}
