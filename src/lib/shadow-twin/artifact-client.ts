/**
 * @fileoverview Shadow-Twin Artefakt Client - Frontend-Client für Artefakt-Auflösung
 * 
 * @description
 * Client-Wrapper für die serverseitige Artefakt-Auflösung.
 * Entkoppelt das Frontend von direkten Storage-Zugriffen und Shadow-Twin-Heuristiken.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - resolveArtifactClient: Client-Funktion zur Artefakt-Auflösung
 * - batchResolveArtifactsClient: Client-Funktion zur Bulk-Artefakt-Auflösung
 */

import type { ResolvedArtifact } from './artifact-resolver';
import type { ArtifactKind } from './artifact-types';
import { logArtifactResolve } from './artifact-logger';
import { FileLogger } from '@/lib/debug/logger';
import type { StorageItem } from '@/lib/storage/types';

/**
 * Optionen für die Client-seitige Artefakt-Auflösung.
 */
export interface ResolveArtifactClientOptions {
  /** Library-ID */
  libraryId: string;
  /** ID der Quelle (Storage-Item-ID) */
  sourceId: string;
  /** Vollständiger Dateiname der Quelle */
  sourceName: string;
  /** ID des Parent-Verzeichnisses */
  parentId: string;
  /** Zielsprache (z.B. 'de', 'en') */
  targetLanguage: string;
  /** Optional: Template-Name (für Transformation) */
  templateName?: string;
  /** Optional: Bevorzugte Art des Artefakts */
  preferredKind?: ArtifactKind;
}

/**
 * Optionen für die Bulk-Artefakt-Auflösung.
 */
export interface BatchResolveArtifactsClientOptions {
  /** Library-ID */
  libraryId: string;
  /** Array von Quellen, die aufgelöst werden sollen */
  sources: Array<{
    /** ID der Quelle (Storage-Item-ID) */
    sourceId: string;
    /** Vollständiger Dateiname der Quelle */
    sourceName: string;
    /** ID des Parent-Verzeichnisses */
    parentId: string;
    /** Optional: Zielsprache (Standard: 'de') */
    targetLanguage?: string;
  }>;
  /** Optional: Bevorzugte Art des Artefakts (Standard: 'transformation') */
  preferredKind?: ArtifactKind;
}

/**
 * Löst ein Shadow-Twin-Artefakt auf (Client-seitig).
 * 
 * @param options Auflösungsoptionen
 * @returns ResolvedArtifact oder null wenn nicht gefunden
 */
