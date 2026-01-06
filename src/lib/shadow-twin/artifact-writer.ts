/**
 * @fileoverview Shadow-Twin Artefakt Writer - Zentrale Schreiblogik
 * 
 * @description
 * Zentrale Funktion zum Schreiben von Shadow-Twin-Artefakten (Transkript oder Transformation).
 * Nutzt deterministische Namenskonventionen und dedupliziert: Ziel existiert → überschreiben (Update statt Duplikat).
 * 
 * @module shadow-twin
 * 
 * @exports
 * - writeArtifact: Hauptfunktion zum Schreiben von Artefakten
 * - WriteArtifactOptions: Optionen-Interface
 * - WriteArtifactResult: Ergebnis-Interface
 */

import type { StorageProvider } from '@/lib/storage/types';
import type { StorageItem } from '@/lib/storage/types';
import type { ArtifactKey } from './artifact-types';
import { buildArtifactName } from './artifact-naming';
import { findShadowTwinFolder, generateShadowTwinFolderName } from '@/lib/storage/shadow-twin';
import { FileLogger } from '@/lib/debug/logger';
import { logArtifactWrite } from './artifact-logger';

/**
 * Optionen für das Schreiben eines Artefakts.
 */
export interface WriteArtifactOptions {
  /** ArtifactKey mit sourceId, kind, targetLanguage, optional templateName */
  key: ArtifactKey;
  /** Vollständiger Dateiname der Quelle */
  sourceName: string;
  /** ID des Parent-Verzeichnisses */
  parentId: string;
  /** Markdown-Inhalt des Artefakts */
  content: string;
  /** Optional: Soll ein Shadow-Twin-Verzeichnis erstellt werden (für komplexe Medien) */
  createFolder?: boolean;
}

/**
 * Ergebnis des Schreibens eines Artefakts.
 */
export interface WriteArtifactResult {
  /** Geschriebene Datei */
  file: StorageItem;
  /** Speicherort: 'sibling' (neben Source) oder 'dotFolder' (im Shadow-Twin-Verzeichnis) */
  location: 'sibling' | 'dotFolder';
  /** Optional: ID des Shadow-Twin-Verzeichnisses (nur wenn location === 'dotFolder') */
  shadowTwinFolderId?: string;
  /** War die Datei bereits vorhanden und wurde überschrieben? */
  wasUpdated: boolean;
}

/**
 * Schreibt ein Shadow-Twin-Artefakt (Transkript oder Transformation).
 * 
 * @param provider Storage-Provider
 * @param options Schreiboptionen
 * @returns WriteArtifactResult mit Details zur geschriebenen Datei
 */
export async function writeArtifact(
  provider: StorageProvider,
  options: WriteArtifactOptions
): Promise<WriteArtifactResult> {
  const { key, sourceName, parentId, content, createFolder } = options;

  // Logging: Start
  logArtifactWrite('start', {
    sourceId: key.sourceId,
    sourceName,
    kind: key.kind,
  });

  let result: WriteArtifactResult;
  let error: string | undefined;

  try {
    // V2-Modus: Nutze neue Namenskonventionen und deterministische Deduplizierung
    result = await writeArtifactV2(provider, options);

    // Logging: Erfolg
    logArtifactWrite('success', {
      sourceId: key.sourceId,
      sourceName,
      kind: key.kind,
      location: result.location,
      fileName: result.file.metadata.name,
      wasUpdated: result.wasUpdated,
    });

    return result;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    logArtifactWrite('error', {
      sourceId: key.sourceId,
      sourceName,
      kind: key.kind,
      error,
    });
    throw err;
  }
}

/**
 * V2-Schreiben mit neuen Namenskonventionen und deterministischer Deduplizierung.
 */
