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
import { extractFrontmatterBlock } from '@/lib/markdown/frontmatter';
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
 * @param mode Optional: Shadow-Twin-Modus ('legacy' oder 'v2'), Default: 'legacy'
 * @returns ShadowTwinState-Objekt oder null bei Fehler
 */
export async function analyzeShadowTwin(
  fileId: string,
  provider: StorageProvider,
  mode: 'legacy' | 'v2' = 'legacy'
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
      // Nutze zentrale parseArtifactName() Funktion für robuste Erkennung
      const allMarkdownFiles = folderItems.filter(item => isMarkdownFile(item));
      
      // Prüfe alle Markdown-Dateien: Suche nach Dateien mit Frontmatter (transformed) oder ohne (transcript)
      // Nutze parseArtifactName() für konsistente Erkennung statt manueller Pattern-Matching
      for (const markdownFile of allMarkdownFiles) {
        const fileName = markdownFile.metadata.name;
        const hasFm = await hasFrontmatter(markdownFile, provider);
        
        // Nutze zentrale parseArtifactName() Funktion für robuste Erkennung
        const parsed = parseArtifactName(fileName, baseName);
        const isTransformedByParsing = parsed.kind === 'transformation';
        const isTranscriptByParsing = parsed.kind === 'transcript';
        
        // Priorität: Frontmatter-Prüfung (zuverlässiger) > Parsing-Ergebnis
        if (hasFm) {
          // Datei mit Frontmatter = transformed
          if (!transformed) {
            transformed = markdownFile;
          }
        } else if (isTranscriptByParsing || (!isTransformedByParsing && !hasFm)) {
          // Datei ohne Frontmatter und als Transcript erkannt (oder nicht als Transformation)
          // Oder: Datei ohne Frontmatter und nicht als Transformation erkannt = transcript
          transcriptFiles = transcriptFiles ? [...transcriptFiles, markdownFile] : [markdownFile];
        }
      }
      
      // Legacy-Fallback: Suche nach Transcript-File mit manuellen Namen (für Rückwärtskompatibilität)
      // WICHTIG: baseName kann Punkte enthalten (z.B. "vs.") – daher keine path.parse()-basierte Namensgenerierung.
      const transcriptName = `${baseName}.md`;
      const transcriptWithLangName = `${baseName}.${targetLanguage}.md`;
      const transcriptFile = folderItems.find(
        item => item.type === 'file' && 
        (item.metadata.name === transcriptName || item.metadata.name === transcriptWithLangName)
      );
      
      // Falls kein transformed gefunden wurde, aber transcriptFile existiert, prüfe es nochmal
      if (!transformed && transcriptFile) {
        const hasFm = await hasFrontmatter(transcriptFile, provider);
        if (hasFm) {
          // Falls doch Frontmatter vorhanden: Als transformed behandeln (ungewöhnlich, aber möglich)
          transformed = transcriptFile;
          // Entferne aus transcriptFiles falls vorhanden
          transcriptFiles = transcriptFiles?.filter(f => f.id !== transcriptFile.id);
        } else if (!transcriptFiles || !transcriptFiles.find(f => f.id === transcriptFile.id)) {
          // Transcript-File ohne Frontmatter
          transcriptFiles = transcriptFiles ? [...transcriptFiles, transcriptFile] : [transcriptFile];
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
      // Nutze zentrale resolveArtifact() Logik
      const resolvedTranscript = await resolveArtifact(provider, {
        sourceItemId: baseItem.id,
        sourceName: baseItem.metadata.name,
        parentId: parentId,
        mode,
        targetLanguage,
        preferredKind: 'transcript',
      });
      
      const resolvedTransformation = await resolveArtifact(provider, {
        sourceItemId: baseItem.id,
        sourceName: baseItem.metadata.name,
        parentId: parentId,
        mode,
        targetLanguage,
        preferredKind: 'transformation',
      });
      
      // Lade Dateien für Frontmatter-Prüfung
      const transcriptFile = resolvedTranscript 
        ? await provider.getItemById(resolvedTranscript.fileId).catch(() => undefined)
        : undefined;
      
      const transformedFile = resolvedTransformation
        ? await provider.getItemById(resolvedTransformation.fileId).catch(() => undefined)
        : undefined;

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

