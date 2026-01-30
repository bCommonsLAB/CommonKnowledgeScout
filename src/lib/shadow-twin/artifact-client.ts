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
  /** Optional: Wenn true, werden beide Artefakt-Typen (transcript + transformation) zurückgegeben */
  includeBoth?: boolean;
  /** Optional: Wenn true, wird auch der Ingestion-Status geprüft */
  includeIngestionStatus?: boolean;
}

/**
 * Ingestion-Status für eine Quelle.
 */
export interface IngestionStatus {
  /** Ob das Dokument in der Story/Ingestion vorhanden ist */
  exists: boolean;
  /** Anzahl der Chunks */
  chunkCount?: number;
  /** Anzahl der Kapitel */
  chaptersCount?: number;
}

/**
 * Erweiterte Response für Bulk-Auflösung.
 */
export interface BatchResolveArtifactsClientResponse {
  /** Map von sourceId -> ResolvedArtifactWithItem (oder null wenn nicht gefunden) */
  artifacts: Map<string, ResolvedArtifactWithItem | null>;
  /** Map von sourceId -> Transcript-Artefakt (nur wenn includeBoth=true) */
  transcripts?: Map<string, ResolvedArtifactWithItem | null>;
  /** Map von sourceId -> Ingestion-Status (nur wenn includeIngestionStatus=true) */
  ingestionStatus?: Map<string, IngestionStatus>;
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
  // Nur 'transcript' und 'transformation' an den Logger übergeben (kein 'raw')
  const logKind = preferredKind === 'transcript' || preferredKind === 'transformation' ? preferredKind : undefined;
  logArtifactResolve('start', {
    sourceId,
    sourceName,
    kind: logKind,
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
    const url = `/api/library/${encodeURIComponent(libraryId)}/artifacts/resolve?${params.toString()}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      if (response.status === 404) {
        logArtifactResolve('not_found', {
          sourceId,
          sourceName,
        });
        return null;
      }
      // Versuche, serverseitige Fehlerdetails zu lesen (z.B. { error: "..." }).
      // Ohne das bleibt im Debug-Panel oft nur "HTTP 500", was die Analyse erschwert.
      let serverDetail: string | null = null;
      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const json = (await response.json().catch(() => null)) as { error?: unknown; code?: unknown } | null;
          if (json && (json.error !== undefined || json.code !== undefined)) {
            const errText = json.error instanceof Error ? json.error.message : (json.error !== undefined ? String(json.error) : '');
            const codeText = json.code !== undefined ? String(json.code) : '';
            serverDetail = [codeText ? `code=${codeText}` : null, errText || null].filter(Boolean).join(' ');
          }
        } else {
          const text = await response.text().catch(() => '');
          serverDetail = text ? text.slice(0, 500) : null;
        }
      } catch {
        // Ignoriere Detail-Parse-Fehler, wir haben Fallback unten.
      }

      const suffix = serverDetail ? ` - ${serverDetail}` : '';
      throw new Error(`HTTP ${response.status}: ${response.statusText}${suffix} (${url})`);
    }

    const data = await response.json() as { artifact: ResolvedArtifact | null };
    const artifact = data.artifact || null;

    // Logging: Ergebnis (client-seitig)
    if (artifact) {
      // Nur 'transcript' und 'transformation' an den Logger übergeben (kein 'raw')
      const artifactLogKind = artifact.kind === 'transcript' || artifact.kind === 'transformation' ? artifact.kind : undefined;
      logArtifactResolve('success', {
        sourceId,
        sourceName,
        kind: artifactLogKind,
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
    // Kein zusätzliches console.error hier:
    // - der FileLogger schreibt bereits in die Konsole
    // - doppelte Errors triggern unnötig das Next.js Error-Overlay
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
 * @returns Erweiterte Response mit Artefakten, Transcripts und Ingestion-Status
 */
export async function batchResolveArtifactsClient(
  options: BatchResolveArtifactsClientOptions
): Promise<BatchResolveArtifactsClientResponse> {
  const { libraryId, sources, preferredKind, includeBoth, includeIngestionStatus } = options;

  if (!sources || sources.length === 0) {
    return { artifacts: new Map() };
  }

  // Logging: Start (client-seitig)
  // Nur 'transcript' und 'transformation' an den Logger übergeben (kein 'raw')
  const batchLogKind = preferredKind === 'transcript' || preferredKind === 'transformation' ? preferredKind : undefined;
  logArtifactResolve('start', {
    sourceId: 'batch',
    sourceName: `Bulk-Auflösung für ${sources.length} Quellen`,
    kind: batchLogKind,
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
        includeBoth: includeBoth === true,
        includeIngestionStatus: includeIngestionStatus === true,
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

      const data = await response.json() as {
        artifacts: Record<string, ResolvedArtifactWithItem | null>;
        transcripts?: Record<string, ResolvedArtifactWithItem | null>;
        ingestionStatus?: Record<string, IngestionStatus>;
      };
      return {
        artifacts: data.artifacts || {},
        transcripts: data.transcripts,
        ingestionStatus: data.ingestionStatus,
      };
    });

    // Warte auf alle Batches und merge Ergebnisse
    const batchResults = await Promise.all(batchPromises);
    const artifacts: Record<string, ResolvedArtifactWithItem | null> = {};
    const transcripts: Record<string, ResolvedArtifactWithItem | null> = {};
    const ingestionStatus: Record<string, IngestionStatus> = {};
    
    for (const batchResult of batchResults) {
      Object.assign(artifacts, batchResult.artifacts);
      if (batchResult.transcripts) {
        Object.assign(transcripts, batchResult.transcripts);
      }
      if (batchResult.ingestionStatus) {
        Object.assign(ingestionStatus, batchResult.ingestionStatus);
      }
    }

    // Konvertiere zu Maps
    const artifactsMap = new Map<string, ResolvedArtifactWithItem | null>();
    for (const [sourceId, artifact] of Object.entries(artifacts)) {
      artifactsMap.set(sourceId, artifact);
    }

    const transcriptsMap = includeBoth ? new Map<string, ResolvedArtifactWithItem | null>() : undefined;
    if (includeBoth && transcriptsMap) {
      for (const [sourceId, transcript] of Object.entries(transcripts)) {
        transcriptsMap.set(sourceId, transcript);
      }
    }

    const ingestionStatusMap = includeIngestionStatus ? new Map<string, IngestionStatus>() : undefined;
    if (includeIngestionStatus && ingestionStatusMap) {
      for (const [sourceId, status] of Object.entries(ingestionStatus)) {
        ingestionStatusMap.set(sourceId, status);
      }
    }

    // Logging: Ergebnis (client-seitig)
    const resolvedCount = Array.from(artifactsMap.values()).filter(a => a !== null).length;
    logArtifactResolve('success', {
      sourceId: 'batch',
      sourceName: `Bulk-Auflösung abgeschlossen: ${resolvedCount}/${sources.length} gefunden (${batches.length} Batches)`,
    });

    FileLogger.debug('batchResolveArtifactsClient', 'Bulk-Auflösung erfolgreich abgeschlossen', {
      libraryId,
      totalSources: sources.length,
      resolvedCount,
      batchCount: batches.length,
      includeBoth,
      includeIngestionStatus,
    });

    const result: BatchResolveArtifactsClientResponse = {
      artifacts: artifactsMap,
    };
    if (includeBoth && transcriptsMap) {
      result.transcripts = transcriptsMap;
    }
    if (includeIngestionStatus && ingestionStatusMap) {
      result.ingestionStatus = ingestionStatusMap;
    }

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
    return {
      artifacts: new Map(),
    };
  }
}
