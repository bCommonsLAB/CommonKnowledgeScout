'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, FileText, RefreshCw, Rss, Wand2 } from "lucide-react";
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { MarkdownMetadata } from './markdown-metadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, librariesAtom } from "@/atoms/library-atom";
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"
import { JobReportTab } from './job-report-tab';
// PdfPhasesView ist bewusst NICHT mehr Teil der File-Preview (zu heavy). Flow-View ist der Expertenmodus.
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { parseFrontmatter } from '@/lib/markdown/frontmatter';
import { DetailViewRenderer } from './detail-view-renderer';
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client';
import { SourceAndTranscriptPane } from "@/components/library/shared/source-and-transcript-pane"
import { useResolvedTranscriptItem } from "@/components/library/shared/use-resolved-transcript-item"
import { ArtifactInfoPanel } from "@/components/library/shared/artifact-info-panel"
import { useStoryStatus } from "@/components/library/shared/use-story-status"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { IngestionDataProvider } from "@/components/library/shared/ingestion-data-context"
import type { StoryStepStatus, StoryStepState } from "@/components/library/shared/story-status"
import { ArtifactMarkdownPanel } from "@/components/library/shared/artifact-markdown-panel"
import { ArtifactEditDialog } from "@/components/library/shared/artifact-edit-dialog"
import { IngestionDetailPanel } from "@/components/library/shared/ingestion-detail-panel"

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

function getStoryStep(steps: StoryStepStatus[], id: StoryStepStatus["id"]): StoryStepStatus | null {
  return steps.find((step) => step.id === id) ?? null
}

function stepStateClass(state: StoryStepState | null): string {
  if (state === "present") return "text-green-600"
  if (state === "running") return "text-amber-600"
  if (state === "error") return "text-destructive"
  return "text-muted-foreground"
}

function ArtifactTabLabel({
  icon: Icon,
  label,
  state,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  state: StoryStepState | null
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={cn("h-4 w-4", stepStateClass(state))} />
      <span>{label}</span>
    </span>
  )
}

