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
import { getShadowTwinsBySourceIds, readTranscriptRecord } from '@/lib/repositories/shadow-twin-repo';
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

    FileLogger.info('artifacts/batch-resolve', 'Config-Diagnose', {
      libraryId,
      sourcesCount: body.sources.length,
      preferredKind,
    });

    // Artefakte direkt aus Mongo laden (Mongo ist immer primaerer Store);
    // Storage dient nur noch als optionaler Fallback (s.u.).
    {
      const targetLanguageBySource = new Map(
        body.sources.map((source) => [source.sourceId, source.targetLanguage || 'de'])
      );
      const docs = await getShadowTwinsBySourceIds({
        libraryId,
        sourceIds: body.sources.map((source) => source.sourceId),
      });

      // DIAGNOSE: Zeigt, wie viele Dokumente gefunden wurden
      FileLogger.info('artifacts/batch-resolve', 'Mongo-Pfad Ergebnis', {
        libraryId,
        sourcesCount: body.sources.length,
        docsFound: docs.size,
        sourceIdsWithDocs: Array.from(docs.keys()),
        sourceIdsWithoutDocs: body.sources
          .filter(s => !docs.has(s.sourceId))
          .map(s => ({ sourceId: s.sourceId, sourceName: s.sourceName })),
      });

      // Helper-Funktion zum Erstellen eines ResolvedArtifactWithItem
      const createArtifactItem = (
        source: typeof body.sources[0],
        selected: { kind: 'transcript' | 'transformation'; targetLanguage: string; record: { markdown: string; updatedAt: string }; templateName?: string }
      ): ResolvedArtifactWithItem => {
        // Verwende die tatsaechliche Sprache des Artefakts (z.B. 'en' bei Fallback, wenn nur transcript.en existiert)
        const targetLanguage = selected.targetLanguage || targetLanguageBySource.get(source.sourceId) || 'de';
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

      // Filesystem-Fallback im Mongo-Pfad:
      // Artefakte einer parallel laufenden Installation koennen nur im Storage
      // (z.B. dasselbe Nextcloud) liegen, aber NICHT in der MongoDB DIESER Library.
      // Wenn die Library Filesystem-Fallback erlaubt (allowFilesystemFallback) oder
      // zusaetzlich ins Filesystem persistiert (persistToFilesystem), scannen wir den
      // Storage als Fallback. Sonst bleibt der Mongo-Pfad rein DB-basiert (Performance).
      const fsFallbackEnabled =
        shadowTwinConfig.allowFilesystemFallback || shadowTwinConfig.persistToFilesystem;

      // PERFORMANCE: Ordner-Cache fuer den Storage-Fallback.
      // Ohne Cache listet jede resolveArtifact()-Aufloesung den Eltern-Ordner neu
      // (WebDAV/Drive ~300ms pro Listing). Bei N Dateien × 2 Aufloesungen (Transcript +
      // Transformation) summiert sich das auf Dutzende Sekunden. Wir laden die Eltern-
      // Ordner einmalig vor und cachen jede weitere Auflistung (z.B. die Shadow-Twin-
      // Unterordner) bei Erstzugriff. Nur noetig, wenn der Fallback ueberhaupt laeuft.
      const fsFolderCache = new Map<string, StorageItem[]>();
      const fsCachedProvider = {
        ...provider,
        listItemsById: async (folderId: string): Promise<StorageItem[]> => {
          const cached = fsFolderCache.get(folderId);
          if (cached) return cached;
          const items = await provider.listItemsById(folderId);
          fsFolderCache.set(folderId, items);
          return items;
        },
      } as StorageProvider;

      if (fsFallbackEnabled) {
        const uniqueParentIds = Array.from(new Set(body.sources.map((s) => s.parentId)));
        await Promise.all(
          uniqueParentIds.map(async (parentId) => {
            try {
              fsFolderCache.set(parentId, await provider.listItemsById(parentId));
            } catch (err) {
              // Preload optional: leeres Array, damit Fallback nicht crasht.
              FileLogger.warn('artifacts/batch-resolve', 'Preload (Mongo-Pfad) fehlgeschlagen', {
                parentId,
                error: err instanceof Error ? err.message : String(err),
              });
              fsFolderCache.set(parentId, []);
            }
          }),
        );
      }

      const resolveFromStorageFallback = async (
        source: BatchResolveRequest['sources'][number],
        kind: 'transcript' | 'transformation',
      ): Promise<ResolvedArtifactWithItem | null> => {
        if (!fsFallbackEnabled) return null;
        try {
          // Gecachter Provider: Eltern-/Twin-Ordner werden nur einmal gelistet.
          const resolved = await resolveArtifact(fsCachedProvider, {
            sourceItemId: source.sourceId,
            sourceName: source.sourceName,
            parentId: source.parentId,
            // Konfigurierte Library-Zielsprache (kein hardcodiertes 'de')
            targetLanguage: targetLanguageBySource.get(source.sourceId) || 'de',
            preferredKind: kind,
          });
          if (!resolved) return null;
          // Artefakt-Item bevorzugt aus dem Ordner-Cache, sonst gezielt laden.
          const cachedItem = (fsFolderCache.get(resolved.shadowTwinFolderId || source.parentId) || [])
            .find((it) => it.id === resolved.fileId);
          const item = cachedItem || await provider.getItemById(resolved.fileId);
          if (!item) return null;
          return { ...resolved, item };
        } catch (err) {
          // Storage-Fallback ist optional; ein Fehler darf die Liste nicht kippen.
          FileLogger.debug('artifacts/batch-resolve', 'Storage-Fallback (Mongo-Pfad) fehlgeschlagen', {
            sourceId: source.sourceId,
            kind,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
      };

      for (const source of body.sources) {
        const doc = docs.get(source.sourceId);
        if (!doc) {
          // Kein Mongo-Dokument: Storage-Fallback versuchen (cross-installation Artefakte)
          artifacts[source.sourceId] = await resolveFromStorageFallback(source, preferredKind);
          if (shouldIncludeBoth) {
            transcripts[source.sourceId] = await resolveFromStorageFallback(source, 'transcript');
          }
          // DIAGNOSE: Zeigt, welche sourceIds kein Mongo-Dokument haben
          FileLogger.debug('artifacts/batch-resolve', 'Kein Mongo-Dokument fuer Source', {
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            fsFallbackHit: !!artifacts[source.sourceId],
          });
          continue;
        }

        const targetLanguage = targetLanguageBySource.get(source.sourceId) || 'de';
        
        // Haupt-Artefakt (preferredKind)
        const selected = selectShadowTwinArtifact(doc, preferredKind, targetLanguage);

        // DIAGNOSE: Zeigt, was selectShadowTwinArtifact zurückgibt
        FileLogger.info('artifacts/batch-resolve', 'selectShadowTwinArtifact Ergebnis', {
          sourceId: source.sourceId,
          sourceName: source.sourceName,
          preferredKind,
          targetLanguage,
          selectedKind: selected?.kind ?? null,
          selectedLang: selected?.targetLanguage ?? null,
          selectedTemplate: selected?.templateName ?? null,
          hasRecord: !!selected?.record,
          docArtifactKeys: {
            // Transkript ist sprach-neutral: ein Record pro Quelle (Helper toleriert Legacy-Map).
            hasTranscript: readTranscriptRecord(doc) !== null,
            transcriptLangs: readTranscriptRecord(doc) ? [''] : [],
            hasTransformation: !!doc.artifacts?.transformation,
            transformationTemplates: doc.artifacts?.transformation ? Object.keys(doc.artifacts.transformation) : [],
          },
        });

        if (selected && (selected.kind === 'transcript' || selected.kind === 'transformation')) {
          artifacts[source.sourceId] = createArtifactItem(source, selected as { kind: 'transcript' | 'transformation'; targetLanguage: string; record: typeof selected.record; templateName?: string });
        } else {
          // Mongo-Doc vorhanden, aber Artefakt fehlt → Storage-Fallback (z.B. nur FS-persistiert)
          artifacts[source.sourceId] = await resolveFromStorageFallback(source, preferredKind);
        }

        // Transcript-Artefakt (wenn includeBoth=true)
        if (shouldIncludeBoth) {
          const transcriptSelected = selectShadowTwinArtifact(doc, 'transcript', targetLanguage);
          // selectShadowTwinArtifact gibt nur 'transcript' oder 'transformation' zurück, nie 'raw'
          if (transcriptSelected && (transcriptSelected.kind === 'transcript' || transcriptSelected.kind === 'transformation')) {
            transcripts[source.sourceId] = createArtifactItem(source, transcriptSelected as { kind: 'transcript' | 'transformation'; targetLanguage: string; record: typeof transcriptSelected.record; templateName?: string });
          } else {
            transcripts[source.sourceId] = await resolveFromStorageFallback(source, 'transcript');
          }
        }
      }

      // ListMeta aus Transformations-Frontmatter (nur Mongo-Pfad, wenn includeListMeta=true)
      let listMeta: Record<string, ListMeta> | undefined;
      if (body.includeListMeta === true) {
        listMeta = {};
        for (const source of body.sources) {
          const doc = docs.get(source.sourceId);
          if (doc) {
            const targetLanguage = targetLanguageBySource.get(source.sourceId) || 'de';
            const selected = selectShadowTwinArtifact(doc, 'transformation', targetLanguage);
            if (selected?.kind === 'transformation' && selected.record.frontmatter) {
              const meta = listMetaFromFrontmatter(selected.record.frontmatter as Record<string, unknown>);
              if (meta && (meta.title || meta.number || meta.coverImageUrl || meta.coverThumbnailUrl)) {
                listMeta[source.sourceId] = meta;
              }
            }
          }
          // Mongo-Mode: Kein Self-Reference – wenn kein doc, dann kein ListMeta
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

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    FileLogger.error('artifacts/batch-resolve', 'Fehler bei Bulk-Artefakt-Auflösung', { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

