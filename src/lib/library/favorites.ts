import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { FileLogger, NavigationLogger } from "@/lib/debug/logger";

export interface FavoriteEntry {
  id: string;
  name: string;
  path?: string[];
  addedAt: string;
}

export interface LibraryFavoritesData {
  libraryId: string;
  favorites: FavoriteEntry[];
}

const META_FOLDER_NAME = ".ck-meta";
const FAVORITES_FILE_NAME = "favorites.json";

async function ensureMetaFolder(provider: StorageProvider): Promise<string> {
  const rootId = "root";
  const items = await provider.listItemsById(rootId);
  let meta = items.find((i) => i.type === "folder" && i.metadata.name === META_FOLDER_NAME);
  if (!meta) meta = await provider.createFolder(rootId, META_FOLDER_NAME);
  return meta.id;
}

async function readFavoritesFile(provider: StorageProvider): Promise<LibraryFavoritesData | null> {
  try {
    const metaId = await ensureMetaFolder(provider);
    const files = await provider.listItemsById(metaId);
    const fav = files.find((i) => i.type === "file" && i.metadata.name === FAVORITES_FILE_NAME);
    if (!fav) return null;
    const { blob } = await provider.getBinary(fav.id);
    const text = await blob.text();
    const data = JSON.parse(text) as LibraryFavoritesData;
    return data;
  } catch (error) {
    FileLogger.error("Favorites", "Failed to read favorites file", error);
    return null;
  }
}

async function writeFavoritesFile(provider: StorageProvider, data: LibraryFavoritesData): Promise<void> {
  const metaId = await ensureMetaFolder(provider);
  const payload = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const file = new File([payload], FAVORITES_FILE_NAME, { type: "application/json" });
  // Lösche existierende Datei, wenn vorhanden
  const files = await provider.listItemsById(metaId);
  const existing = files.find((i) => i.type === "file" && i.metadata.name === FAVORITES_FILE_NAME);
  if (existing) await provider.deleteItem(existing.id);
  await provider.uploadFile(metaId, file);
}

export async function loadFavorites(provider: StorageProvider, libraryId: string): Promise<LibraryFavoritesData> {
  const data = await readFavoritesFile(provider);
  if (data && data.libraryId === libraryId) return data;
  return { libraryId, favorites: [] };
}

export async function toggleFavorite(
  provider: StorageProvider,
  libraryId: string,
  folder: StorageItem
): Promise<LibraryFavoritesData> {
  const current = await loadFavorites(provider, libraryId);
  const exists = current.favorites.some((f) => f.id === folder.id);
  if (exists) {
    current.favorites = current.favorites.filter((f) => f.id !== folder.id);
  } else {
    let pathLabels: string[] | undefined;
    try {
      const pathItems = await provider.getPathItemsById(folder.id);
      pathLabels = pathItems.map((p) => p.metadata.name);
    } catch {
      pathLabels = undefined;
    }
    current.favorites.push({
      id: folder.id,
      name: folder.metadata.name,
      path: pathLabels,
      addedAt: new Date().toISOString(),
    });
  }
  await writeFavoritesFile(provider, current);
  NavigationLogger.info("Favorites", exists ? "Removed favorite" : "Added favorite", {
    folderId: folder.id,
    folderName: folder.metadata.name,
  });
  return current;
}



