/**
 * @fileoverview API-Route für Bulk-Artefakt-Auflösung
 * 
 * @description
 * Serverseitige Route zum Auflösen mehrerer Shadow-Twin-Artefakte auf einmal.
 * Optimiert für file-list.tsx, um viele Artefakte in einem Request zu lösen.
 * 
 * @module api/library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import { getServerProvider } from '@/lib/storage/server-provider';
import { resolveArtifact, type ResolvedArtifact } from '@/lib/shadow-twin/artifact-resolver';
import { LibraryService } from '@/lib/services/library-service';
import type { StorageItem } from '@/lib/storage/types';

/**
 * Request-Body für Bulk-Auflösung.
 */
export interface BatchResolveRequest {
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
  preferredKind?: 'transcript' | 'transformation';
}

/**
 * Erweiterte ResolvedArtifact mit vollständigem StorageItem.
 */
export interface ResolvedArtifactWithItem extends ResolvedArtifact {
  /** Vollständiges StorageItem-Objekt des Artefakts */
  item: StorageItem;
}

/**
 * Response für Bulk-Auflösung.
 */
export interface BatchResolveResponse {
  /** Map von sourceId -> ResolvedArtifactWithItem (oder null wenn nicht gefunden) */
  artifacts: Record<string, ResolvedArtifactWithItem | null>;
}

/**
 * POST /api/library/[libraryId]/artifacts/batch-resolve
 * 
 * Löst mehrere Shadow-Twin-Artefakte auf einmal auf.
 * 
 * Body:
 * - sources: Array von { sourceId, sourceName, parentId, targetLanguage? }
 * - preferredKind?: 'transcript' | 'transformation'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) {
      return NextResponse.json({ error: 'User-Email unbekannt' }, { status: 400 });
    }

    const { libraryId } = await params;
    let body: BatchResolveRequest;
    
    try {
      body = await request.json() as BatchResolveRequest;
    } catch (parseError) {
      FileLogger.error('artifacts/batch-resolve', 'Fehler beim Parsen des Request-Bodies', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return NextResponse.json(
        { error: 'Ungültiger JSON-Body' },
        { status: 400 }
      );
    }

    if (!body.sources || !Array.isArray(body.sources) || body.sources.length === 0) {
      FileLogger.error('artifacts/batch-resolve', 'sources Array fehlt oder ist leer', {
        hasSources: !!body.sources,
        isArray: Array.isArray(body.sources),
        length: body.sources?.length,
      });
      return NextResponse.json(
        { error: 'sources Array ist erforderlich und darf nicht leer sein' },
        { status: 400 }
      );
    }

    // Validierung: Prüfe ob alle Sources die erforderlichen Felder haben
    const invalidSources = body.sources.filter(
      (source) => !source.sourceId || !source.sourceName || !source.parentId
    );
    if (invalidSources.length > 0) {
      FileLogger.error('artifacts/batch-resolve', 'Ungültige Sources gefunden', {
        invalidCount: invalidSources.length,
        invalidSources: invalidSources.map(s => ({
          hasSourceId: !!s.sourceId,
          hasSourceName: !!s.sourceName,
          hasParentId: !!s.parentId,
        })),
      });
      return NextResponse.json(
        { error: `Ungültige Sources gefunden: ${invalidSources.length} Sources fehlen erforderliche Felder (sourceId, sourceName, parentId)` },
        { status: 400 }
      );
    }

    // Limit: Maximal 100 Items pro Request (verhindert Timeouts)
    if (body.sources.length > 100) {
      return NextResponse.json(
        { error: 'Maximal 100 Quellen pro Request erlaubt' },
        { status: 400 }
      );
    }

    // Lade Library für Mode-Detection
    const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId);
    if (!library) {
      return NextResponse.json({ error: 'Bibliothek nicht gefunden' }, { status: 404 });
    }

    const provider = await getServerProvider(userEmail, libraryId);
    const preferredKind = body.preferredKind || 'transformation';

    // Löse alle Artefakte parallel auf und hole vollständige StorageItem-Objekte
    const resolvePromises = body.sources.map(async (source) => {
      try {
        const resolved = await resolveArtifact(provider, {
          sourceItemId: source.sourceId,
          sourceName: source.sourceName,
          parentId: source.parentId,
          targetLanguage: source.targetLanguage || 'de',
          preferredKind,
        });

        if (!resolved) {
          return { sourceId: source.sourceId, artifact: null };
        }

        // Hole vollständiges StorageItem-Objekt für das Artefakt
        try {
          const artifactItem = await provider.getItemById(resolved.fileId);
          if (!artifactItem) {
            FileLogger.warn('artifacts/batch-resolve', 'Artefakt-Item nicht gefunden', {
              sourceId: source.sourceId,
              fileId: resolved.fileId,
            });
            return { sourceId: source.sourceId, artifact: null };
          }

          return {
            sourceId: source.sourceId,
            artifact: {
              ...resolved,
              item: artifactItem,
            } as ResolvedArtifactWithItem,
          };
        } catch (itemError) {
          FileLogger.error('artifacts/batch-resolve', 'Fehler beim Laden des Artefakt-Items', {
            sourceId: source.sourceId,
            fileId: resolved.fileId,
            error: itemError instanceof Error ? itemError.message : String(itemError),
          });
          return { sourceId: source.sourceId, artifact: null };
        }
      } catch (error) {
        FileLogger.error('artifacts/batch-resolve', 'Fehler bei Artefakt-Auflösung', {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          error: error instanceof Error ? error.message : String(error),
        });
        return { sourceId: source.sourceId, artifact: null };
      }
    });

    const results = await Promise.all(resolvePromises);

    // Konvertiere zu Record für einfachen Zugriff
    const artifacts: Record<string, ResolvedArtifactWithItem | null> = {};
    for (const result of results) {
      artifacts[result.sourceId] = result.artifact;
    }

    FileLogger.debug('artifacts/batch-resolve', 'Bulk-Auflösung abgeschlossen', {
      libraryId,
      totalSources: body.sources.length,
      resolvedCount: Object.values(artifacts).filter(a => a !== null).length,
    });

    return NextResponse.json({ artifacts }, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('artifacts/batch-resolve', 'Fehler bei Bulk-Artefakt-Auflösung', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

