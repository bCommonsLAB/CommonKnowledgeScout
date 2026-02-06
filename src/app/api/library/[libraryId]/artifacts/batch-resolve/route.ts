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
import type { StorageItem, StorageProvider } from '@/lib/storage/types';
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config';
import { getShadowTwinsBySourceIds } from '@/lib/repositories/shadow-twin-repo';
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select';
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming';
import { buildMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id';
import { getCollectionNameForLibrary, getByFileIds } from '@/lib/repositories/vector-repo';

/**
 * Extrahiert ListMeta aus Transformations-Frontmatter für die Dateiliste.
 * Unterstützt title/titel, number/massnahme_nr/nummer, coverImageUrl und coverThumbnailUrl.
 * coverThumbnailUrl wird in der Dateiliste bevorzugt (kleinere Ladegröße).
 */
function listMetaFromFrontmatter(frontmatter: Record<string, unknown> | undefined): ListMeta | undefined {
  if (!frontmatter || typeof frontmatter !== 'object') return undefined;
  const title =
    (frontmatter.title as string) ??
    (frontmatter.titel as string) ??
    (frontmatter.shortTitle as string);
  const number =
    (frontmatter.massnahme_nr as string) ??
    (frontmatter.number as string) ??
    (frontmatter.nummer as string);
  const coverImageUrl = frontmatter.coverImageUrl as string | undefined;
  const coverThumbnailUrl = frontmatter.coverThumbnailUrl as string | undefined;
  if (!title && !number && !coverImageUrl && !coverThumbnailUrl) return undefined;
  return {
    ...(typeof title === 'string' && title.trim() ? { title: title.trim() } : {}),
    ...(typeof number === 'string' && number.trim() ? { number: number.trim() } : {}),
    ...(typeof coverImageUrl === 'string' && coverImageUrl.trim() ? { coverImageUrl: coverImageUrl.trim() } : {}),
    ...(typeof coverThumbnailUrl === 'string' && coverThumbnailUrl.trim() ? { coverThumbnailUrl: coverThumbnailUrl.trim() } : {}),
  };
}

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
  /** Optional: Wenn true, werden beide Artefakt-Typen (transcript + transformation) zurückgegeben */
  includeBoth?: boolean;
  /** Optional: Wenn true, wird auch der Ingestion-Status geprüft */
  includeIngestionStatus?: boolean;
  /** Optional: Wenn true, werden Titel, Nummer und coverImageUrl für die Dateiliste mitgeliefert (Mongo-Pfad) */
  includeListMeta?: boolean;
}

/**
 * Metadaten für die Dateiliste (Titel, Nummer, Cover) aus Transformations-Frontmatter.
 * coverThumbnailUrl wird in der Liste bevorzugt geladen (kleinere Dateien als coverImageUrl).
 */
export interface ListMeta {
  title?: string;
  number?: string;
  coverImageUrl?: string;
  /** Fragment-Name des Thumbnails (z.B. WebP); wenn vorhanden, in der Liste bevorzugt nutzen */
  coverThumbnailUrl?: string;
}

/**
 * Erweiterte ResolvedArtifact mit vollständigem StorageItem.
 */
export interface ResolvedArtifactWithItem extends ResolvedArtifact {
  /** Vollständiges StorageItem-Objekt des Artefakts */
  item: StorageItem;
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
 * Response für Bulk-Auflösung.
 */
export interface BatchResolveResponse {
  /** Map von sourceId -> ResolvedArtifactWithItem (oder null wenn nicht gefunden) */
  artifacts: Record<string, ResolvedArtifactWithItem | null>;
  /** Map von sourceId -> Transcript-Artefakt (nur wenn includeBoth=true) */
  transcripts?: Record<string, ResolvedArtifactWithItem | null>;
  /** Map von sourceId -> Ingestion-Status (nur wenn includeIngestionStatus=true) */
  ingestionStatus?: Record<string, IngestionStatus>;
  /** Map von sourceId -> ListMeta (nur wenn includeListMeta=true, aktuell nur Mongo-Pfad) */
  listMeta?: Record<string, ListMeta>;
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
    const shadowTwinConfig = getShadowTwinConfig(library);