// Komponente, die JobReportTab mit Shadow-Twin-Unterstützung umschließt
// Verwendet jetzt den zentralen resolveArtifactClient statt lokaler Heuristik
function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider,
  ingestionTabMode = "status",
  onEditClick,
  onPublishClick,
  effectiveMdIdRef,
}: {
  libraryId: string;
  fileId: string;
  fileName: string;
  parentId: string;
  provider: StorageProvider | null;
  ingestionTabMode?: 'status' | 'preview';
  onEditClick?: () => void;
  onPublishClick?: () => void;
  effectiveMdIdRef?: React.MutableRefObject<string | null>;
}) {
  const [mdFileId, setMdFileId] = React.useState<string | null>(null);
  const [baseFileId, setBaseFileId] = React.useState<string>(fileId);
  const [isLoading, setIsLoading] = React.useState(true);

  // Variante C: Vollständig über API - kein lokales Parsing mehr
  React.useEffect(() => {
    async function resolveArtifact() {
      setIsLoading(true);

      // Rufe zentrale Resolver-API auf
      // Priorität 1: Transformation (hat Frontmatter)
      let resolved = await resolveArtifactClient({
        libraryId,
        sourceId: fileId,
        sourceName: fileName,
        parentId,
        targetLanguage: 'de', // Standard-Sprache
        preferredKind: 'transformation',
      });

      // Priorität 2: Fallback zu Transcript wenn keine Transformation gefunden
      if (!resolved) {
        resolved = await resolveArtifactClient({
          libraryId,
          sourceId: fileId,
          sourceName: fileName,
          parentId,
          targetLanguage: 'de', // Standard-Sprache
          preferredKind: 'transcript',
        });
      }

      if (resolved) {
        setMdFileId(resolved.fileId);
        setBaseFileId(fileId); // Basis-Datei bleibt fileId
        FileLogger.debug('JobReportTabWithShadowTwin', 'Artefakt über Resolver gefunden', {
          originalFileId: fileId,
          resolvedFileId: resolved.fileId,
          resolvedFileName: resolved.fileName,
          kind: resolved.kind,
          location: resolved.location,
        });
      } else {
        // Kein Artefakt gefunden - verwende Basis-Datei direkt
        setMdFileId(null);
        setBaseFileId(fileId);
        FileLogger.debug('JobReportTabWithShadowTwin', 'Kein Shadow-Twin-Artefakt gefunden, verwende Basis-Datei', {
          fileId,
          fileName,
          parentId,
        });
      }

      setIsLoading(false);
    }

    if (libraryId && fileId && parentId) {
      resolveArtifact().catch((error) => {
        FileLogger.error('JobReportTabWithShadowTwin', 'Fehler bei Artefakt-Auflösung', {
          fileId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        setIsLoading(false);
        setMdFileId(null);
        setBaseFileId(fileId);
      });
    } else {
      setIsLoading(false);
    }
  }, [libraryId, fileId, fileName, parentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lade Metadaten...</p>
      </div>
    );
  }

  return (
    <JobReportTab 
      libraryId={libraryId} 
      fileId={baseFileId} 
      fileName={fileName} 
      provider={provider}
      mdFileId={mdFileId}
      ingestionTabMode={ingestionTabMode}
      onEditClick={onEditClick}
      onPublishClick={onPublishClick}
      effectiveMdIdRef={effectiveMdIdRef}
      sourceMode="frontmatter"
      viewMode="metaOnly"
    />
  );
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    // Prüfe, ob es sich um einen Ordner handelt (root ist ein Ordner)
    if (item.type === 'folder' || item.id === 'root') {
      FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Ordner', {
        itemId: item.id,
        itemName: item.metadata.name,
        itemType: item.type
      });
      contentCache.current.set(item.id, { content: '', hasMetadata: false });
      onContentLoaded('', false);
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.type, item?.metadata?.name, provider, fileType, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder,
  storySteps,
  editHandlerRef,
  publishHandlerRef,
  effectiveMdIdRef,
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  storySteps: StoryStepStatus[];
  editHandlerRef?: React.MutableRefObject<(() => void) | null>;
  publishHandlerRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  effectiveMdIdRef?: React.MutableRefObject<string | null>;
}) {
  const [infoTab, setInfoTab] = React.useState<"original" | "transcript" | "transform" | "story" | "overview">("original")
  const transcript = useResolvedTranscriptItem({
    provider,
    libraryId: activeLibraryId,
    sourceFile: fileType === "audio" || fileType === "pdf" ? item : null,
    targetLanguage: "de",
  })
  const [transformItem, setTransformItem] = React.useState<StorageItem | null>(null)
  const [transformError, setTransformError] = React.useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isSplittingPages, setIsSplittingPages] = React.useState(false)
  const [isPublishing, setIsPublishing] = React.useState(false)

  // Statusabfrage-States (derzeit nicht genutzt – bei Bedarf aktivieren)
  // const [ragLoading, setRagLoading] = React.useState(false);
  // const [ragError, setRagError] = React.useState<string | null>(null);
  // const [ragStatus, setRagStatus] = React.useState<{
  //   status: 'ok' | 'stale' | 'not_indexed';
  //   fileName?: string;
  //   chunkCount?: number;
  //   upsertedAt?: string;
  //   docModifiedAt?: string;
  //   docMeta?: Record<string, unknown>;
  //   toc?: Array<Record<string, unknown>>;
  //   totals?: { docs: number; chunks: number };
  //   analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  // } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  const router = useRouter();
  
  // Hole Shadow-Twin-State für die aktuelle Datei
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  const shadowTwinState = shadowTwinStates.get(item.id);
  
  // Hole Libraries-Atom für Markdown-Preview (muss vor allen frühen Returns sein)
  const libraries = useAtomValue(librariesAtom);
  
  // Bestimme das Verzeichnis für Bild-Auflösung im Markdown-Viewer:
  // 
  // Strategie:
  // 1. Wenn shadowTwinFolderId aus dem Shadow-Twin-State verfügbar ist, verwende es
  //    (für PDF-Dateien, deren Markdown im JobReportTab angezeigt wird)
  // 2. Wenn die Datei selbst eine Markdown-Datei im Shadow-Twin-Verzeichnis ist,
  //    dann ist item.parentId bereits das Shadow-Twin-Verzeichnis - verwende es
  // 3. Sonst verwende item.parentId (normale Dateien)
  //
  // WICHTIG: Für Markdown-Dateien, die im Shadow-Twin-Verzeichnis liegen, ist item.parentId
  // bereits das Shadow-Twin-Verzeichnis. Dies ist die korrekte Basis für Bild-Referenzen.
  // Der Shadow-Twin-State wird für die PDF-Datei gespeichert, nicht für die Markdown-Datei,
  // daher müssen wir item.parentId verwenden, wenn die Markdown-Datei direkt geöffnet wird.
  const currentFolderId = shadowTwinState?.shadowTwinFolderId || item.parentId;
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId,
      currentFolderId,
      shadowTwinFolderId: shadowTwinState?.shadowTwinFolderId,
      parentId: item.parentId,
      hasShadowTwinState: !!shadowTwinState,
      shadowTwinStateKeys: shadowTwinState ? Object.keys(shadowTwinState) : []
    });
  }, [item.id, item.metadata.name, fileType, content.length, error, provider, activeLibraryId, currentFolderId, shadowTwinState?.shadowTwinFolderId, item.parentId, shadowTwinState]);
  
  React.useEffect(() => {
    setInfoTab("original");
  }, [item.id]);

  React.useEffect(() => {
    let cancelled = false

    async function loadTransformItem() {
      if (!provider) {
        setTransformItem(null)
        setTransformError(null)
        return
      }
      if (!shadowTwinState?.transformed?.id) {
        setTransformItem(null)
        setTransformError(null)
        return
      }
      try {
        const loaded = await provider.getItemById(shadowTwinState.transformed.id)
        if (cancelled) return
        setTransformItem(loaded)
        setTransformError(null)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        setTransformItem(null)
        setTransformError(message)
      }
    }

    void loadTransformItem()
    return () => {
      cancelled = true
    }
  }, [provider, shadowTwinState?.transformed?.id])

  // async function loadRagStatus() {
  //   try {
  //     setRagLoading(true);
  //     setRagError(null);
  //     const docMod = (() => {
  //       const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
  //       const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
  //       return dt ? dt.toISOString() : undefined;
  //     })();
  //     const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
  //     // Library-Stats parallel
  //     const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
  //     const stats = await statsRes.json().catch(() => ({}));
  //     setRagStatus({ ...data, totals: stats?.totals });
  //   } catch (e) {
  //     setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
  //   } finally {
  //     setRagLoading(false);
  //   }
  // }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  switch (fileType) {
    case 'audio': {
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Wand2} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Rss} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="audio"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original transkribiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  item={transcript.transcriptItem}
                  provider={provider}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    transcript.transcriptItem && ['pdf', 'audio', 'markdown'].includes(fileType) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSplittingPages || !provider}
                        onClick={async () => {
                          if (!activeLibraryId || !transcript.transcriptItem?.id) return
                          // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                          // Verarbeitet die Transcript-Datei und splittet sie in einzelne Seiten-Dateien in einem Unterverzeichnis.
                          setIsSplittingPages(true)
                          try {
                            const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                sourceFileId: transcript.transcriptItem.id,
                                originalFileId: item.id,
                                targetLanguage: 'de',
                              }),
                            })
                            const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                            if (!res.ok) {
                              const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                              throw new Error(msg)
                            }
                            toast.success("Seiten gesplittet", {
                              description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                            })
                            // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                            // Verwende die parentId des Originals, nicht die der Transcript-Datei
                            if (onRefreshFolder && item.parentId) {
                              const refreshed = await provider?.listItemsById(item.parentId)
                              if (refreshed) onRefreshFolder(item.parentId, refreshed)
                            }
                          } catch (error) {
                            toast.error("Split fehlgeschlagen", {
                              description: error instanceof Error ? error.message : "Unbekannter Fehler"
                            })
                          } finally {
                            setIsSplittingPages(false)
                          }
                        }}
                      >
                        Seiten splitten
                      </Button>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditOpen(true)}
                      disabled={!provider || !transformItem}
                    >
                      Bearbeiten
                    </Button>
                    {effectiveMdIdRef?.current && publishHandlerRef?.current && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => {
                          if (publishHandlerRef.current) {
                            setIsPublishing(true)
                            try {
                              await publishHandlerRef.current()
                            } finally {
                              setIsPublishing(false)
                            }
                          }
                        }}
                        disabled={isPublishing || !provider || !effectiveMdIdRef.current}
                      >
                        {isPublishing ? 'Wird veröffentlicht...' : 'Story veröffentlichen'}
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      ingestionTabMode="preview"
                      onEditClick={editHandlerRef as unknown as () => void}
                      onPublishClick={publishHandlerRef as unknown as () => void}
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
                <ArtifactEditDialog
                  open={isEditOpen}
                  onOpenChange={setIsEditOpen}
                  item={transformItem}
                  provider={provider}
                  onSaved={(saved) => {
                    if (saved) setTransformItem(saved)
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
          showTransformControls={false}
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} showTransformControls={false} />;
    case 'markdown': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Wand2} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Rss} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground font-normal">
                    Original (Markdown-Datei)
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsEditOpen(true)} disabled={!provider}>
                    Bearbeiten
                  </Button>
                </div>
                <div className="rounded border">
                  <MarkdownPreview 
                    content={content}
                    currentFolderId={currentFolderId}
                    provider={provider}
                    className="max-h-[70vh]"
                    compact
                    onRefreshFolder={onRefreshFolder}
                    onTransform={() => {
                      // Transform-Button wurde geklickt - wechsle zum Transform-Tab
                      setInfoTab("transform")
                    }}
                  />
                </div>
                <ArtifactEditDialog
                  open={isEditOpen}
                  onOpenChange={setIsEditOpen}
                  item={item}
                  provider={provider}
                  onSaved={(saved) => {
                    if (!provider) return
                    const loadSavedContent = async () => {
                      const { blob } = await provider.getBinary(saved.id)
                      const text = await blob.text()
                      contentCache.current.delete(item.id)
                      contentCache.current.set(saved.id, { content: text, hasMetadata: !!extractFrontmatter(text) })
                      onContentUpdated(text)
                      setSelectedFile(saved)
                      if (onRefreshFolder) {
                        const updatedItems = await provider.listItemsById(saved.parentId)
                        onRefreshFolder(saved.parentId, updatedItems, saved)
                      }
                    }
                    loadSavedContent().catch((error) => {
                      FileLogger.error('FilePreview', 'Fehler beim Aktualisieren nach Edit', { error })
                    })
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Für Markdown-Dateien ist kein separates Transkript erforderlich, da das Original bereits Text ist.
                  </div>
                  <div className="border-t pt-3">
                    <ArtifactMarkdownPanel
                      title="Original-Inhalt"
                      titleClassName="text-xs text-muted-foreground font-normal"
                      item={item}
                      provider={provider}
                      emptyHint="Kein Inhalt verfügbar"
                      stripFrontmatter={false}
                      onSaved={(saved) => {
                        if (!provider) return
                        const loadSavedContent = async () => {
                          const { blob } = await provider.getBinary(saved.id)
                          const text = await blob.text()
                          contentCache.current.delete(item.id)
                          contentCache.current.set(saved.id, { content: text, hasMetadata: !!extractFrontmatter(text) })
                          onContentUpdated(text)
                          setSelectedFile(saved)
                          if (onRefreshFolder) {
                            const updatedItems = await provider.listItemsById(saved.parentId)
                            onRefreshFolder(saved.parentId, updatedItems, saved)
                          }
                        }
                        loadSavedContent().catch((error) => {
                          FileLogger.error('FilePreview', 'Fehler beim Aktualisieren nach Edit', { error })
                        })
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Original transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditOpen(true)}
                      disabled={!provider || !transformItem}
                    >
                      Bearbeiten
                    </Button>
                    {effectiveMdIdRef?.current && publishHandlerRef?.current && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => {
                          if (publishHandlerRef.current) {
                            setIsPublishing(true)
                            try {
                              await publishHandlerRef.current()
                            } finally {
                              setIsPublishing(false)
                            }
                          }
                        }}
                        disabled={isPublishing || !provider || !effectiveMdIdRef.current}
                      >
                        {isPublishing ? 'Wird veröffentlicht...' : 'Story veröffentlichen'}
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      ingestionTabMode="preview"
                      onEditClick={editHandlerRef as unknown as () => void}
                      onPublishClick={publishHandlerRef as unknown as () => void}
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
                <ArtifactEditDialog
                  open={isEditOpen}
                  onOpenChange={setIsEditOpen}
                  item={transformItem}
                  provider={provider}
                  onSaved={(saved) => {
                    if (saved) setTransformItem(saved)
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'pdf': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Wand2} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Rss} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original transkribiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  item={transcript.transcriptItem}
                  provider={provider}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    transcript.transcriptItem && ['pdf', 'audio', 'markdown'].includes(fileType) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSplittingPages || !provider}
                        onClick={async () => {
                          if (!activeLibraryId || !transcript.transcriptItem?.id) return
                          // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                          // Verarbeitet die Transcript-Datei und splittet sie in einzelne Seiten-Dateien in einem Unterverzeichnis.
                          setIsSplittingPages(true)
                          try {
                            const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                sourceFileId: transcript.transcriptItem.id,
                                originalFileId: item.id,
                                targetLanguage: 'de',
                              }),
                            })
                            const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                            if (!res.ok) {
                              const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                              throw new Error(msg)
                            }
                            toast.success("Seiten gesplittet", {
                              description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                            })
                            // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                            // Verwende die parentId des Originals, nicht die der Transcript-Datei
                            if (onRefreshFolder && item.parentId) {
                              const refreshed = await provider?.listItemsById(item.parentId)
                              if (refreshed) onRefreshFolder(item.parentId, refreshed)
                            }
                          } catch (error) {
                            toast.error("Split fehlgeschlagen", {
                              description: error instanceof Error ? error.message : "Unbekannter Fehler"
                            })
                          } finally {
                            setIsSplittingPages(false)
                          }
                        }}
                      >
                        Seiten splitten
                      </Button>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditOpen(true)}
                      disabled={!provider || !transformItem}
                    >
                      Bearbeiten
                    </Button>
                    {effectiveMdIdRef?.current && publishHandlerRef?.current && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={async () => {
                          if (publishHandlerRef.current) {
                            setIsPublishing(true)
                            try {
                              await publishHandlerRef.current()
                            } finally {
                              setIsPublishing(false)
                            }
                          }
                        }}
                        disabled={isPublishing || !provider || !effectiveMdIdRef.current}
                      >
                        {isPublishing ? 'Wird veröffentlicht...' : 'Story veröffentlichen'}
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      ingestionTabMode="preview"
                      onEditClick={editHandlerRef as unknown as () => void}
                      onPublishClick={publishHandlerRef as unknown as () => void}
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
                <ArtifactEditDialog
                  open={isEditOpen}
                  onOpenChange={setIsEditOpen}
                  item={transformItem}
                  provider={provider}
                  onSaved={(saved) => {
                    if (saved) setTransformItem(saved)
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 text-xs text-muted-foreground">
                    veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </IngestionDataProvider>
      )
    }
    case 'docx':
    case 'pptx':
    case 'xlsx':
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website':
      const urlContent = content.match(/URL=(.*)/)?.[1];
      return urlContent ? (
        <iframe 
          src={urlContent}
          title={item.metadata.name}
          className="w-full h-screen"
        />
      ) : (
        <div className="text-center text-muted-foreground">
          Keine gültige URL gefunden.
        </div>
      );
    default:
      return (
        <div className="text-center text-muted-foreground">
          Keine Vorschau verfügbar für diesen Dateityp.
        </div>
      );
  }
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder
}: FilePreviewProps) {
  const router = useRouter()
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom)
  const [, setShadowTwinAnalysisTrigger] = useAtom(shadowTwinAnalysisTriggerAtom)
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  const shadowTwinState = displayFile ? shadowTwinStates.get(displayFile.id) : undefined
  const storyStatus = useStoryStatus({
    libraryId: activeLibraryId,
    file: displayFile,
    shadowTwinState,
  })
  
  // Refs für Handler von JobReportTab (für Header-Buttons)
  const editHandlerRef = React.useRef<(() => void) | null>(null)
  const publishHandlerRef = React.useRef<(() => Promise<void>) | null>(null)
  const effectiveMdIdRef = React.useRef<string | null>(null)
  const [isPublishing, setIsPublishing] = React.useState(false)
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  // Entfernt: isAudioFile und isVideoFile, da sie nicht verwendet werden

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id, displayFile?.metadata.name]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">Vorschau</div>
          <div className="truncate text-sm font-medium">{displayFile.metadata.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShadowTwinAnalysisTrigger((v) => v + 1)}
                  aria-label="Shadow-Twin Status aktualisieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Status aktualisieren</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/story-creator?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}&left=off`
              router.push(url)
            }}
          >
            Story Creator
          </Button>
          {provider ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const url = await provider.getStreamingUrl(displayFile.id)
                  window.open(url, "_blank", "noopener,noreferrer")
                } catch {}
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Quelle
            </Button>
          ) : null}
        </div>
      </div>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
          storySteps={storyStatus.steps}
          editHandlerRef={editHandlerRef}
          publishHandlerRef={publishHandlerRef}
          effectiveMdIdRef={effectiveMdIdRef}
        />
      </div>
    </div>
  );
}