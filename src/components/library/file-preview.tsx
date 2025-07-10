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
  const setSelectedFile = useSetAtom(selectedFileAtom);
  React.useEffect(() => {
    setActiveTab("preview");
  }, [item.id]);

  if (error) {
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  switch (fileType) {
    case 'audio':
      return <AudioPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
        />
      );
    case 'video':
      return <VideoPlayer provider={provider} activeLibraryId={activeLibraryId} onRefreshFolder={onRefreshFolder} />;
    case 'markdown':
      return (
        <div className="h-full flex flex-col">
          <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="mx-4 mt-2 flex-shrink-0">
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
            </TabsList>
            <div className="flex-1 min-h-0">
              <TabsContent value="preview" className="h-full mt-0">
                <MarkdownPreview 
                  content={content}
                  currentFolderId={item.parentId}
                  provider={provider}
                  className="h-full"
                  onTransform={() => setActiveTab("edit")}
                  onRefreshFolder={onRefreshFolder}
                />
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
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFile = useAtomValue(selectedFileAtom);
  
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
    selectedFile ? getFileType(selectedFile.metadata.name) : 'unknown', 
    [selectedFile]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    FileLogger.debug('FilePreview', 'handleContentLoaded aufgerufen', {
      contentLength: content.length,
      hasMetadata,
      selectedFileId: selectedFile?.id,
      selectedFileName: selectedFile?.metadata.name
    });
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, [selectedFile]);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    FileLogger.debug('FilePreview', 'handleContentUpdated aufgerufen', {
      contentLength: content.length,
      selectedFileId: selectedFile?.id,
      selectedFileName: selectedFile?.metadata.name
    });
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, [selectedFile]);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (selectedFile?.id) {
      FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
        itemId: selectedFile.id,
        itemName: selectedFile.metadata.name,
        cacheSize: contentCache.current.size
      });
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(selectedFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== selectedFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
    }
  }, [selectedFile?.id]);

  if (!selectedFile) {
    return (
      <div className={cn("absolute inset-0 flex items-center justify-center", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("absolute inset-0", className)}>
      <ContentLoader
        item={selectedFile}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <PreviewContent
        item={selectedFile}
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
  );
}