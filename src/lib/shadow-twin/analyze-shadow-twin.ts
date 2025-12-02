/**
 * @fileoverview Shadow-Twin-Analyse - Zentrale Analyse-Funktion
 * 
 * @description
 * Analysiert eine Datei und findet alle zugehörigen Shadow-Twin-Dateien und Verzeichnisse.
 * Erstellt ein ShadowTwinState-Objekt mit allen gefundenen Informationen.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - analyzeShadowTwin: Hauptfunktion zur Shadow-Twin-Analyse
 * 
 * @usedIn
 * - src/hooks/use-shadow-twin-analysis.ts: Verwendet diese Funktion für die Analyse
 */

import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { ShadowTwinState } from '@/lib/shadow-twin/shared';
import { 
  findShadowTwinFolder, 
  generateShadowTwinName
} from '@/lib/storage/shadow-twin';
import { extractFrontmatterBlock } from '@/lib/markdown/frontmatter';
import { FileLogger } from '@/lib/debug/logger';

/**
 * Hilfsfunktion zum Extrahieren des Basisnamens (ohne Extension)
 */
function getBaseName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.');
  return lastDotIndex >= 0 ? fileName.substring(0, lastDotIndex) : fileName;
}

/**
 * Prüft, ob eine Datei eine Markdown-Datei ist
 */
function isMarkdownFile(item: StorageItem): boolean {
  return item.type === 'file' && (
    item.metadata.name.toLowerCase().endsWith('.md') ||
    item.metadata.mimeType?.toLowerCase() === 'text/markdown'
  );
}


/**
 * Prüft, ob eine Datei ein Audio/Video ist
 */
function isMediaFile(item: StorageItem): boolean {
  if (item.type !== 'file') return false;
  const mimeType = item.metadata.mimeType?.toLowerCase() || '';
  return mimeType.startsWith('audio/') || mimeType.startsWith('video/');
}

/**
 * Prüft, ob eine Datei ein Transcript für eine andere Datei ist
 * (Markdown-Datei mit gleichem Basisnamen)
 */
function isTranscriptFile(item: StorageItem, baseName: string): boolean {
  if (!isMarkdownFile(item)) return false;
  const itemBaseName = getBaseName(item.metadata.name);
  return itemBaseName.toLowerCase() === baseName.toLowerCase();
}

/**
 * Prüft, ob eine Markdown-Datei Frontmatter hat (transformed) oder nicht (transcript)
 * Lädt den Inhalt der Datei und prüft auf YAML-Frontmatter
 */
async function hasFrontmatter(markdownFile: StorageItem, provider: StorageProvider): Promise<boolean> {
  try {
    const { blob } = await provider.getBinary(markdownFile.id);
    const content = await blob.text();
    const frontmatter = extractFrontmatterBlock(content);
    return frontmatter !== null && frontmatter.length > 0;
  } catch {
    // Bei Fehler beim Laden: konservativ annehmen, dass es transformed ist
    return true;
  }
}

/**
 * Analysiert eine Datei und findet alle zugehörigen Shadow-Twin-Dateien und Verzeichnisse
 * 
 * @param fileId ID der zu analysierenden Datei
 * @param provider Storage Provider
 * @returns ShadowTwinState-Objekt oder null bei Fehler
 */
