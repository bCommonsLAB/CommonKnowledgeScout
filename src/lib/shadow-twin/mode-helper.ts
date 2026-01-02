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
 * @returns 'legacy' oder 'v2' (Default: 'legacy' für bestehende Libraries)
 */
export function getShadowTwinMode(library: Library | ClientLibrary | null | undefined): 'legacy' | 'v2' {
  if (!library?.config) {
    return 'legacy';
  }
  
  // Prüfe shadowTwin.mode (kann sowohl in Library als auch ClientLibrary vorhanden sein)
  const shadowTwinConfig = (library.config as { shadowTwin?: { mode?: 'legacy' | 'v2' } }).shadowTwin;
  if (!shadowTwinConfig?.mode) {
    // Default: legacy für bestehende Libraries
    return 'legacy';
  }
  return shadowTwinConfig.mode;
}

