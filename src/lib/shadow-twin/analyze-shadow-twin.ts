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
  findShadowTwinFolder
} from '@/lib/storage/shadow-twin';
import { resolveArtifact } from '@/lib/shadow-twin/artifact-resolver';
import { extractBaseName, parseArtifactName } from '@/lib/shadow-twin/artifact-naming';

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
  const itemBaseName = extractBaseName(item.metadata.name);
  return itemBaseName.toLowerCase() === baseName.toLowerCase();
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

    const baseName = extractBaseName(baseItem.metadata.name);
    const parentId = baseItem.parentId;
    const targetLanguage = 'de'; // Standard-Sprache, könnte später aus Kontext kommen

    // 2. Prüfe auf Shadow-Twin-Verzeichnis
    const shadowTwinFolder = await findShadowTwinFolder(
      parentId,
      baseItem.metadata.name,
      provider
    );


    let transformed: StorageItem | undefined;
    let transcriptFiles: StorageItem[] | undefined;
    let mediaFiles: StorageItem[] | undefined;
    const shadowTwinFolderId = shadowTwinFolder?.id;


    if (shadowTwinFolder) {
      // 3a. Shadow-Twin-Verzeichnis gefunden - lade Inhalt
      const folderItems = await provider.listItemsById(shadowTwinFolder.id);
      
      // Suche nach Markdown-Dateien im Shadow-Twin-Verzeichnis
      // v2-only: Wir klassifizieren ausschließlich über `parseArtifactName()` (keine Frontmatter-Heuristik,
      // keine Legacy-Fallback-Namen wie `${baseName}.md`).
      const allMarkdownFiles = folderItems.filter(item => isMarkdownFile(item));

      // Bei mehreren Transformationen: wähle stabil „beste“ (neueste modifiedAt, dann Name)
      const transformations: StorageItem[] = []
      for (const markdownFile of allMarkdownFiles) {
        const parsed = parseArtifactName(markdownFile.metadata.name, baseName)
        if (parsed.kind === 'transformation') transformations.push(markdownFile)
        if (parsed.kind === 'transcript') {
          transcriptFiles = transcriptFiles ? [...transcriptFiles, markdownFile] : [markdownFile]
        }
      }

      if (transformations.length > 0) {
        const asTime = (value: unknown): number => {
          if (value instanceof Date) return value.getTime()
          if (typeof value === 'string') {
            const t = new Date(value).getTime()
            return Number.isFinite(t) ? t : 0
          }
          return 0
        }
        transformations.sort((a, b) => {
          const at = asTime(a.metadata.modifiedAt)
          const bt = asTime(b.metadata.modifiedAt)
          if (bt !== at) return bt - at
          return a.metadata.name.localeCompare(b.metadata.name)
        })
        transformed = transformations[0]
      }

      // Finde alle anderen Dateien im Verzeichnis (Bilder, etc.)
      // Bilder werden nicht separat gespeichert, da sie Teil des Shadow-Twin-Verzeichnisses sind

      // Für Audio/Video: Finde Media-Dateien
      if (isMediaFile(baseItem)) {
        mediaFiles = [baseItem];
      }
    } else {
      // 3b. Kein Shadow-Twin-Verzeichnis - prüfe auf Shadow-Twin-Markdown-Dateien im gleichen Verzeichnis
      // Nutze zentrale resolveArtifact() Logik
      const resolvedTranscript = await resolveArtifact(provider, {
        sourceItemId: baseItem.id,
        sourceName: baseItem.metadata.name,
        parentId: parentId,
        targetLanguage,
        preferredKind: 'transcript',
      });
      
      const resolvedTransformation = await resolveArtifact(provider, {
        sourceItemId: baseItem.id,
        sourceName: baseItem.metadata.name,
        parentId: parentId,
        targetLanguage,
        preferredKind: 'transformation',
      });
      
      // v2-only: wir laden die Items nur, um IDs/Metadaten im State zu haben.
      const transcriptFile = resolvedTranscript 
        ? await provider.getItemById(resolvedTranscript.fileId).catch(() => undefined)
        : undefined;
      
      const transformedFile = resolvedTransformation
        ? await provider.getItemById(resolvedTransformation.fileId).catch(() => undefined)
        : undefined;

      if (transformedFile) {
        transformed = transformedFile;
      }
      
      if (transcriptFile) {
        transcriptFiles = transcriptFiles ? [...transcriptFiles, transcriptFile] : [transcriptFile];
      }

      // Für Audio/Video: Finde Transcript-Dateien im gleichen Verzeichnis
      if (isMediaFile(baseItem)) {
        // Suche nach Transcript-Dateien im Parent-Verzeichnis (nicht im Shadow-Twin-Verzeichnis)
        const parentItems = await provider.listItemsById(parentId);
        const transcripts = parentItems.filter(
          (item): item is StorageItem => item.type === 'file' && isTranscriptFile(item, baseName)
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

