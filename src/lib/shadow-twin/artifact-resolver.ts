/**
 * @fileoverview Shadow-Twin Artefakt Resolver - Zentrale Auflösungslogik
 * 
 * @description
 * Zentrale Funktion zum Finden von Shadow-Twin-Artefakten (Transkript oder Transformation).
 * Konsolidiert die bestehenden Heuristiken und nutzt die neuen Namenskonventionen für v2-Modus.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - resolveArtifact: Hauptfunktion zur Artefakt-Auflösung
 * - ResolvedArtifact: Ergebnis-Interface
 */

import type { StorageItem, StorageProvider } from '@/lib/storage/types';
import type { ArtifactKind } from './artifact-types';
import { findShadowTwinFolder } from '@/lib/storage/shadow-twin';
import { parseArtifactName, buildArtifactName } from './artifact-naming';
import { logArtifactResolve } from './artifact-logger';
import path from 'path';

/**
 * Ergebnis der Artefakt-Auflösung.
 */
export interface ResolvedArtifact {
  /** Art des Artefakts */
  kind: ArtifactKind;
  /** ID der gefundenen Datei */
  fileId: string;
  /** Dateiname der gefundenen Datei */
  fileName: string;
  /** Speicherort: 'sibling' (neben Source) oder 'dotFolder' (im Shadow-Twin-Verzeichnis) */
  location: 'sibling' | 'dotFolder';
  /** Optional: ID des Shadow-Twin-Verzeichnisses (nur wenn location === 'dotFolder') */
  shadowTwinFolderId?: string;
}

/**
 * Optionen für die Artefakt-Auflösung.
 */
export interface ResolveArtifactOptions {
  /** ID der Quelle (Storage-Item-ID) */
  sourceItemId: string;
  /** Vollständiger Dateiname der Quelle */
  sourceName: string;
  /** ID des Parent-Verzeichnisses */
  parentId: string;
  /** Zielsprache (z.B. 'de', 'en') */
  targetLanguage: string;
  /** Optional: Template-Name (nur bei Transformation) */
  templateName?: string;
  /** Optional: Art des gesuchten Artefakts (wenn bekannt) */
  preferredKind?: ArtifactKind;
}

/**
 * Löst ein Shadow-Twin-Artefakt auf (Transkript oder Transformation).
 * 
 * @param provider Storage-Provider
 * @param options Auflösungsoptionen
 * @returns ResolvedArtifact oder null wenn nicht gefunden
 */
export async function resolveArtifact(
  provider: StorageProvider,
  options: ResolveArtifactOptions
): Promise<ResolvedArtifact | null> {
  const { sourceItemId, sourceName, preferredKind } = options;

  // Logging: Start
  // Nur 'transcript' und 'transformation' an den Logger übergeben (kein 'raw')
  const logKind = preferredKind === 'transcript' || preferredKind === 'transformation' ? preferredKind : undefined;
  logArtifactResolve('start', {
    sourceId: sourceItemId,
    sourceName,
    kind: logKind,
  });

  let result: ResolvedArtifact | null = null;
  let error: string | undefined;

  try {
    // V2-Modus: Nutze neue Namenskonventionen
    result = await resolveArtifactV2(provider, options);

    // Logging: Ergebnis
    if (result) {
      // Nur 'transcript' und 'transformation' an den Logger übergeben (kein 'raw')
      const resultLogKind = result.kind === 'transcript' || result.kind === 'transformation' ? result.kind : undefined;
      logArtifactResolve('success', {
        sourceId: sourceItemId,
        sourceName,
        kind: resultLogKind,
        location: result.location,
        fileName: result.fileName,
      });
    } else {
      logArtifactResolve('not_found', {
        sourceId: sourceItemId,
        sourceName,
      });
    }

    return result;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    logArtifactResolve('error', {
      sourceId: sourceItemId,
      sourceName,
      error,
    });
    throw err;
  }
}

/**
 * V2-Auflösung mit neuen Namenskonventionen.
 */
