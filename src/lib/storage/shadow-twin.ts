import path from 'path';
import { StorageItem, StorageProvider } from './types';
import { FileLogger } from '@/lib/debug/logger';


/**
 * Generiert den Shadow-Twin-Verzeichnisnamen mit Punkt-Prefix
 * Format: .{originalName}/ (mit Dateiendung, z.B. .document.pdf/)
 * 
 * WICHTIG: Berücksichtigt Längenlimit von 255 Zeichen für Verzeichnisnamen.
 * Wenn der Name zu lang ist, wird er abgeschnitten (behält Dateiendung).
 * 
 * @param originalName Der ursprüngliche Dateiname
 * @param maxLength Maximale Länge (Standard: 255 Zeichen)
 * @returns Verzeichnisname im Format .{name}/
 */
export function generateShadowTwinFolderName(
  originalName: string,
  maxLength: number = 255
): string {
  // Entferne führende/trailing Slashes falls vorhanden
  const cleanName = originalName.trim().replace(/^\/+|\/+$/g, '');
  
  // Erstelle Verzeichnisname mit Punkt-Prefix
  const folderName = `.${cleanName}`;
  
  // Prüfe Längenlimit
  if (folderName.length <= maxLength) {
    return folderName;
  }
  
  // Name ist zu lang - muss abgeschnitten werden
  // Strategie: Behalte Dateiendung, kürze Basisname
  const parsedPath = path.parse(cleanName);
  const extension = parsedPath.ext; // z.B. .pdf
  const baseName = parsedPath.name; // Basisname ohne Extension
  
  // Berechne verfügbare Länge für Basisname
  // Punkt-Prefix (1) + Extension + Punkt (1) = 2 + extension.length
  const reservedLength = 2 + extension.length;
  const availableLength = maxLength - reservedLength;
  
  if (availableLength <= 0) {
    // Extension selbst ist schon zu lang - verwende nur Extension
    return `.${extension}`;
  }
  
  // Kürze Basisname von vorne
  const truncatedBase = baseName.length > availableLength 
    ? baseName.slice(0, availableLength)
    : baseName;
  
  return `.${truncatedBase}${extension}`;
}

/**
 * Generiert alle möglichen Varianten des Shadow-Twin-Verzeichnisnamens
 * für die Erkennungslogik. Berücksichtigt sowohl vollständigen Namen
 * als auch abgeschnittene Varianten (falls Original > 255 Zeichen).
 * 
 * @param originalName Der ursprüngliche Dateiname
 * @returns Array von möglichen Verzeichnisnamen-Varianten
 */
export function generateShadowTwinFolderNameVariants(originalName: string): string[] {
  const fullName = generateShadowTwinFolderName(originalName, 255);
  const variants: string[] = [fullName];
  
  // Wenn der vollständige Name bereits abgeschnitten wurde,
  // gibt es keine weiteren Varianten
  const cleanName = originalName.trim().replace(/^\/+|\/+$/g, '');
  const fullFolderName = `.${cleanName}`;
  
  if (fullFolderName.length > 255) {
    // Name wurde abgeschnitten - nur abgeschnittene Variante zurückgeben
    return variants;
  }
  
  // Vollständiger Name passt - nur eine Variante
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
 * Löst einen relativen Bildpfad zu einer Storage-API-URL auf
 * 
 * Diese Funktion zentralisiert die Bild-URL-Auflösung für Frontend-Komponenten.
 * Sie verwendet findShadowTwinImage() um das Bild zu finden und generiert dann
 * eine Storage-API-URL.
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
  const imageFile = await findShadowTwinImage(
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
  
  // Generiere Storage-API-URL
  const resolvedUrl = `/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(imageFile.id)}&libraryId=${encodeURIComponent(libraryId)}`;
  
  return resolvedUrl;
}