export async function resolveArtifactClient(
  options: ResolveArtifactClientOptions
): Promise<ResolvedArtifact | null> {
  const { libraryId, sourceId, sourceName, parentId, targetLanguage, templateName, preferredKind } = options;

  // Logging: Start (client-seitig)
  logArtifactResolve('start', {
    sourceId,
    sourceName,
    kind: preferredKind,
  });

  const params = new URLSearchParams({
    sourceId,
    sourceName,
    parentId,
    targetLanguage,
  });

  if (templateName) {
    params.set('templateName', templateName);
  }

  if (preferredKind) {
    params.set('preferredKind', preferredKind);
  }

  try {
    const response = await fetch(`/api/library/${libraryId}/artifacts/resolve?${params.toString()}`);

    if (!response.ok) {
      if (response.status === 404) {
        logArtifactResolve('not_found', {
          sourceId,
          sourceName,
        });
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { artifact: ResolvedArtifact | null };
    const artifact = data.artifact || null;

    // Logging: Ergebnis (client-seitig)
    if (artifact) {
      logArtifactResolve('success', {
        sourceId,
        sourceName,
        kind: artifact.kind,
        location: artifact.location,
        fileName: artifact.fileName,
      });
    } else {
      logArtifactResolve('not_found', {
        sourceId,
        sourceName,
      });
    }

    return artifact;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logArtifactResolve('error', {
      sourceId,
      sourceName,
      error: errorMsg,
    });
    console.error('Fehler bei Artefakt-Auflösung:', error);
    return null;
  }
}

/**
 * Erweiterte ResolvedArtifact mit vollständigem StorageItem.
 */
export interface ResolvedArtifactWithItem extends ResolvedArtifact {
  /** Vollständiges StorageItem-Objekt des Artefakts */
  item: StorageItem;
}

/**
 * Maximale Anzahl von Quellen pro Batch-Request (entspricht API-Limit).
 */
const MAX_SOURCES_PER_BATCH = 100;

/**
 * Löst mehrere Shadow-Twin-Artefakte auf einmal auf (Client-seitig).
 * 
 * Teilt automatisch große Anfragen in Batches von maximal 100 Quellen auf,
 * um das API-Limit zu respektieren.
 * 
 * @param options Bulk-Auflösungsoptionen
 * @returns Map von sourceId -> ResolvedArtifactWithItem (oder null wenn nicht gefunden)
 */
export async function batchResolveArtifactsClient(
  options: BatchResolveArtifactsClientOptions
): Promise<Map<string, ResolvedArtifactWithItem | null>> {
  const { libraryId, sources, preferredKind } = options;

  if (!sources || sources.length === 0) {
    return new Map();
  }

  // Logging: Start (client-seitig)
  logArtifactResolve('start', {
    sourceId: 'batch',
    sourceName: `Bulk-Auflösung für ${sources.length} Quellen`,
    kind: preferredKind,
  });

  try {
    // Teile Quellen in Batches von maximal MAX_SOURCES_PER_BATCH auf
    const batches: Array<typeof sources> = [];
    for (let i = 0; i < sources.length; i += MAX_SOURCES_PER_BATCH) {
      batches.push(sources.slice(i, i + MAX_SOURCES_PER_BATCH));
    }

    FileLogger.debug('batchResolveArtifactsClient', 'Teile Request in Batches auf', {
      libraryId,
      totalSources: sources.length,
      batchCount: batches.length,
      preferredKind: preferredKind || 'transformation',
    });

    // Sende alle Batches parallel
    const batchPromises = batches.map(async (batch, batchIndex) => {
      const requestBody = {
        sources: batch,
        preferredKind: preferredKind || 'transformation',
      };

      FileLogger.debug('batchResolveArtifactsClient', `Sende Batch ${batchIndex + 1}/${batches.length}`, {
        libraryId,
        batchSize: batch.length,
        batchIndex: batchIndex + 1,
        totalBatches: batches.length,
      });

      const response = await fetch(`/api/library/${libraryId}/artifacts/batch-resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // Versuche Error-Details aus Response zu extrahieren
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = `${errorMessage} - ${errorData.error}`;
          }
        } catch {
          // Ignoriere JSON-Parse-Fehler
        }
        
        FileLogger.error('batchResolveArtifactsClient', `Batch ${batchIndex + 1} fehlgeschlagen`, {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          batchSize: batch.length,
          batchIndex: batchIndex + 1,
        });
        
        throw new Error(`Batch ${batchIndex + 1}/${batches.length}: ${errorMessage}`);
      }

      const data = await response.json() as { artifacts: Record<string, ResolvedArtifactWithItem | null> };
      return data.artifacts || {};
    });

    // Warte auf alle Batches und merge Ergebnisse
    const batchResults = await Promise.all(batchPromises);
    const artifacts: Record<string, ResolvedArtifactWithItem | null> = {};
    
    for (const batchArtifacts of batchResults) {
      Object.assign(artifacts, batchArtifacts);
    }

    // Konvertiere zu Map
    const result = new Map<string, ResolvedArtifactWithItem | null>();
    for (const [sourceId, artifact] of Object.entries(artifacts)) {
      result.set(sourceId, artifact);
    }

    // Logging: Ergebnis (client-seitig)
    const resolvedCount = Array.from(result.values()).filter(a => a !== null).length;
    logArtifactResolve('success', {
      sourceId: 'batch',
      sourceName: `Bulk-Auflösung abgeschlossen: ${resolvedCount}/${sources.length} gefunden (${batches.length} Batches)`,
    });

    FileLogger.debug('batchResolveArtifactsClient', 'Bulk-Auflösung erfolgreich abgeschlossen', {
      libraryId,
      totalSources: sources.length,
      resolvedCount,
      batchCount: batches.length,
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logArtifactResolve('error', {
      sourceId: 'batch',
      sourceName: 'Bulk-Auflösung',
      error: errorMsg,
    });
    FileLogger.error('batchResolveArtifactsClient', 'Fehler bei Bulk-Artefakt-Auflösung', {
      libraryId,
      error: errorMsg,
      sourcesCount: sources.length,
    });
    console.error('Fehler bei Bulk-Artefakt-Auflösung:', error);
    return new Map();
  }
}
