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

    // PERFORMANCE-OPTIMIERUNG: Cache für listItemsById-Aufrufe
    // Viele Quellen haben den gleichen parentId - vermeide doppelte Storage-Calls
    const folderItemsCache = new Map<string, StorageItem[]>();
    const cacheStartTime = performance.now();

    // Preload: Lade alle benötigten Ordner-Inhalte einmalig
    const uniqueParentIds = Array.from(new Set(body.sources.map(s => s.parentId)));
    const preloadPromises = uniqueParentIds.map(async (parentId) => {
      try {
        const items = await provider.listItemsById(parentId);
        folderItemsCache.set(parentId, items);
      } catch (error) {
        FileLogger.warn('artifacts/batch-resolve', 'Fehler beim Preload von Ordner-Inhalten', {
          parentId,
          error: error instanceof Error ? error.message : String(error),
        });
        folderItemsCache.set(parentId, []); // Leeres Array als Fallback
      }
    });
    await Promise.all(preloadPromises);
    const cacheDuration = performance.now() - cacheStartTime;
    FileLogger.info('artifacts/batch-resolve', 'Ordner-Cache geladen', {
      uniqueParentIds: uniqueParentIds.length,
      cacheDuration: `${cacheDuration.toFixed(2)}ms`,
      avgTimePerFolder: uniqueParentIds.length > 0 ? `${(cacheDuration / uniqueParentIds.length).toFixed(2)}ms` : '0ms',
    });

    // Erstelle einen optimierten Resolver mit Cache
    const resolveArtifactWithCache = async (
      source: typeof body.sources[0]
    ): Promise<{ sourceId: string; artifact: ResolvedArtifactWithItem | null }> => {
      try {
        // Verwende gecachte Ordner-Inhalte statt direkter Storage-Calls
        const cachedSiblings = folderItemsCache.get(source.parentId) || [];
        
        // Erstelle einen temporären Provider-Wrapper, der den Cache nutzt
        // PERFORMANCE: Alle listItemsById-Aufrufe werden gecacht
        const cachedProvider = {
          ...provider,
          listItemsById: async (folderId: string): Promise<StorageItem[]> => {
            // Prüfe Cache zuerst
            if (folderItemsCache.has(folderId)) {
              return folderItemsCache.get(folderId)!;
            }
            // Lade und cache für zukünftige Verwendung
            const items = await provider.listItemsById(folderId);
            folderItemsCache.set(folderId, items);
            return items;
          },
        } as StorageProvider;

        const resolved = await resolveArtifact(cachedProvider, {
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
        // OPTIMIERUNG: Versuche zuerst aus Cache zu holen
        const cachedItem = cachedSiblings.find(item => item.id === resolved.fileId);
        let artifactItem: StorageItem | null = cachedItem || null;
        
        if (!artifactItem) {
          try {
            artifactItem = await provider.getItemById(resolved.fileId);
          } catch (itemError) {
            FileLogger.warn('artifacts/batch-resolve', 'Artefakt-Item nicht gefunden', {
              sourceId: source.sourceId,
              fileId: resolved.fileId,
              error: itemError instanceof Error ? itemError.message : String(itemError),
            });
            return { sourceId: source.sourceId, artifact: null };
          }
        }

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
      } catch (error) {
        FileLogger.error('artifacts/batch-resolve', 'Fehler bei Artefakt-Auflösung', {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          error: error instanceof Error ? error.message : String(error),
        });
        return { sourceId: source.sourceId, artifact: null };
      }
    };

    // Löse alle Artefakte parallel auf (nutzt jetzt Cache)
    const resolveStartTime = performance.now();
    const resolvePromises = body.sources.map(resolveArtifactWithCache);
    const results = await Promise.all(resolvePromises);
    const resolveDuration = performance.now() - resolveStartTime;
    
    FileLogger.info('artifacts/batch-resolve', 'Artefakt-Auflösung abgeschlossen', {
      totalSources: body.sources.length,
      resolveDuration: `${resolveDuration.toFixed(2)}ms`,
      cacheHits: uniqueParentIds.length,
      cacheSize: folderItemsCache.size,
      avgTimePerSource: `${(resolveDuration / body.sources.length).toFixed(2)}ms`,
    });

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

