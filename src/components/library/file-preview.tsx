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

interface FilePreviewProps {
  item: StorageItem | null;
  className?: string;
  provider: StorageProvider | null;
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

export const FilePreview = React.memo(function FilePreview({ 
  item, 
  provider,
  className 
}: FilePreviewProps) {
  // Early return for empty state
  if (!item) {
    return (
      <div className={cn("flex items-start justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  // Memoize file type check
  const fileType = React.useMemo(() => getFileType(item.metadata.name), [item.metadata.name]);
  const isAudioFile = React.useMemo(() => fileType === 'audio', [fileType]);
  const isVideoFile = React.useMemo(() => fileType === 'video', [fileType]);

  // Debug logging in useEffect
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[FilePreview] Render:', {
        itemId: item?.id,
        name: item?.metadata.name,
        type: fileType,
        hasProvider: !!provider
      });
    }
  }, [item?.id, item?.metadata.name, fileType, provider]);

  // State Management
  const [state, dispatch] = React.useReducer((state: any, action: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[FilePreview] Action:', action.type);
    }

    switch (action.type) {
      case 'START_LOADING':
        return { ...state, isLoading: true, error: null };
      case 'SET_CONTENT':
        return { 
          ...state, 
          content: action.content, 
          isLoading: false,
          hasMetadata: action.hasMetadata 
        };
      case 'SET_TRANSCRIPTION':
        return { 
          ...state, 
          transcriptionContent: action.content,
          hasMetadata: action.hasMetadata 
        };
      case 'SET_ERROR':
        return { ...state, error: action.error, isLoading: false };
      default:
        return state;
    }
  }, {
    content: '',
    error: null as string | null,
    isLoading: false,
    transcriptionContent: null as string | null,
    hasMetadata: false
  });

  // Refs für Content Loading
  const loadingIdRef = React.useRef<string | null>(null);

  // Content Loading
  const loadContent = React.useCallback(async (itemId: string, itemProvider: StorageProvider) => {
    if (loadingIdRef.current === itemId) {
      console.log('[FilePreview] Skip loading - already in progress');
      return;
    }
    
    console.log('[FilePreview] Start loading content');
    
    loadingIdRef.current = itemId;
    
    if (fileType === 'unknown') {
      console.log('[FilePreview] Skip loading - unknown file type');
      return;
    }
    
    try {
      // For non-audio, non-image, and non-video files, load the content
      if (!isAudioFile && fileType !== 'image' && !isVideoFile) {
        console.log('[FilePreview] Loading binary content');
        const content = await itemProvider.getBinary(itemId).then(({ blob }) => blob.text());
        console.log('[FilePreview] Content loaded');
        const hasMetadata = !!extractFrontmatter(content);
        dispatch({ type: 'SET_CONTENT', content, hasMetadata });
      } else {
        // For audio, image, and video files, immediately mark as loaded
        dispatch({ type: 'SET_CONTENT', content: '', hasMetadata: false });
      }

      // Load transcript if available
      if (item?.metadata.transcriptionTwin) {
        console.log('[FilePreview] Loading transcript');
        const transcriptItem = await itemProvider.getItemById(item.metadata.transcriptionTwin.id);
        const transcriptContent = await itemProvider.getBinary(transcriptItem.id).then(({ blob }) => blob.text());
        console.log('[FilePreview] Transcript loaded');
        const hasMetadata = !!extractFrontmatter(transcriptContent);
        dispatch({ type: 'SET_TRANSCRIPTION', content: transcriptContent, hasMetadata });
      }
    } catch (err) {
      console.error('[FilePreview] Failed to load file:', err);
      dispatch({ type: 'SET_ERROR', error: 'Fehler beim Laden der Datei' });
    } finally {
      if (loadingIdRef.current === itemId) {
        loadingIdRef.current = null;
      }
    }
  }, [item, fileType, isAudioFile, isVideoFile]);

  // Load content when item changes
  React.useEffect(() => {
    if (!item || !provider || fileType === 'unknown') {
      console.log('[FilePreview] Skip loading - missing item, provider, or unknown file type');
      return;
    }

    console.log('[FilePreview] Item changed - loading new content');

    if (!isAudioFile && fileType !== 'image' && !isVideoFile) {
      dispatch({ type: 'START_LOADING' });
    }
    loadContent(item.id, provider);

    return () => {
      loadingIdRef.current = null;
    };
  }, [item, provider, loadContent, isAudioFile, fileType, isVideoFile]);

  // Memoize audio player component
  const audioPlayer = React.useMemo(() => {
    if (!isAudioFile || !item) return null;
    return <AudioPlayer item={item} />;
  }, [isAudioFile, item]);

  // Render content based on file type
  const renderedContent = React.useMemo(() => {
    if (!item) return null;
    
    console.log('[FilePreview] Rendering content');

    if (state.error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{state.error}</AlertDescription></Alert>;
    
    const previewContent = () => {
      switch (fileType) {
        case 'audio':
          return audioPlayer;
        case 'image':
          return (
            <img 
              src={`/api/storage/filesystem?action=binary&fileId=${item.id}`}
              alt={item.metadata.name}
              className="max-w-full h-auto"
            />
          );
        case 'video':
          return (
            <video 
              controls
              src={`/api/storage/filesystem?action=binary&fileId=${item.id}`}
              className="max-w-full h-auto"
            />
          );
        case 'markdown':
          return (
            <MarkdownPreview 
              content={state.content}
              currentFolderId={item.parentId}
              provider={provider}
              currentItem={item}
            />
          );
        case 'pdf':
        case 'docx':
        case 'pptx':
        case 'presentation':
          return (
            <iframe 
              src={`/api/storage/filesystem?action=binary&fileId=${item.id}`}
              title={item.metadata.name}
              className="w-full h-screen"
            />
          );
        case 'website':
          const urlContent = state.content.match(/URL=(.*)/)?.[1];
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
    };

    const hasPreview = fileType !== 'unknown';
    const hasTranscript = !!state.transcriptionContent;
    const hasSummary = false; // TODO: Implementierung der Zusammenfassung

    return (
      <Tabs defaultValue="preview" className="w-full">
        <TabsList>
          <TabsTrigger value="preview" disabled={!hasPreview}>
            Vorschau
          </TabsTrigger>
          <TabsTrigger value="metadata" disabled={!state.hasMetadata}>
            Metadaten
          </TabsTrigger>
          <TabsTrigger value="transcript" disabled={!hasTranscript}>
            Transkript
          </TabsTrigger>
          <TabsTrigger value="summary" disabled={!hasSummary}>
            Zusammenfassung
          </TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          {state.isLoading && !isAudioFile && fileType !== 'image' && !isVideoFile ? (
            <Skeleton className="w-full h-32" />
          ) : (
            previewContent()
          )}
        </TabsContent>
        <TabsContent value="metadata">
          <MarkdownMetadata 
            content={state.transcriptionContent || state.content} 
          />
        </TabsContent>
        <TabsContent value="transcript">
          {state.transcriptionContent && (
            <MarkdownPreview 
              content={state.transcriptionContent}
              currentFolderId={item.parentId}
              provider={provider}
              currentItem={item}
            />
          )}
        </TabsContent>
        <TabsContent value="summary">
          <div className="text-center text-muted-foreground">
            Zusammenfassung noch nicht verfügbar.
          </div>
        </TabsContent>
      </Tabs>
    );
  }, [item, state, fileType, isAudioFile, isVideoFile, provider, audioPlayer]);

  return (
    <div className={cn("h-full overflow-y-auto", className)}>
      {renderedContent}
    </div>
  );
});