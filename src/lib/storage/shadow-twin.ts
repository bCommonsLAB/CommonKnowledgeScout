import { StorageItem, StorageProvider } from './types';
import { FileLogger } from '@/lib/debug/logger';
import {
  generateShadowTwinFolderName,
  parseTwinRelativeImageRef,
} from './shadow-twin-folder-name';

export {
  generateShadowTwinFolderName,
  isShadowTwinFolderName,
  parseTwinRelativeImageRef,
  buildTwinRelativeMediaRef,
} from './shadow-twin-folder-name';

/**
 * Generiert alle möglichen Varianten des Shadow-Twin-Verzeichnisnamens
 * für die Erkennungslogik. Berücksichtigt:
 * - Neues Format: Unterstrich-Prefix (_name)
 * - Legacy-Format: Punkt-Prefix (.name) für Rückwärtskompatibilität
 * 
 * @param originalName Der ursprüngliche Dateiname
 * @returns Array von möglichen Verzeichnisnamen-Varianten (Unterstrich zuerst, dann Punkt)
 */
export function generateShadowTwinFolderNameVariants(originalName: string): string[] {
  const cleanName = originalName.trim().replace(/^\/+|\/+$/g, '');
  
  // Neues Format (Unterstrich) – zuerst prüfen
  const underscoreName = generateShadowTwinFolderName(originalName, 255);
  const variants: string[] = [underscoreName];
  
  // Legacy-Format (Punkt) – für bestehende Ordner
  const dotName = `.${cleanName}`;
  if (dotName.length <= 255 && dotName !== underscoreName) {
    variants.push(dotName);
  }
  
  return variants;
}

/**
 * Findet das Shadow-Twin-Verzeichnis im Parent-Verzeichnis
 * Berücksichtigt Längenlimit und prüft sowohl vollständigen Namen
 * als auch abgeschnittene Varianten.
 * 
 * @param parentId ID des Parent-Verzeichnisses
 * @param originalName Der ursprüngliche Dateiname
 * @param provider Storage Provider
 * @returns Gefundenes Verzeichnis oder null
 */
export async function findShadowTwinFolder(
  parentId: string,
  originalName: string,
  provider: StorageProvider
): Promise<StorageItem | null> {
  // Generiere alle möglichen Varianten
  const variants = generateShadowTwinFolderNameVariants(originalName);
  
  // Hole alle Items im Parent-Verzeichnis
  const items = await provider.listItemsById(parentId);
  
  // Prüfe jede Variante
  for (const variant of variants) {
    const found = items.find(
      item => item.type === 'folder' && 
      item.metadata.name === variant
    );
    
    if (found) {
      return found;
    }
  }
  
  return null;
}

/**
 * Findet ein Bild im Shadow-Twin-Verzeichnis oder im Parent-Verzeichnis (Fallback)
 * 
 * Diese Funktion zentralisiert die Bild-Auflösungslogik für Shadow-Twin-Dateien.
 * Sie sucht zuerst im Shadow-Twin-Verzeichnis (falls vorhanden), dann im Parent-Verzeichnis.
 * 
 * @param baseItem Die Basisdatei (z.B. PDF), zu der das Bild gehört
 * @param imagePath Relativer Bildpfad (z.B. "img-0.jpeg")
 * @param provider Storage Provider
 * @param shadowTwinFolderId Optional: ID des Shadow-Twin-Verzeichnisses (wenn bereits bekannt)
 * @returns Die gefundene Bild-Datei oder null
 */
