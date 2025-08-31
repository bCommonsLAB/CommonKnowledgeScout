'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { MarkdownPreview } from './markdown-preview';
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

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  isAudioFile, 
  isVideoFile, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  isAudioFile: boolean;
  isVideoFile: boolean;
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
  }, [item?.id, item?.metadata?.name, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

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
  const [ragLoading, setRagLoading] = React.useState(false);
  const [ragError, setRagError] = React.useState<string | null>(null);
  const [ragStatus, setRagStatus] = React.useState<{
    status: 'ok' | 'stale' | 'not_indexed';
    fileName?: string;
    chunkCount?: number;
    upsertedAt?: string;
    docModifiedAt?: string;
    docMeta?: Record<string, unknown>;
    toc?: Array<Record<string, unknown>>;
    totals?: { docs: number; chunks: number };
    analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId
    });
  }, [item.id, fileType, content.length, error, provider, activeLibraryId]);
  
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  async function loadRagStatus() {
    try {
      setRagLoading(true);
      setRagError(null);
      const docMod = (() => {
        const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
        const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
        return dt ? dt.toISOString() : undefined;
      })();
      const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
      // Library-Stats parallel
      const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
      const stats = await statsRes.json().catch(() => ({}));
      setRagStatus({ ...data, totals: stats?.totals });
    } catch (e) {
      setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setRagLoading(false);
    }
  }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Debug-Log vor Switch-Statement
  FileLogger.debug('PreviewContent', 'Switch-Statement erreicht', {
    itemId: item.id,
    itemName: item.metadata.name,
    fileType,
    switchCase: fileType
  });

  switch (fileType) {
    case 'audio':
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
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
        />
      );
    case 'video':
      FileLogger.debug('PreviewContent', 'Video-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      FileLogger.debug('PreviewContent', 'Markdown-Editor wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        contentLength: content.length
      });
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
              <TabsTrigger value="rag" onClick={() => { void loadRagStatus(); }}>RAG</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <div className="flex items-center gap-2 px-4 py-2">
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (A)')
                        console.log('[Upsert A] OK:', data)
                      } catch (e) {
                        console.error('[Upsert A] Fehler:', e)
                      }
                    }}
                  >
                    Upsert A
                  </button>
                  <button
                    className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'B' }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Fehler beim Upsert (B)')
                        console.log('[Upsert B] OK:', data)
                      } catch (e) {
                        console.error('[Upsert B] Fehler:', e)
                      }
                    }}
                  >
                    Upsert B
                  </button>
                </div>
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
              </TabsContent>
              <TabsContent value="rag" className="h-full mt-0">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">RAG-Status</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={() => void loadRagStatus()}
                      >
                        Aktualisieren
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse')
                          }
                        }}
                      >
                        Kapitelanalyse
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-muted px-3 text-xs"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/analyze-chapters`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, content, mode: 'llm' })
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Kapitelanalyse (LLM) fehlgeschlagen')
                            setRagStatus(prev => ({ ...(prev ?? { status: 'not_indexed' as const }), analyze: data?.result }))
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler bei Kapitelanalyse (LLM)')
                          }
                        }}
                      >
                        Kapitelanalyse (LLM)
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert');
                          }
                        }}
                      >
                        Upsert
                      </button>
                      <button
                        className="inline-flex h-8 items-center rounded-md bg-primary/70 text-primary-foreground px-3 text-xs"
                        onClick={async () => {
                          try {
                            const chaptersSrcUnknown: unknown = (ragStatus as unknown as { analyze?: { chapters?: unknown } })?.analyze?.chapters
                            const chaptersSrc: Array<unknown> | undefined = Array.isArray(chaptersSrcUnknown) ? chaptersSrcUnknown : undefined
                            if (!Array.isArray(chaptersSrc) || chaptersSrc.length === 0) {
                              throw new Error('Keine Kapitelanalyse vorhanden')
                            }
                            const chapters = chaptersSrc
                              .filter((c): c is { chapterId?: unknown; title?: unknown; summary: string; keywords?: unknown } => {
                                if (!c || typeof c !== 'object') return false
                                const s = (c as Record<string, unknown>).summary
                                return typeof s === 'string' && s.trim().length > 0
                              })
                              .map((c, i) => {
                                const obj = c as Record<string, unknown>
                                const chapterId = typeof obj.chapterId === 'string' ? obj.chapterId : `chap-${i + 1}`
                                const title = typeof obj.title === 'string' ? obj.title : `Kapitel ${i + 1}`
                                const summary = (obj.summary as string).slice(0, 1200)
                                const keywords = Array.isArray(obj.keywords) ? (obj.keywords as Array<unknown>).filter(k => typeof k === 'string').slice(0, 12) as string[] : undefined
                                return { chapterId, title, order: i + 1, summary, keywords }
                              })
                            if (chapters.length === 0) throw new Error('Keine Kapitel mit Summary gefunden')

                            const docMod = (() => {
                              const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
                              const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
                              return dt ? dt.toISOString() : undefined;
                            })();
                            const tocUnknown: unknown = (ragStatus as unknown as { analyze?: { toc?: unknown } })?.analyze?.toc
                            const toc: Array<unknown> | undefined = Array.isArray(tocUnknown) ? tocUnknown : undefined
                            const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/upsert-file`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ fileId: item.id, fileName: item.metadata.name, content, mode: 'A', docModifiedAt: docMod, chapters, toc })
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upsert (Analyse) fehlgeschlagen');
                            await loadRagStatus();
                          } catch (e) {
                            setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler beim Upsert (Analyse)');
                          }
                        }}
                      >
                        Upsert (Analyse)
                      </button>
                    </div>
                  </div>
                  {ragLoading && <div className="text-sm text-muted-foreground">Lade Status…</div>}
                  {ragError && <div className="text-sm text-destructive">{ragError}</div>}
                  {ragStatus && (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span>Status:</span>
                        <span className={cn(
                          'inline-flex items-center rounded px-2 py-0.5 text-xs',
                          ragStatus.status === 'ok' && 'bg-green-100 text-green-700',
                          ragStatus.status === 'stale' && 'bg-amber-100 text-amber-800',
                          ragStatus.status === 'not_indexed' && 'bg-gray-100 text-gray-700'
                        )}>
                          {ragStatus.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">fileId: {ragStatus?.fileName ? '' : ''}{(item.id)}</div>
                      <div>Chunks: {ragStatus.chunkCount ?? '—'}</div>
                      <div>Upserted: {ragStatus.upsertedAt ?? '—'}</div>
                      <div>Dokument geändert: {ragStatus.docModifiedAt ?? '—'}</div>
                      {ragStatus.totals && (
                        <div className="text-xs text-muted-foreground">Index totals: {ragStatus.totals.docs} Docs, {ragStatus.totals.chunks} Chunks</div>
                      )}
                      {ragStatus.docMeta && (
                        <div className="mt-2">
                          <div className="font-medium">Dokument-Metadaten</div>
                          <pre className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap break-words text-xs bg-muted/30 p-2 rounded">{JSON.stringify(ragStatus.docMeta, null, 2)}</pre>
                        </div>
                      )}
                      {ragStatus.toc && Array.isArray(ragStatus.toc) && ragStatus.toc.length > 0 && (
                        <div className="mt-2">
                          <div className="font-medium">Kapitel</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {ragStatus.toc.map((t, i: number) => {
                              const obj = t as Record<string, unknown>
                              const title = (typeof obj.title === 'string' ? obj.title : (typeof obj.chapterId === 'string' ? obj.chapterId : 'Kapitel')) as string
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const page = typeof obj.page === 'number' ? obj.page : undefined
                              const order = typeof obj.order === 'number' ? obj.order : undefined
                              const startChunk = typeof obj.startChunk === 'number' ? obj.startChunk : undefined
                              const endChunk = typeof obj.endChunk === 'number' ? obj.endChunk : undefined
                              return (
                                <li key={i} className="text-xs">
                                  {title}
                                  {typeof level === 'number' ? ` (L${level})` : ''}
                                  {typeof page === 'number' ? ` · Seite ${page}` : ''}
                                  {typeof order === 'number' ? ` · Reihenfolge ${order}` : ''}
                                  {typeof startChunk === 'number' && typeof endChunk === 'number' ? ` · Chunks ${startChunk}-${endChunk}` : ''}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                      {ragStatus?.analyze?.chapters && Array.isArray(ragStatus.analyze.chapters) && (
                        <div className="mt-3">
                          <div className="font-medium">Kapitel (Heuristik/LLM)</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5 text-xs max-h-56 overflow-auto">
                            {ragStatus.analyze.chapters.map((c) => {
                              const obj = c as Record<string, unknown>
                              const id = typeof obj.chapterId === 'string' ? obj.chapterId : String(obj.chapterId ?? '')
                              const level = typeof obj.level === 'number' ? obj.level : undefined
                              const title = typeof obj.title === 'string' ? obj.title : 'Kapitel'
                              const startPage = typeof obj.startPage === 'number' ? obj.startPage : undefined
                              const endPage = typeof obj.endPage === 'number' ? obj.endPage : undefined
                              return (
                                <li key={id}>
                                  {typeof level === 'number' ? `L${level}` : 'L?'} · {title} · Seiten {startPage ?? '—'}–{endPage ?? '—'}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="edit" className="h-full mt-0">
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
              </TabsContent>
            </div>
          </Tabs>
        </div>
      );
    case 'pdf':
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
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          isAudioFile,
          isVideoFile,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType, isAudioFile, isVideoFile]);

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
  }, [displayFile?.id]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
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