export async function analyzeShadowTwin(
  fileId: string,
  provider: StorageProvider
): Promise<ShadowTwinState | null> {
  const analysisTimestamp = Date.now();
  
  try {
    // 1. Lade baseItem
    const baseItem = await provider.getItemById(fileId);
    if (!baseItem) {
      return {
        baseItem: baseItem as StorageItem,
        analysisTimestamp,
        analysisError: 'Base item not found'
      };
    }

    const baseName = getBaseName(baseItem.metadata.name);
    const parentId = baseItem.parentId;
    const targetLanguage = 'de'; // Standard-Sprache, könnte später aus Kontext kommen

    // 2. Prüfe auf Shadow-Twin-Verzeichnis
    FileLogger.debug('analyzeShadowTwin', 'Suche Shadow-Twin-Verzeichnis', {
      fileId,
      fileName: baseItem.metadata.name,
      parentId
    });
    
    const shadowTwinFolder = await findShadowTwinFolder(
      parentId,
      baseItem.metadata.name,
      provider
    );
    
    if (shadowTwinFolder) {
      FileLogger.info('analyzeShadowTwin', 'Shadow-Twin-Verzeichnis gefunden', {
        fileId,
        fileName: baseItem.metadata.name,
        shadowTwinFolderId: shadowTwinFolder.id,
        shadowTwinFolderName: shadowTwinFolder.metadata.name
      });
    }


    let transformed: StorageItem | undefined;
    let transcriptFiles: StorageItem[] | undefined;
    let mediaFiles: StorageItem[] | undefined;
    const shadowTwinFolderId = shadowTwinFolder?.id;


    if (shadowTwinFolder) {
      // 3a. Shadow-Twin-Verzeichnis gefunden - lade Inhalt
      const folderItems = await provider.listItemsById(shadowTwinFolder.id);
      
      // Debug: Logge alle gefundenen Dateien im Shadow-Twin-Verzeichnis
      FileLogger.debug('analyzeShadowTwin', 'Shadow-Twin-Verzeichnis-Inhalt geladen', {
        fileId,
        fileName: baseItem.metadata.name,
        shadowTwinFolderId: shadowTwinFolder.id,
        folderItemsCount: folderItems.length,
        folderItems: folderItems.map(item => ({
          type: item.type,
          name: item.metadata.name,
          id: item.id
        }))
      });
      
      // Suche nach beiden Markdown-Varianten:
      // 1. Transformiertes File (mit Language-Suffix): document.de.md
      // 2. Transcript-File (ohne Language-Suffix): document.md
      const transformedName = generateShadowTwinName(baseName, targetLanguage, false);
      const transcriptName = generateShadowTwinName(baseName, targetLanguage, true);
      
      // Debug: Logge gesuchte Dateinamen
      FileLogger.debug('analyzeShadowTwin', 'Suche Shadow-Twin-Dateien', {
        fileId,
        fileName: baseItem.metadata.name,
        baseName,
        targetLanguage,
        transformedName,
        transcriptName,
        shadowTwinFolderId: shadowTwinFolder.id
      });
      
      const transformedFile = folderItems.find(
        item => item.type === 'file' && 
        item.metadata.name === transformedName
      );
      
      const transcriptFile = folderItems.find(
        item => item.type === 'file' && 
        item.metadata.name === transcriptName
      );
      
      // Debug: Logge gefundene Dateien und alle Markdown-Dateien im Verzeichnis
      const allMarkdownFiles = folderItems.filter(item => isMarkdownFile(item));
      FileLogger.debug('analyzeShadowTwin', 'Shadow-Twin-Dateien-Suche abgeschlossen', {
        fileId,
        fileName: baseItem.metadata.name,
        transformedFileFound: !!transformedFile,
        transcriptFileFound: !!transcriptFile,
        transformedFileName: transformedFile?.metadata.name,
        transcriptFileName: transcriptFile?.metadata.name,
        allMarkdownFilesCount: allMarkdownFiles.length,
        allMarkdownFileNames: allMarkdownFiles.map(f => f.metadata.name)
      });
      
      // Prüfe transformiertes File (mit Language-Suffix)
      if (transformedFile) {
        const hasFm = await hasFrontmatter(transformedFile, provider);
        if (hasFm) {
          transformed = transformedFile;
        } else {
          // Falls kein Frontmatter: Auch als Transcript behandeln (Rückwärtskompatibilität)
          if (!transcriptFile) {
            transcriptFiles = [transformedFile];
          }
        }
      }
      
      // Prüfe Transcript-File (ohne Language-Suffix)
      if (transcriptFile) {
        const hasFm = await hasFrontmatter(transcriptFile, provider);
        if (!hasFm) {
          // Transcript-File ohne Frontmatter
          transcriptFiles = transcriptFiles ? [...transcriptFiles, transcriptFile] : [transcriptFile];
        } else {
          // Falls doch Frontmatter vorhanden: Als transformed behandeln (ungewöhnlich, aber möglich)
          if (!transformed) {
            transformed = transcriptFile;
          }
        }
      }
      
      // FALLBACK: Wenn keine Dateien mit exaktem Namen gefunden wurden, aber Markdown-Dateien vorhanden sind,
      // versuche alle Markdown-Dateien zu prüfen (kann passieren, wenn Sprache nicht übereinstimmt)
      if (!transformed && !transcriptFiles && allMarkdownFiles.length > 0) {
        FileLogger.debug('analyzeShadowTwin', 'Keine Dateien mit exaktem Namen gefunden, prüfe alle Markdown-Dateien', {
          fileId,
          fileName: baseItem.metadata.name,
          expectedTransformedName: transformedName,
          expectedTranscriptName: transcriptName,
          foundMarkdownFiles: allMarkdownFiles.map(f => f.metadata.name)
        });
        
        // Prüfe alle Markdown-Dateien: Suche nach Dateien mit Frontmatter (transformed) oder ohne (transcript)
        for (const markdownFile of allMarkdownFiles) {
          const hasFm = await hasFrontmatter(markdownFile, provider);
          if (hasFm && !transformed) {
            // Erste Datei mit Frontmatter = transformed
            transformed = markdownFile;
            FileLogger.debug('analyzeShadowTwin', 'Markdown-Datei mit Frontmatter gefunden (als transformed)', {
              fileId,
              fileName: baseItem.metadata.name,
              foundFileName: markdownFile.metadata.name
            });
          } else if (!hasFm && !transformed) {
            // Datei ohne Frontmatter = transcript (nur wenn noch kein transformed gefunden)
            transcriptFiles = transcriptFiles ? [...transcriptFiles, markdownFile] : [markdownFile];
            FileLogger.debug('analyzeShadowTwin', 'Markdown-Datei ohne Frontmatter gefunden (als transcript)', {
              fileId,
              fileName: baseItem.metadata.name,
              foundFileName: markdownFile.metadata.name
            });
          }
        }
      }

      // Finde alle anderen Dateien im Verzeichnis (Bilder, etc.)
      // Bilder werden nicht separat gespeichert, da sie Teil des Shadow-Twin-Verzeichnisses sind

      // Für Audio/Video: Finde Media-Dateien
      if (isMediaFile(baseItem)) {
        mediaFiles = [baseItem];
      }
    } else {
      // 3b. Kein Shadow-Twin-Verzeichnis - prüfe auf Shadow-Twin-Markdown-Dateien im gleichen Verzeichnis
      const siblings = await provider.listItemsById(parentId);
      
      // Suche nach beiden Markdown-Varianten:
      // 1. Transformiertes File (mit Language-Suffix): document.de.md
      // 2. Transcript-File (ohne Language-Suffix): document.md
      const transformedName = generateShadowTwinName(baseItem.metadata.name, targetLanguage, false);
      const transcriptName = generateShadowTwinName(baseItem.metadata.name, targetLanguage, true);
      
      const transformedFile = siblings.find(
        item => item.type === 'file' && 
        item.metadata.name.toLowerCase() === transformedName.toLowerCase()
      );
      
      const transcriptFile = siblings.find(
        item => item.type === 'file' && 
        item.metadata.name.toLowerCase() === transcriptName.toLowerCase()
      );

      // Prüfe transformiertes File (mit Language-Suffix)
      if (transformedFile) {
        const hasFm = await hasFrontmatter(transformedFile, provider);
        if (hasFm) {
          transformed = transformedFile;
        } else {
          // Falls kein Frontmatter: Auch als Transcript behandeln (Rückwärtskompatibilität)
          if (!transcriptFile) {
            transcriptFiles = [transformedFile];
          }
        }
      }
      
      // Prüfe Transcript-File (ohne Language-Suffix)
      if (transcriptFile) {
        const hasFm = await hasFrontmatter(transcriptFile, provider);
        if (!hasFm) {
          // Transcript-File ohne Frontmatter
          transcriptFiles = transcriptFiles ? [...transcriptFiles, transcriptFile] : [transcriptFile];
        } else {
          // Falls doch Frontmatter vorhanden: Als transformed behandeln (ungewöhnlich, aber möglich)
          if (!transformed) {
            transformed = transcriptFile;
          }
        }
      }

      // Für Audio/Video: Finde Transcript-Dateien im gleichen Verzeichnis
      if (isMediaFile(baseItem)) {
        const transcripts = siblings.filter(
          item => isTranscriptFile(item, baseName)
        );
        if (transcripts.length > 0) {
          transcriptFiles = transcripts;
        }
        mediaFiles = [baseItem];
      }
    }

    // 4. Erstelle ShadowTwinState-Objekt
    const state: ShadowTwinState = {
      baseItem,
      transformed,
      transcriptFiles: transcriptFiles && transcriptFiles.length > 0 ? transcriptFiles : undefined,
      shadowTwinFolderId,
      mediaFiles: mediaFiles && mediaFiles.length > 0 ? mediaFiles : undefined,
      analysisTimestamp
    };

    FileLogger.debug('analyzeShadowTwin', 'ShadowTwinState erstellt', {
      fileId,
      fileName: baseItem.metadata.name,
      shadowTwinFolderId: state.shadowTwinFolderId,
      shadowTwinFolderIdType: typeof state.shadowTwinFolderId,
      shadowTwinFolderIdValue: state.shadowTwinFolderId,
      hasTransformed: !!state.transformed,
      hasTranscriptFiles: !!state.transcriptFiles && state.transcriptFiles.length > 0,
      transcriptFilesCount: state.transcriptFiles?.length || 0,
      stateKeys: Object.keys(state)
    });

    return state;
  } catch (error) {
    // Bei Fehlern: Erstelle State mit Fehlerinformation
    try {
      const baseItem = await provider.getItemById(fileId);
      return {
        baseItem: baseItem as StorageItem,
        analysisTimestamp,
        analysisError: error instanceof Error ? error.message : 'Unknown error during analysis'
      };
    } catch {
      // Wenn auch das Laden des baseItem fehlschlägt, geben wir null zurück
      return null;
    }
  }
}

