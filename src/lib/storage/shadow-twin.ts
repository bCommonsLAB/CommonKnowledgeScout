import path from 'path';
import { StorageItem, StorageProvider } from './types';
import { FileLogger } from '@/lib/debug/logger';

/**
 * Generiert den Shadow-Twin-Dateinamen für eine Transformation
 * 
 * @param originalName Der ursprüngliche Dateiname
 * @param language Die Zielsprache (wird nur verwendet wenn isTranscript = false)
 * @param isTranscript Wenn true: Kein Language-Suffix (Transcript-File, Originalsprache)
 *                     Wenn false: Mit Language-Suffix (Transformiertes File, übersetzt)
 * @returns Dateiname im Format:
 *   - Transcript: {originalname}.md
 *   - Transformiert: {originalname}.{language}.md
 */
export function generateShadowTwinName(
  originalName: string,
  language: string,
  isTranscript: boolean = false
): string {
  const parsedPath = path.parse(originalName);
  if (isTranscript) {
    // Transcript-File: OHNE Language-Suffix (Originalsprache)
    return `${parsedPath.name}.md`;
  }
  // Transformiertes File: MIT Language-Suffix (übersetzt)
  return `${parsedPath.name}.${language}.md`;
}

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
  
  // Debug: Logge alle Ordner im Parent-Verzeichnis
  const folders = items.filter(item => item.type === 'folder');
  
  FileLogger.debug('findShadowTwinFolder', 'Suche Shadow-Twin-Verzeichnis', {
    originalName,
    parentId,
    variants,
    foldersFound: folders.map(f => f.metadata.name),
    totalItems: items.length
  });
  
  // Prüfe jede Variante
  for (const variant of variants) {
    const found = items.find(
      item => item.type === 'folder' && 
      item.metadata.name === variant
    );
    
    if (found) {
      FileLogger.info('findShadowTwinFolder', 'Shadow-Twin-Verzeichnis gefunden', {
        variant,
        folderId: found.id,
        folderName: found.metadata.name
      });
      return found;
    }
  }
  
  return null;
}

/**
 * Findet die Markdown-Datei im Shadow-Twin-Verzeichnis
 * 
 * Sucht zuerst nach dem transformierten File (mit Language-Suffix),
 * falls nicht gefunden, nach dem Transcript-File (ohne Language-Suffix).
 * 
 * @param folderId ID des Shadow-Twin-Verzeichnisses
 * @param baseName Basisname der Originaldatei (ohne Extension)
 * @param lang Zielsprache
 * @param provider Storage Provider
 * @param preferTransformed Wenn true: Suche zuerst transformiertes File (Standard)
 * @returns Gefundene Markdown-Datei oder null
 */
export async function findShadowTwinMarkdown(
  folderId: string,
  baseName: string,
  lang: string,
  provider: StorageProvider,
  preferTransformed: boolean = true
): Promise<StorageItem | null> {
  const items = await provider.listItemsById(folderId);
  
  if (preferTransformed) {
    // Zuerst transformiertes File suchen (mit Language-Suffix)
    const transformedName = generateShadowTwinName(baseName, lang, false);
    const transformed = items.find(
      item => item.type === 'file' && 
      item.metadata.name === transformedName
    );
    if (transformed) return transformed;
  }
  
  // Fallback: Transcript-File suchen (ohne Language-Suffix)
  const transcriptName = generateShadowTwinName(baseName, lang, true);
  const transcript = items.find(
    item => item.type === 'file' && 
    item.metadata.name === transcriptName
  );
  
  return transcript || null;
}

/**
 * Generiert den vollständigen Pfad für einen Shadow-Twin
 */
export async function generateShadowTwinPath(
  item: StorageItem,
  language: string,
  storageProvider: StorageProvider
): Promise<string> {
  const twinName = generateShadowTwinName(
    item.metadata.name,
    language
  );
  const parentPath = await storageProvider.getPathById(item.parentId);
  return path.join(parentPath, twinName);
}

/**
 * Speichert einen Shadow-Twin im Storage
 */
export async function saveShadowTwin(
  originalItem: StorageItem,
  transformationResult: {
    output_text: string;
  },
  targetLanguage: string,
  storageProvider: StorageProvider
): Promise<StorageItem> {
  // Erstelle eine temporäre Datei mit dem Inhalt
  const blob = new Blob([transformationResult.output_text], { type: 'text/markdown' });
  const file = new File([blob], generateShadowTwinName(
    originalItem.metadata.name,
    targetLanguage
  ), { type: 'text/markdown' });

  // Speichere die Datei im gleichen Verzeichnis wie die Originaldatei
  return storageProvider.uploadFile(originalItem.parentId, file);
} 