export async function findShadowTwinImage(
  baseItem: StorageItem,
  imagePath: string,
  provider: StorageProvider,
  shadowTwinFolderId?: string
): Promise<StorageItem | null> {
  // Normalisiere Bildpfad
  const normalizedPath = imagePath.replace(/^\/+|\/+$/g, '');
  
  // Prüfe auf Path-Traversal-Versuche
  if (normalizedPath.includes('..')) {
    FileLogger.warn('findShadowTwinImage', 'Path traversal erkannt', {
      imagePath,
      normalizedPath,
      fileId: baseItem.id
    });
    return null;
  }
  
  // 1. Versuche Shadow-Twin-Verzeichnis zu finden (falls nicht bereits bekannt)
  let shadowTwinFolder: StorageItem | null = null;
  if (shadowTwinFolderId) {
    try {
      shadowTwinFolder = await provider.getItemById(shadowTwinFolderId);
      if (!shadowTwinFolder || shadowTwinFolder.type !== 'folder') {
        shadowTwinFolder = null;
      }
    } catch {
      // Shadow-Twin-Verzeichnis nicht gefunden, versuche es zu finden
      shadowTwinFolder = null;
    }
  }
  
  if (!shadowTwinFolder) {
    shadowTwinFolder = await findShadowTwinFolder(
      baseItem.parentId,
      baseItem.metadata.name,
      provider
    );
  }
  
  // 2. Suche Bild im Shadow-Twin-Verzeichnis (falls vorhanden)
  if (shadowTwinFolder) {
    try {
      const folderItems = await provider.listItemsById(shadowTwinFolder.id);
      const imageFile = folderItems.find(
        item => item.type === 'file' && item.metadata.name === normalizedPath
      );
      
      if (imageFile) {
        return imageFile;
      }
    } catch (error) {
      FileLogger.warn('findShadowTwinImage', 'Fehler beim Auflisten des Shadow-Twin-Verzeichnisses', {
        imagePath: normalizedPath,
        fileId: baseItem.id,
        shadowTwinFolderId: shadowTwinFolder.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // 3. Fallback: Suche Bild im Parent-Verzeichnis (für Legacy-Dateien)
  try {
    const parentItems = await provider.listItemsById(baseItem.parentId);
    const imageFile = parentItems.find(
      item => item.type === 'file' && item.metadata.name === normalizedPath
    );
    
    if (imageFile) {
      return imageFile;
    }
  } catch (error) {
    FileLogger.warn('findShadowTwinImage', 'Fehler beim Auflisten des Parent-Verzeichnisses', {
      imagePath: normalizedPath,
      fileId: baseItem.id,
      parentId: baseItem.parentId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Bild nicht gefunden - kein Log, da dies normal sein kann (Bild noch nicht hochgeladen)
  return null;
}

/**
 * Ordnet ein Twin-Ordner-Segment (`_Quelle.pdf`) der Quell-Datei im selben Elternordner zu.
 */
export async function findSourceFileMatchingTwinFolder(
  parentId: string,
  twinFolderName: string,
  provider: StorageProvider,
): Promise<StorageItem | null> {
  const items = await provider.listItemsById(parentId)
  for (const item of items) {
    if (item.type !== 'file') continue
    const n = item.metadata.name
    if (generateShadowTwinFolderName(n) === twinFolderName) {
      return item
    }
    if (`.${n.trim()}` === twinFolderName) {
      return item
    }
  }
  return null
}

/**
 * `imageRef` ist ein einfacher Dateiname (Twin der Anker-Datei) oder
 * `_Quelldatei.pdf/fragment.jpeg` (Fragment aus einer anderen Quelle im gleichen Ordner).
 */
export async function findShadowTwinImageFromAnchorContext(
  anchorItem: StorageItem,
  imageRef: string,
  provider: StorageProvider,
  shadowTwinFolderId?: string,
): Promise<StorageItem | null> {
  const decoded = imageRef.replace(/&amp;/g, '&').trim()
  const parsed = parseTwinRelativeImageRef(decoded)
  if (parsed) {
    const sourceFile = await findSourceFileMatchingTwinFolder(anchorItem.parentId, parsed.twinFolderName, provider)
    if (sourceFile) {
      const inTwin = await findShadowTwinImage(sourceFile, parsed.imageFileName, provider, undefined)
      if (inTwin) return inTwin
    }
  }
  return findShadowTwinImage(anchorItem, decoded, provider, shadowTwinFolderId)
}

/**
 * Löst einen relativen Bildpfad zu einer Storage-API-URL auf
 * 
 * Diese Funktion zentralisiert die Bild-URL-Auflösung für Frontend-Komponenten.
 * Sie verwendet findShadowTwinImageFromAnchorContext (inkl. `_Quelle/fragment`-Pfade).
 * 
 * @param baseItem Die Basisdatei (z.B. PDF), zu der das Bild gehört
 * @param imagePath Relativer Bildpfad (z.B. "img-0.jpeg")
 * @param provider Storage Provider
 * @param libraryId Die Library-ID für die Storage-API-URL
 * @param shadowTwinFolderId Optional: ID des Shadow-Twin-Verzeichnisses (wenn bereits bekannt)
 * @returns Storage-API-URL oder ursprünglicher Pfad bei Fehler
 */
export async function resolveShadowTwinImageUrl(
  baseItem: StorageItem,
  imagePath: string,
  provider: StorageProvider,
  libraryId: string,
  shadowTwinFolderId?: string
): Promise<string> {
  // Prüfe ob es bereits eine absolute URL ist
  const decodedPath = imagePath.replace(/&amp;/g, '&');
  if (decodedPath.startsWith('http://') || 
      decodedPath.startsWith('https://') || 
      decodedPath.startsWith('/api/storage/')) {
    return imagePath;
  }
  
  // Finde Bild-Datei
  const imageFile = await findShadowTwinImageFromAnchorContext(
    baseItem,
    imagePath,
    provider,
    shadowTwinFolderId
  );
  
  if (!imageFile) {
    FileLogger.warn('resolveShadowTwinImageUrl', 'Bild nicht gefunden, verwende ursprünglichen Pfad', {
      imagePath,
      fileId: baseItem.id
    });
    return imagePath;
  }
  
  // Provider-agnostische Streaming-URL (funktioniert für Local und OneDrive)
  const resolvedUrl = `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(imageFile.id)}`;
  
  return resolvedUrl;
}

