/**
 * @fileoverview Shadow-Twin Artefakt Logger - Zentrale Protokollierung
 * 
 * @description
 * Spezieller Logger für Shadow-Twin Resolver/Writer Events.
 * Protokolliert alle Events über FileLogger für das Debug-Panel.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - logArtifactResolve: Loggt Artefakt-Auflösung
 * - logArtifactWrite: Loggt Artefakt-Schreiben
 */

import { FileLogger } from '@/lib/debug/logger';

/**
 * Loggt eine Artefakt-Auflösung.
 */
export function logArtifactResolve(
  action: 'start' | 'success' | 'not_found' | 'error',
  options: {
    sourceId: string;
    sourceName: string;
    kind?: 'transcript' | 'transformation';
    location?: 'sibling' | 'dotFolder';
    fileName?: string;
    mode?: 'legacy' | 'v2';
    error?: string;
  }
) {
  // Protokollierung über FileLogger (erscheint im Debug-Panel)
  if (action === 'start') {
    FileLogger.debug('artifact-resolver', 'Artefakt-Auflösung gestartet', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      mode: options.mode,
      kind: options.kind,
    });
  } else if (action === 'success') {
    FileLogger.info('artifact-resolver', 'Artefakt gefunden', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      kind: options.kind,
      location: options.location,
      fileName: options.fileName,
      mode: options.mode,
    });
  } else if (action === 'not_found') {
    FileLogger.info('artifact-resolver', 'Artefakt nicht gefunden', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      mode: options.mode,
    });
  } else if (action === 'error') {
    FileLogger.error('artifact-resolver', 'Fehler bei Artefakt-Auflösung', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      error: options.error,
    });
  }
}

/**
 * Loggt ein Artefakt-Schreiben.
 */
export function logArtifactWrite(
  action: 'start' | 'success' | 'error',
  options: {
    sourceId: string;
    sourceName: string;
    kind: 'transcript' | 'transformation';
    location?: 'sibling' | 'dotFolder';
    fileName?: string;
    mode?: 'legacy' | 'v2';
    wasUpdated?: boolean;
    error?: string;
  }
) {
  // Protokollierung über FileLogger (erscheint im Debug-Panel)
  if (action === 'start') {
    FileLogger.debug('artifact-writer', 'Artefakt-Schreiben gestartet', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      kind: options.kind,
      mode: options.mode,
    });
  } else if (action === 'success') {
    FileLogger.info('artifact-writer', options.wasUpdated ? 'Artefakt aktualisiert' : 'Artefakt erstellt', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      kind: options.kind,
      location: options.location,
      fileName: options.fileName,
      mode: options.mode,
      wasUpdated: options.wasUpdated,
    });
  } else if (action === 'error') {
    FileLogger.error('artifact-writer', 'Fehler beim Artefakt-Schreiben', {
      sourceId: options.sourceId,
      sourceName: options.sourceName,
      error: options.error,
    });
  }
}

