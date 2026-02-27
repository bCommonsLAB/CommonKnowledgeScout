/**
 * @fileoverview Favoriten-Verwaltung (Ordner-Lesezeichen pro Library)
 *
 * @description
 * Client-seitige Funktionen zum Laden und Umschalten von Favoriten.
 * Favoriten werden in MongoDB gespeichert (Library-Dokument),
 * nicht mehr im Dateisystem (.ck-meta).
 *
 * @module library
 *
 * @exports
 * - FavoriteEntry: Re-Export aus types/library
 * - LibraryFavoritesData: Antwort-Typ der API
 * - loadFavorites: Favoriten einer Library laden
 * - toggleFavorite: Favorit hinzufuegen oder entfernen
 *
 * @usedIn
 * - src/components/library/breadcrumb.tsx: Favoriten-Dropdown + Toggle-Button
 *
 * @dependencies
 * - /api/library/[libraryId]/favorites: Server-seitige API-Route
 */

// Re-Export fuer Abwaertskompatibilitaet
export type { FavoriteEntry } from '@/types/library'

export interface LibraryFavoritesData {
  libraryId: string
  favorites: Array<{
    id: string
    name: string
    path?: string[]
    addedAt: string
  }>
}

/**
 * Laedt die Favoriten einer Library ueber die API.
 * Gibt bei Fehlern ein leeres Array zurueck.
 */
export async function loadFavorites(libraryId: string): Promise<LibraryFavoritesData> {
  try {
    const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/favorites`)
    if (!res.ok) return { libraryId, favorites: [] }
    return (await res.json()) as LibraryFavoritesData
  } catch {
    return { libraryId, favorites: [] }
  }
}

/**
 * Toggle: Fuegt einen Favorit hinzu oder entfernt ihn.
 *
 * @param libraryId  ID der Library
 * @param folderId   Storage-ID des Ordners
 * @param folderName Anzeigename des Ordners
 * @param pathLabels Optionale Pfad-Labels fuer die Breadcrumb-Anzeige
 */
export async function toggleFavorite(
  libraryId: string,
  folderId: string,
  folderName: string,
  pathLabels?: string[],
): Promise<LibraryFavoritesData> {
  const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderId, folderName, pathLabels }),
  })

  if (!res.ok) {
    throw new Error('Fehler beim Aktualisieren der Favoriten')
  }

  return (await res.json()) as LibraryFavoritesData
}
