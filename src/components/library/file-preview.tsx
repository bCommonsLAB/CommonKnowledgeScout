'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
import { MarkdownMetadata } from './markdown-metadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';
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
import type { TemplatePreviewDetailViewType } from '@/lib/templates/template-types';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client';
import { ExternalLink } from "lucide-react";

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

// Komponente, die JobReportTab mit Shadow-Twin-Unterstützung umschließt
// Verwendet jetzt den zentralen resolveArtifactClient statt lokaler Heuristik
function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider
}: {
  libraryId: string;
  fileId: string;
  fileName: string;
  parentId: string;
  provider: StorageProvider | null;
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
  onRefreshFolder
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
}) {
  const [activeTab, setActiveTab] = React.useState<string>("preview");
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
    setActiveTab("preview");
  }, [item.id]);

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
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} showTransformControls={false} />;
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
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      
      // Prüfe, ob es eine Creation-Datei ist (mit Frontmatter-Metadaten)
      const parsed = parseFrontmatter(content);
      const meta = parsed.meta || {};
      const body = parsed.body || '';
      const creationTypeId = typeof meta.creationTypeId === 'string' ? meta.creationTypeId.trim() : undefined;
      const creationDetailViewType = typeof meta.creationDetailViewType === 'string' 
        ? (meta.creationDetailViewType as TemplatePreviewDetailViewType)
        : undefined;
      
      // Filtere System-Keys aus Metadaten (nur Template-Metadaten für DetailView)
      const templateMetadata: Record<string, unknown> = {};
      const systemKeys = new Set(['creationTypeId', 'creationTemplateId', 'creationDetailViewType', 'textSources', 'templateName']);
      for (const [key, value] of Object.entries(meta)) {
        if (!systemKeys.has(key)) {
          templateMetadata[key] = value;
        }
      }
      
      const isCreationFile = creationTypeId && creationDetailViewType;
      
      // Prüfe, ob es ein Dialograum ist (für Button "Dialograum Ergebnis erstellen")
      const dialograumId = typeof meta.dialograum_id === 'string' ? meta.dialograum_id.trim() : undefined;
      const isDialograum = dialograumId && (
        creationTypeId === 'dialograum-creation-de' || 
        (typeof meta.creationTemplateId === 'string' && meta.creationTemplateId.includes('dialograum-creation'))
      );
      
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="metadata">Metadaten</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="report">Report</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                {isCreationFile ? (
                  <div className="h-full overflow-auto">
                    <DetailViewRenderer
                      detailViewType={creationDetailViewType}
                      metadata={templateMetadata}
                      markdown={body}
                      libraryId={activeLibraryId}
                      showBackLink={false}
                    />
                  </div>
                ) : (
                  <MarkdownPreview 
                    content={content}
                    currentFolderId={currentFolderId}
                    provider={provider}
                    className="h-full"
                    compact
                    onTransform={() => setActiveTab("edit")}
                    onRefreshFolder={onRefreshFolder}
                  />
                )}
              </TabsContent>
              <TabsContent value="metadata" className="h-full mt-0">
                <div className="h-full overflow-auto px-4 py-2">
                  <MarkdownMetadata content={content} libraryId={activeLibraryId} />
                </div>
              </TabsContent>
              <TabsContent value="report" className="h-full mt-0">
                <JobReportTabWithShadowTwin 
                  libraryId={activeLibraryId} 
                  fileId={item.id} 
                  fileName={item.metadata.name}
                  parentId={item.parentId}
                  provider={provider}
                />
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0 flex flex-col">
                {/* Button zum Öffnen im Creation-Flow (nur wenn creationTypeId vorhanden) */}
                {isCreationFile && creationTypeId && (
                  <div className="px-4 py-2 border-b space-y-2">
                    <Button
                      onClick={() => {
                        if (!creationTypeId) return;
                        
                        const creationTemplateId = typeof meta.creationTemplateId === 'string' 
                          ? meta.creationTemplateId.trim()
                          : undefined;
                        const params = new URLSearchParams();
                        params.set('resumeFileId', item.id);
                        if (creationTemplateId) {
                          params.set('templateIdOverride', creationTemplateId);
                        }
                        // Trimme creationTypeId und encode für URL
                        const trimmedTypeId = creationTypeId.trim();
                        router.push(`/library/create/${encodeURIComponent(trimmedTypeId)}?${params.toString()}`);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      Im Creation-Flow öffnen
                    </Button>
                    
                    {/* Button für Dialograum Ergebnis (nur wenn Dialograum erkannt) */}
                    {isDialograum && dialograumId && (
                      <Button
                        onClick={() => {
                          const params = new URLSearchParams();
                          params.set('seedFileId', item.id);
                          // Type-ID für Dialograum-Ergebnis (wird aus Template-Namen abgeleitet)
                          const ergebnisTypeId = 'dialograum-ergebnis-de';
                          router.push(`/library/create/${encodeURIComponent(ergebnisTypeId)}?${params.toString()}`);
                        }}
                        variant="default"
                        className="w-full"
                      >
                        Dialograum Ergebnis erstellen
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex-1 min-h-0">
                  <TextEditor 
                    content={content}
                    provider={provider}
                    onSaveAction={async (newContent: string) => {
                FileLogger.info('FilePreview', 'onSaveAction gestartet', {
                  itemId: item.id,
                  itemName: item.metadata.name,
                  contentLength: newContent.length,
                  hasProvider: !!provider,
                  hasOnRefreshFolder: !!onRefreshFolder
                });
                
                if (provider && onRefreshFolder) {
                  try {
                    // Aktualisiere den lokalen State sofort
                    FileLogger.debug('FilePreview', 'Aktualisiere lokalen Content-State', {
                      oldContentLength: content.length,
                      newContentLength: newContent.length
                    });
                    onContentUpdated(newContent);
                    
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Lösche die alte Datei
                    FileLogger.info('FilePreview', 'Lösche alte Datei', {
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    await provider.deleteItem(item.id);
                    
                    // Lade die neue Datei hoch
                    FileLogger.info('FilePreview', 'Lade neue Datei hoch', {
                      fileName: file.name,
                      fileSize: file.size,
                      parentId: item.parentId
                    });
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    FileLogger.info('FilePreview', 'Upload abgeschlossen', {
                      success: !!updatedItem,
                      newItemId: updatedItem?.id,
                      newItemName: updatedItem?.metadata.name
                    });
                    
                    // Aktualisiere den Cache mit dem neuen Inhalt und der neuen ID
                    if (updatedItem) {
                      // Lösche den alten Cache-Eintrag
                      FileLogger.debug('FilePreview', 'Cache-Update: Lösche alten Eintrag', {
                        oldItemId: item.id,
                        cacheSize: contentCache.current.size
                      });
                      contentCache.current.delete(item.id);
                      
                      // Füge den neuen Inhalt zum Cache hinzu
                      const hasMetadata = !!extractFrontmatter(newContent);
                      FileLogger.debug('FilePreview', 'Cache-Update: Füge neuen Eintrag hinzu', {
                        newItemId: updatedItem.id,
                        hasMetadata,
                        contentLength: newContent.length
                      });
                      contentCache.current.set(updatedItem.id, { 
                        content: newContent, 
                        hasMetadata 
                      });
                      
                      // Aktualisiere das selectedFileAtom mit der neuen Datei
                      FileLogger.info('FilePreview', 'Aktualisiere selectedFileAtom', {
                        oldId: item.id,
                        newId: updatedItem.id
                      });
                      setSelectedFile(updatedItem);
                    }
                    
                    // Hole die aktualisierten Items
                    FileLogger.debug('FilePreview', 'Hole aktualisierte Dateiliste', {
                      parentId: item.parentId
                    });
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    FileLogger.info('FilePreview', 'Dateiliste aktualisiert', {
                      itemCount: updatedItems.length
                    });
                    
                    // Wechsle zur Vorschau
                    FileLogger.debug('FilePreview', 'Wechsle zu Vorschau-Tab');
                    setActiveTab("preview");
                    
                    // Informiere die übergeordnete Komponente
                    FileLogger.info('FilePreview', 'Rufe onRefreshFolder auf', {
                      parentId: item.parentId,
                      updatedItemsCount: updatedItems.length,
                      updatedItemId: updatedItem?.id
                    });
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    FileLogger.error('FilePreview', 'Fehler beim Aktualisieren der Datei', {
                      error,
                      itemId: item.id,
                      itemName: item.metadata.name
                    });
                    throw error; // Werfe den Fehler weiter, damit TextEditor ihn anzeigen kann
                  }
                } else {
                  FileLogger.warn('FilePreview', 'Speichern nicht möglich', {
                    hasProvider: !!provider,
                    hasOnRefreshFolder: !!onRefreshFolder
                  });
                  // Werfe einen Fehler, damit TextEditor ihn anzeigen kann
                  throw new Error('Speichern nicht möglich: onRefreshFolder Callback fehlt');
                }
              }}
                    />
                  </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
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
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const url = `/library/flow?libraryId=${encodeURIComponent(activeLibraryId)}&fileId=${encodeURIComponent(displayFile.id)}&parentId=${encodeURIComponent(displayFile.parentId)}`
              router.push(url)
            }}
          >
            Flow öffnen
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
        />
      </div>
    </div>
  );
}