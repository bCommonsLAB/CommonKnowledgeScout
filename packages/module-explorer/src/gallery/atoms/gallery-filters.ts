import { atom } from 'jotai'
import type { GalleryFilters } from '@ks/contracts'

/**
 * Der Typ liegt seit der Welle „Galerie-Chat-Mittelschicht" in
 * `@ks/contracts` — beide Seiten brauchen ihn, und vierzehn Chat-Stellen
 * zeigten dafuer hierher (Audit `01-audit-galerie-chat.md`, Befund 3).
 * Hier weitergereicht, damit bestehende Importpfade bleiben.
 */
export type { GalleryFilters }

/** Aktive Facetten-Einschraenkungen der Galerie. Zustand bleibt in der App. */
export const galleryFiltersAtom = atom<GalleryFilters>({})