    // MongoDB-Pfad: Artefakte direkt aus Mongo laden (kein Filesystem-Scan).
    if (shadowTwinConfig.primaryStore === 'mongo') {
      const targetLanguageBySource = new Map(
        body.sources.map((source) => [source.sourceId, source.targetLanguage || 'de'])
      );
      const docs = await getShadowTwinsBySourceIds({
        libraryId,
        sourceIds: body.sources.map((source) => source.sourceId),
      });

      // Helper-Funktion zum Erstellen eines ResolvedArtifactWithItem
      const createArtifactItem = (
        source: typeof body.sources[0],
        selected: { kind: 'transcript' | 'transformation'; record: { markdown: string; updatedAt: string }; templateName?: string }
      ): ResolvedArtifactWithItem => {
        const targetLanguage = targetLanguageBySource.get(source.sourceId) || 'de';
        const fileName = buildArtifactName(
          {
            sourceId: source.sourceId,
            kind: selected.kind,
            targetLanguage,
            templateName: selected.templateName,
          },
          source.sourceName
        );

        const virtualId = buildMongoShadowTwinId({
          libraryId,
          sourceId: source.sourceId,
          kind: selected.kind,
          targetLanguage,
          templateName: selected.templateName,
        });

        const virtualItem: StorageItem = {
          id: virtualId,
          parentId: source.parentId,
          type: 'file',
          metadata: {
            name: fileName,
            size: selected.record.markdown.length,
            modifiedAt: new Date(selected.record.updatedAt),
            mimeType: 'text/markdown',
            isTwin: true,
          },
        };

        return {
          fileId: virtualId,
          fileName,
          location: 'dotFolder',
          kind: selected.kind,
          item: virtualItem,
        };
      };

      const artifacts: Record<string, ResolvedArtifactWithItem | null> = {};
      const transcripts: Record<string, ResolvedArtifactWithItem | null> = {};
      
      // Lade beide Artefakt-Typen wenn includeBoth=true
      const shouldIncludeBoth = body.includeBoth === true;
      
      for (const source of body.sources) {
        const doc = docs.get(source.sourceId);
        if (!doc) {
          artifacts[source.sourceId] = null;
          if (shouldIncludeBoth) {
            transcripts[source.sourceId] = null;
          }
          continue;
        }

        const targetLanguage = targetLanguageBySource.get(source.sourceId) || 'de';
        
        // Haupt-Artefakt (preferredKind)
        const selected = selectShadowTwinArtifact(doc, preferredKind, targetLanguage);
        // selectShadowTwinArtifact gibt nur 'transcript' oder 'transformation' zurück, nie 'raw'
        if (selected && (selected.kind === 'transcript' || selected.kind === 'transformation')) {
          artifacts[source.sourceId] = createArtifactItem(source, selected as { kind: 'transcript' | 'transformation'; record: typeof selected.record; templateName?: string });
        } else {
          artifacts[source.sourceId] = null;
        }

        // Transcript-Artefakt (wenn includeBoth=true)
        if (shouldIncludeBoth) {
          const transcriptSelected = selectShadowTwinArtifact(doc, 'transcript', targetLanguage);
          // selectShadowTwinArtifact gibt nur 'transcript' oder 'transformation' zurück, nie 'raw'
          if (transcriptSelected && (transcriptSelected.kind === 'transcript' || transcriptSelected.kind === 'transformation')) {
            transcripts[source.sourceId] = createArtifactItem(source, transcriptSelected as { kind: 'transcript' | 'transformation'; record: typeof transcriptSelected.record; templateName?: string });
          } else {
            transcripts[source.sourceId] = null;
          }
        }
      }

      // ListMeta aus Transformations-Frontmatter (nur Mongo-Pfad, wenn includeListMeta=true)
      let listMeta: Record<string, ListMeta> | undefined;
      if (body.includeListMeta === true) {
        listMeta = {};
        for (const source of body.sources) {
          const doc = docs.get(source.sourceId);
          if (!doc) continue;
          const targetLanguage = targetLanguageBySource.get(source.sourceId) || 'de';
          const selected = selectShadowTwinArtifact(doc, 'transformation', targetLanguage);
          if (selected?.kind === 'transformation' && selected.record.frontmatter) {
            const meta = listMetaFromFrontmatter(selected.record.frontmatter as Record<string, unknown>);
            if (meta && (meta.title || meta.number || meta.coverImageUrl || meta.coverThumbnailUrl)) {
              listMeta[source.sourceId] = meta;
            }
          }
        }
      }

      // Ingestion-Status prüfen (wenn includeIngestionStatus=true)
      let ingestionStatus: Record<string, IngestionStatus> | undefined;
      if (body.includeIngestionStatus === true) {
        try {
          const libraryKey = getCollectionNameForLibrary(library);
          const fileIds = body.sources.map(s => s.sourceId);
          const ingestionMap = await getByFileIds(libraryKey, libraryId, fileIds);
          
          ingestionStatus = {};
          for (const source of body.sources) {
            const docMeta = ingestionMap.get(source.sourceId);
            ingestionStatus[source.sourceId] = {
              exists: !!docMeta,
              chunkCount: docMeta?.chunkCount,
              chaptersCount: docMeta?.chaptersCount,
            };
          }
        } catch (error) {
          FileLogger.warn('artifacts/batch-resolve', 'Fehler beim Laden des Ingestion-Status', {
            error: error instanceof Error ? error.message : String(error),
          });
          // Setze alle auf false bei Fehler
          ingestionStatus = {};
          for (const source of body.sources) {
            ingestionStatus[source.sourceId] = { exists: false };
          }
        }
      }

      const response: BatchResolveResponse = { artifacts };
      if (shouldIncludeBoth) {
        response.transcripts = transcripts;
      }
      if (ingestionStatus) {
        response.ingestionStatus = ingestionStatus;
      }
      if (listMeta) {
        response.listMeta = listMeta;
      }

      return NextResponse.json(response, { status: 200 });
    }

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
    
