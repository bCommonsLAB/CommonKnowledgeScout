/**
 * Wissensgalerie: Karten-Raster „kompakt“ vs. „komfortabel“ (Default).
 * Zentrale Tailwind-Klassen — keine stillen Fallbacks bei unbekannten Werten.
 */

export type GalleryCardDensity = 'compact' | 'comfortable'

const VALID = new Set<GalleryCardDensity>(['compact', 'comfortable'])

/**
 * Normalisiert Config-/Storage-Werte; unbekannte Werte → comfortable + Warnung.
 */
export function normalizeGalleryCardDensity(raw: unknown): GalleryCardDensity {
  if (raw === 'compact' || raw === 'comfortable') return raw
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    console.warn('[galleryCardDensity] Unbekannter Wert, verwende "comfortable":', raw)
  }
  return 'comfortable'
}

export function isGalleryCardDensity(v: unknown): v is GalleryCardDensity {
  return v === 'compact' || v === 'comfortable'
}

/** SessionStorage-Key pro Library */
export function galleryCardDensityStorageKey(libraryId: string): string {
  return `galleryCardDensity:${libraryId}`
}

/**
 * Grid in {@link ItemsGrid} (@container): komfortabel = früheres Raster, kompakt = dichteres Raster.
 */
export function itemsGridClassForDensity(density: GalleryCardDensity): string {
  if (!VALID.has(density)) {
    console.warn('[itemsGridClassForDensity] Ungültige Dichte, verwende comfortable:', density)
    density = 'comfortable'
  }
  if (density === 'compact') {
    return 'grid grid-cols-2 @md:grid-cols-3 @lg:grid-cols-4 @4xl:grid-cols-5 @6xl:grid-cols-6 @7xl:grid-cols-7 gap-3'
  }
  return 'grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 @7xl:grid-cols-5 gap-4'
}

/**
 * Grid in {@link GroupedItemsGrid} (Viewport-Breakpoints, kein @container).
 */
export function groupedItemsGridClassForDensity(density: GalleryCardDensity): string {
  if (!VALID.has(density)) {
    console.warn('[groupedItemsGridClassForDensity] Ungültige Dichte, verwende comfortable:', density)
    density = 'comfortable'
  }
  if (density === 'compact') {
    return 'grid grid-cols-2 min-[400px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3'
  }
  return 'grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4'
}
