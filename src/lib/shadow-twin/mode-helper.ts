/**
 * @fileoverview Shadow-Twin Mode Helper - Library-Modus-Detection
 * 
 * @description
 * Hilfsfunktionen zum Ermitteln des Shadow-Twin-Modus einer Library.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - getShadowTwinMode: Ermittelt den Shadow-Twin-Modus einer Library
 */

import type { Library, ClientLibrary } from '@/types/library';

/**
 * Ermittelt den Shadow-Twin-Modus einer Library.
 * 
 * @param library Library-Objekt (Library oder ClientLibrary)
 * @returns 'v2' (Die App ist v2-only; Legacy wird nicht mehr unterstützt)
 */
export function getShadowTwinMode(_library: Library | ClientLibrary | null | undefined): 'v2' {
  // WICHTIG (v2-only):
  // Wir lesen das gespeicherte Flag (legacy/v2) bewusst NICHT mehr, weil es sonst
  // wieder zu doppelter Logik führt. Migration alter Artefakte passiert später.
  return 'v2'
}