    // Wenn includeBoth=true, löse beide Artefakt-Typen auf
    const shouldIncludeBoth = body.includeBoth === true;
    const resolvePromises = body.sources.map(resolveArtifactWithCache);
    const results = await Promise.all(resolvePromises);
    
    // Wenn includeBoth=true, löse auch Transcripts auf
    let transcriptResults: Array<{ sourceId: string; artifact: ResolvedArtifactWithItem | null }> = [];
    if (shouldIncludeBoth) {
      const resolveTranscriptWithCache = async (
        source: typeof body.sources[0]
      ): Promise<{ sourceId: string; artifact: ResolvedArtifactWithItem | null }> => {
        try {
          const cachedSiblings = folderItemsCache.get(source.parentId) || [];
          const cachedProvider = {
            ...provider,
            listItemsById: async (folderId: string): Promise<StorageItem[]> => {
              if (folderItemsCache.has(folderId)) {
                return folderItemsCache.get(folderId)!;
              }
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
            preferredKind: 'transcript',
          });

          if (!resolved) {
            return { sourceId: source.sourceId, artifact: null };
          }

          const cachedItem = cachedSiblings.find(item => item.id === resolved.fileId);
          let artifactItem: StorageItem | null = cachedItem || null;
          
          if (!artifactItem) {
            try {
              artifactItem = await provider.getItemById(resolved.fileId);
            } catch {
              return { sourceId: source.sourceId, artifact: null };
            }
          }

          if (!artifactItem) {
            return { sourceId: source.sourceId, artifact: null };
          }

          return {
            sourceId: source.sourceId,
            artifact: {
              ...resolved,
              item: artifactItem,
            } as ResolvedArtifactWithItem,
          };
        } catch {
          return { sourceId: source.sourceId, artifact: null };
        }
      };
      
      transcriptResults = await Promise.all(body.sources.map(resolveTranscriptWithCache));
    }
    
    const resolveDuration = performance.now() - resolveStartTime;
    
    FileLogger.info('artifacts/batch-resolve', 'Artefakt-Auflösung abgeschlossen', {
      totalSources: body.sources.length,
      resolveDuration: `${resolveDuration.toFixed(2)}ms`,
      cacheHits: uniqueParentIds.length,
      cacheSize: folderItemsCache.size,
      avgTimePerSource: `${(resolveDuration / body.sources.length).toFixed(2)}ms`,
      includeBoth: shouldIncludeBoth,
    });

    // Konvertiere zu Record für einfachen Zugriff
    const artifacts: Record<string, ResolvedArtifactWithItem | null> = {};
    for (const result of results) {
      artifacts[result.sourceId] = result.artifact;
    }

    const transcripts: Record<string, ResolvedArtifactWithItem | null> = {};
    if (shouldIncludeBoth) {
      for (const result of transcriptResults) {
        transcripts[result.sourceId] = result.artifact;
      }
    }

    // Ingestion-Status prüfen (wenn includeIngestionStatus=true)
    let ingestionStatus: Record<string, IngestionStatus> | undefined;
    if (body.includeIngestionStatus === true) {
      try {
        const libraryKey = getCollectionNameForLibrary(library);
        const fileIds = body.sources.map(s => s.sourceId);
        const ingestionMap = await getByFileIds(libraryKey, libraryId, fileIds);
        
        ingestionStatus = {};
        for (const source of body.sources) {
          const docMeta = ingestionMap.get(source.sourceId);
          ingestionStatus[source.sourceId] = {
            exists: !!docMeta,
            chunkCount: docMeta?.chunkCount,
            chaptersCount: docMeta?.chaptersCount,
          };
        }
      } catch (error) {
        FileLogger.warn('artifacts/batch-resolve', 'Fehler beim Laden des Ingestion-Status', {
          error: error instanceof Error ? error.message : String(error),
        });
        ingestionStatus = {};
        for (const source of body.sources) {
          ingestionStatus[source.sourceId] = { exists: false };
        }
      }
    }

    FileLogger.debug('artifacts/batch-resolve', 'Bulk-Auflösung abgeschlossen', {
      libraryId,
      totalSources: body.sources.length,
      resolvedCount: Object.values(artifacts).filter(a => a !== null).length,
      transcriptCount: shouldIncludeBoth ? Object.values(transcripts).filter(a => a !== null).length : 0,
      ingestionCount: ingestionStatus ? Object.values(ingestionStatus).filter(s => s.exists).length : 0,
    });

    const response: BatchResolveResponse = { artifacts };
    if (shouldIncludeBoth) {
      response.transcripts = transcripts;
    }
    if (ingestionStatus) {
      response.ingestionStatus = ingestionStatus;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('artifacts/batch-resolve', 'Fehler bei Bulk-Artefakt-Auflösung', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

