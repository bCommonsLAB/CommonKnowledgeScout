'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from "react";
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AudioPlayer } from './audio-player';
import { MarkdownPreview } from './markdown-preview';
import { MarkdownMetadata, extractFrontmatter } from './markdown-metadata';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtomValue } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import { TextEditor } from './text-editor';

interface FilePreviewProps {
  item: StorageItem | null;
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
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'url':
      return 'website';
    default:
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
    if (!item?.id || !provider) return;
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
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

      if (!isAudioFile && fileType !== 'image' && !isVideoFile) {
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      console.error('[ContentLoader] Failed to load file:', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, provider, fileType, isAudioFile, isVideoFile, onContentLoaded, isTemplateFile, contentCache]);

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
  if (error) {
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  switch (fileType) {
    case 'audio':
      return <AudioPlayer item={item} onRefreshFolder={onRefreshFolder} />;
    case 'image':
      return (
        <img 
          src={`/api/storage/filesystem?action=binary&fileId=${item.id}&libraryId=${activeLibraryId}`}
          alt={item.metadata.name}
          className="max-w-full h-auto"
        />
      );
    case 'video':
      return (
        <video 
          controls
          src={`/api/storage/filesystem?action=binary&fileId=${item.id}&libraryId=${activeLibraryId}`}
          className="max-w-full h-auto"
        />
      );
    case 'markdown':
      const [activeTab, setActiveTab] = React.useState<string>("preview");
      
      // Bei Änderung der Datei-ID auf Vorschau-Tab zurücksetzen
      React.useEffect(() => {
        setActiveTab("preview");
      }, [item.id]);
      
      return (
        <Tabs defaultValue="preview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="preview">Vorschau</TabsTrigger>
            <TabsTrigger value="edit">Bearbeiten</TabsTrigger>
          </TabsList>
          <TabsContent value="preview">
            <MarkdownPreview 
              content={content}
              currentFolderId={item.parentId}
              provider={provider}
              currentItem={item}
              onTransform={() => {
                // Hier zur Bearbeitungsansicht wechseln
                setActiveTab("edit");
              }}
              onRefreshFolder={onRefreshFolder}
            />
          </TabsContent>
          <TabsContent value="edit">
            <TextEditor 
              content={content}
              item={item}
              provider={provider}
              onSave={async (newContent) => {
                // Speichern der bearbeiteten Datei
                if (provider && onRefreshFolder) {
                  try {
                    // Sofort den Inhalt für die Vorschau aktualisieren
                    onContentUpdated(newContent);
                    
                    // Nach dem Speichern zur Vorschau wechseln
                    setActiveTab("preview");
                    
                    // Datei aktualisieren - wir laden eine neue Datei hoch, da die API keine direkte Update-Methode hat
                    const blob = new Blob([newContent], { type: 'text/markdown' });
                    const file = new File([blob], item.metadata.name, { type: 'text/markdown' });
                    
                    // Zuerst die alte Datei löschen
                    await provider.deleteItem(item.id);
                    
                    // Dann die neue Datei hochladen
                    const updatedItem = await provider.uploadFile(item.parentId, file);
                    
                    // Ordnerinhalt aktualisieren und neu laden
                    const updatedItems = await provider.listItemsById(item.parentId);
                    
                    // Den Content Cache für diese Datei explizit leeren
                    // Wir erzwingen damit, dass der ContentLoader die Datei neu lädt
                    console.log('Cache für die neue Datei wird zurückgesetzt');
                    contentCache.current.clear();
                    
                    // Die Callback-Funktion aufrufen, um die Benutzeroberfläche zu aktualisieren
                    onRefreshFolder(item.parentId, updatedItems, updatedItem);
                  } catch (error) {
                    console.error("Fehler beim Aktualisieren der Datei:", error);
                  }
                }
              }}
            />
          </TabsContent>
        </Tabs>
      );
    case 'pdf':
    case 'docx':
    case 'pptx':
    case 'presentation':
      return (
        <iframe 
          src={`/api/storage/filesystem?action=binary&fileId=${item.id}&libraryId=${activeLibraryId}`}
          title={item.metadata.name}
          className="w-full h-screen"
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

// Hauptkomponente
export function FilePreview({ 
  item, 
  provider,
  className,
  onRefreshFolder
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Memoize state reducer
  const reducer = React.useCallback((state: any, action: any) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content, hasMetadata: action.hasMetadata };
      case 'SET_ERROR':
        return { ...state, error: action.error };
      case 'UPDATE_CONTENT':
        // Direkte Aktualisierung des Inhalts, ohne Neuladung der Datei
        return { ...state, content: action.content };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null as string | null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    item ? getFileType(item.metadata.name) : 'unknown', 
    [item?.metadata?.name]
  );
  
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

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
    if (item?.id) {
      console.log('FilePreview: Neues Item geladen, Cache wird zurückgesetzt');
      contentCache.current.clear();
    }
  }, [item?.id]);

  if (!item) {
    return (
      <div className={cn("flex items-start justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full", className)}>
      <ContentLoader
        item={item}
        provider={provider}
        fileType={fileType}
        isAudioFile={isAudioFile}
        isVideoFile={isVideoFile}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <PreviewContent
        item={item}
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