async function writeArtifactV2(
  provider: StorageProvider,
  options: WriteArtifactOptions
): Promise<WriteArtifactResult> {
  const { key, sourceName, parentId, content, createFolder } = options;

  // Generiere deterministischen Dateinamen aus ArtifactKey
  const fileName = buildArtifactName(key, sourceName);

  // Entscheide: Shadow-Twin-Verzeichnis oder Sibling-Datei?
  const shouldUseFolder = createFolder || false; // Kann später erweitert werden (z.B. bei Bildern)

  if (shouldUseFolder) {
    // 1. Finde oder erstelle Shadow-Twin-Verzeichnis
    let shadowTwinFolder = await findShadowTwinFolder(parentId, sourceName, provider);
    
    if (!shadowTwinFolder) {
      const folderName = generateShadowTwinFolderName(sourceName);
      shadowTwinFolder = await provider.createFolder(parentId, folderName);
      FileLogger.info('artifact-writer', 'Shadow-Twin-Verzeichnis erstellt', {
        folderId: shadowTwinFolder.id,
        folderName: shadowTwinFolder.metadata.name,
      });
    }

    // 2. Prüfe ob Datei bereits existiert (deterministischer Name)
    const items = await provider.listItemsById(shadowTwinFolder.id);
    const existingFile = items.find(
      item => item.type === 'file' && item.metadata.name === fileName
    );

    if (existingFile) {
      // Datei existiert → Überschreiben (Update statt Duplikat)
      FileLogger.info('artifact-writer', 'Artefakt existiert bereits, überschreibe', {
        fileId: existingFile.id,
        fileName,
        location: 'dotFolder',
      });

      // WICHTIG: Viele Provider unterstützen kein "overwrite-by-id".
      // Um Duplikate zu verhindern, löschen wir die bestehende Datei und laden sie neu hoch.
      await provider.deleteItem(existingFile.id)

      // Erstelle neuen Blob mit aktualisiertem Inhalt
      const fileBlob = new Blob([content], { type: 'text/markdown' });
      const file = new File([fileBlob], fileName, { type: 'text/markdown' });

      // Upload überschreibt die Datei (Provider-spezifisch)
      const updatedFile = await provider.uploadFile(shadowTwinFolder.id, file);

      return {
        file: updatedFile,
        location: 'dotFolder',
        shadowTwinFolderId: shadowTwinFolder.id,
        wasUpdated: true,
      };
    } else {
      // Neue Datei erstellen
      const fileBlob = new Blob([content], { type: 'text/markdown' });
      const file = new File([fileBlob], fileName, { type: 'text/markdown' });

      const newFile = await provider.uploadFile(shadowTwinFolder.id, file);

      FileLogger.info('artifact-writer', 'Neues Artefakt im Verzeichnis erstellt', {
        fileId: newFile.id,
        fileName,
        location: 'dotFolder',
      });

      return {
        file: newFile,
        location: 'dotFolder',
        shadowTwinFolderId: shadowTwinFolder.id,
        wasUpdated: false,
      };
    }
  } else {
    // Sibling-Datei: Speichere neben der Quelle
    const siblings = await provider.listItemsById(parentId);
    const existingFile = siblings.find(
      item => item.type === 'file' && item.metadata.name === fileName
    );

    if (existingFile) {
      // Datei existiert → Überschreiben
      FileLogger.info('artifact-writer', 'Artefakt existiert bereits, überschreibe', {
        fileId: existingFile.id,
        fileName,
        location: 'sibling',
      });

      // WICHTIG: Viele Provider unterstützen kein "overwrite-by-id".
      // Um Duplikate zu verhindern, löschen wir die bestehende Datei und laden sie neu hoch.
      await provider.deleteItem(existingFile.id)

      const fileBlob = new Blob([content], { type: 'text/markdown' });
      const file = new File([fileBlob], fileName, { type: 'text/markdown' });

      const updatedFile = await provider.uploadFile(parentId, file);

      return {
        file: updatedFile,
        location: 'sibling',
        wasUpdated: true,
      };
    } else {
      // Neue Datei erstellen
      const fileBlob = new Blob([content], { type: 'text/markdown' });
      const file = new File([fileBlob], fileName, { type: 'text/markdown' });

      const newFile = await provider.uploadFile(parentId, file);

      FileLogger.info('artifact-writer', 'Neues Artefakt als Sibling erstellt', {
        fileId: newFile.id,
        fileName,
        location: 'sibling',
      });

      return {
        file: newFile,
        location: 'sibling',
        wasUpdated: false,
      };
    }
  }
}

