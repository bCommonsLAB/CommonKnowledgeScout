import path from 'path';
import { StorageItem, StorageProvider } from './types';

/**
 * Generiert den Shadow-Twin-Dateinamen für eine Transformation
 * Format: {originalname}.{language}.md
 */
export function generateShadowTwinName(
  originalName: string,
  language: string
): string {
  const parsedPath = path.parse(originalName);
  return `${parsedPath.name}.${language}.md`;
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