'use client'

/**
 * @fileoverview Verdrahtet den Bibliothekswechsel der Schale mit den
 * Galerie-Filtern der Anwendung (Welle M4e).
 *
 * @description
 * `@ks/shell/react` haelt den Auswahl-Zustand, kennt aber die Galerie-Filter
 * nicht — ein Paket, das dafuer `@/atoms/gallery-filters` importierte, griffe
 * zurueck in die App (Modul-Landkarte §4 verbietet das). Die Schale definiert
 * deshalb nur, DASS beim Wechsel etwas passieren kann; was passiert, reicht
 * diese Bruecke herein.
 *
 * Fachlich: Facetten und `shortTitle` sind an die aktive Bibliothek gebunden.
 * Ohne Ruecksetzen blieben die Filter der vorherigen Bibliothek stehen.
 *
 * Die Registrierung geschieht auf MODUL-Ebene, nicht in einem Effect — sie muss
 * stehen, bevor der erste Wechsel passiert. Sie laeuft in derselben
 * Jotai-Transaktion wie der Wechsel selbst; ein nachgelagerter Effect wuerde
 * einen Zwischenzustand mit neuer Bibliothek und alten Filtern rendern.
 *
 * Die Komponente rendert nichts — sie macht die Verdrahtung in der
 * Provider-Kette von `layout.tsx` sichtbar.
 */

import { registerActiveLibraryChangeEffect } from '@ks/shell/react'
import { galleryFiltersAtom } from '@/atoms/gallery-filters'

registerActiveLibraryChangeEffect((set) => {
  set(galleryFiltersAtom, {})
})

export function LibraryChangeBridge() {
  return null
}