async function resolveArtifactV2(
  provider: StorageProvider,
  options: ResolveArtifactOptions
): Promise<ResolvedArtifact | null> {
  const { sourceItemId, sourceName, parentId, targetLanguage, templateName, preferredKind } = options;
  // WICHTIG:
  // Der Basisname der Quelle muss ohne Extension übergeben werden (z.B. "audio" statt "audio.mp3"),
  // damit parseArtifactName() Transformationen korrekt erkennt und BaseNames mit Punkten stabil bleiben.
  const sourceBaseName = path.parse(sourceName).name;

  // Bestimme ArtifactKind
  const kind: ArtifactKind = preferredKind || (templateName ? 'transformation' : 'transcript');

  // Verwende zentrale buildArtifactName() Funktion für konsistente Namensgenerierung
  const expectedFileName = kind === 'transformation'
    ? (templateName
      ? buildArtifactName({ sourceId: sourceItemId, kind: 'transformation', targetLanguage, templateName }, sourceName)
      : null)
    : buildArtifactName({ sourceId: sourceItemId, kind: 'transcript', targetLanguage }, sourceName);

  /**
   * WICHTIG (v2): Transformationen benötigen i.d.R. `templateName` (Dateiformat: base.template.lang.md).
   * UI-Calls (z.B. FileList/Bulk) kennen `templateName` aber nicht immer.
   * Daher unterstützen wir hier "template-agnostische" Auflösung:
   * - wenn kind === 'transformation' und templateName fehlt, wählen wir die "beste" passende Transformation
   *   (aktuell: neueste `modifiedAt`, fallback: lexikographischer Name).
   */
  function pickBestTransformation(items: StorageItem[]): StorageItem | null {
    const candidates: StorageItem[] = [];
    for (const item of items) {
      if (item.type !== 'file') continue;
      if (!item.metadata.name.toLowerCase().endsWith('.md')) continue;
      const parsed = parseArtifactName(item.metadata.name, sourceBaseName);
      if (parsed.kind !== 'transformation') continue;
      if (parsed.targetLanguage !== targetLanguage) continue;
      candidates.push(item);
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const asTime = (value: unknown): number => {
      if (value instanceof Date) return value.getTime();
      if (typeof value === 'string') {
        const t = new Date(value).getTime();
        return Number.isFinite(t) ? t : 0;
      }
      return 0;
    };

    // Neueste zuerst; bei Gleichstand: Name stabil sortieren
    candidates.sort((a, b) => {
      const at = asTime(a.metadata.modifiedAt);
      const bt = asTime(b.metadata.modifiedAt);
      if (bt !== at) return bt - at;
      return a.metadata.name.localeCompare(b.metadata.name);
    });

    return candidates[0];
  }

  // 1. Prüfe Shadow-Twin-Verzeichnis (falls vorhanden)
  // PERFORMANCE: findShadowTwinFolder nutzt bereits den gecachten Provider
  const shadowTwinFolder = await findShadowTwinFolder(parentId, sourceName, provider);
  if (shadowTwinFolder) {
    // PERFORMANCE: provider.listItemsById wird durch cachedProvider gecacht
    const items = await provider.listItemsById(shadowTwinFolder.id);
    const artifactFile = expectedFileName
      ? items.find(item => item.type === 'file' && item.metadata.name === expectedFileName)
      : (kind === 'transformation' ? pickBestTransformation(items) : null);

    if (artifactFile) {
      // Prüfe ob der Dateiname zur erwarteten Semantik passt
      const parsed = parseArtifactName(artifactFile.metadata.name, sourceBaseName);
      if (parsed.kind === kind && parsed.targetLanguage === targetLanguage) {
        return {
          kind,
          fileId: artifactFile.id,
          fileName: artifactFile.metadata.name,
          location: 'dotFolder',
          shadowTwinFolderId: shadowTwinFolder.id,
        };
      }
    }
  }

  // 2. Fallback: Suche als Sibling-Datei
  const siblings = await provider.listItemsById(parentId);
  const artifactFile = expectedFileName
    ? siblings.find(item => item.type === 'file' && item.metadata.name === expectedFileName)
    : (kind === 'transformation' ? pickBestTransformation(siblings) : null);

  if (artifactFile) {
    const parsed = parseArtifactName(artifactFile.metadata.name, sourceBaseName);
    if (parsed.kind === kind && parsed.targetLanguage === targetLanguage) {
      return {
        kind,
        fileId: artifactFile.id,
        fileName: artifactFile.metadata.name,
        location: 'sibling',
      };
    }
  }

  return null;
}

