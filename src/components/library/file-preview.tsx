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
import { MarkdownMetadata } from './markdown-metadata';
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
    case 'txt':
    case 'doc':
    case 'docx':
      return 'text';
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
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  // Debug Logging for renders
  if (process.env.NODE_ENV === 'development') {
    console.log('FilePreview render:', {
      itemId: item?.id,
      name: item?.metadata.name,
      renderReason: new Error().stack?.split('\n')[2],
      isStrictMode: React.version.includes('18')
    });
  }

  // Use reducer instead of useState to batch updates
  const [state, dispatch] = React.useReducer((state: any, action: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('FilePreview reducer:', {
        type: action.type,
        currentState: { ...state },
        nextState: (() => {
          switch (action.type) {
            case 'START_LOADING':
              return { ...state, isLoading: true, error: null };
            case 'SET_CONTENT':
              return { ...state, content: action.content, isLoading: false };
            case 'SET_TRANSCRIPTION':
              return { ...state, transcriptionContent: action.content };
            case 'SET_ERROR':
              return { ...state, error: action.error, isLoading: false };
            default:
              return state;
          }
        })()
      });
    }

    switch (action.type) {
      case 'START_LOADING':
        return { ...state, isLoading: true, error: null };
      case 'SET_CONTENT':
        return { ...state, content: action.content, isLoading: false };
      case 'SET_TRANSCRIPTION':
        return { ...state, transcriptionContent: action.content };
      case 'SET_ERROR':
        return { ...state, error: action.error, isLoading: false };
      default:
        return state;
    }
  }, {
    content: '',
    error: null as string | null,
    isLoading: false,
    transcriptionContent: null as string | null
  });

  const contentLoadingRef = React.useRef(false);
  const strictModeRenderRef = React.useRef(0);
  const loadingIdRef = React.useRef<string | null>(null);

  // Stable content loading function
  const loadContent = React.useCallback(async (itemId: string, itemProvider: StorageProvider) => {
    if (loadingIdRef.current === itemId) return;
    loadingIdRef.current = itemId;
    
    try {
      // For non-audio files, load the content
      if (item && getFileType(item.metadata.name) !== 'audio') {
        console.log('Loading content for:', itemId);
        const content = await itemProvider.getBinary(itemId).then(({ blob }) => blob.text());
        dispatch({ type: 'SET_CONTENT', content });
      }

      // Load transcript if available, regardless of file type
      if (item?.metadata.transcriptionTwin) {
        console.log('Loading transcript for:', itemId);
        const transcriptItem = await itemProvider.getItemById(item.metadata.transcriptionTwin.id);
        const transcriptContent = await itemProvider.getBinary(transcriptItem.id).then(({ blob }) => blob.text());
        dispatch({ type: 'SET_TRANSCRIPTION', content: transcriptContent });
      }
    } catch (err) {
      console.error('Failed to load file:', err);
      dispatch({ type: 'SET_ERROR', error: 'Fehler beim Laden der Datei' });
    } finally {
      if (loadingIdRef.current === itemId) {
        loadingIdRef.current = null;
      }
    }
  }, [item]);

  React.useEffect(() => {
    if (!item?.id || !provider) return;

    dispatch({ type: 'START_LOADING' });
    loadContent(item.id, provider);

    return () => {
      loadingIdRef.current = null;
    };
  }, [item?.id, provider, loadContent]);

  const renderedContent = React.useMemo(() => {
    if (!item) return null;
    if (state.error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{state.error}</AlertDescription></Alert>;
    if (state.isLoading) return <Skeleton className="w-full h-32" />;

    const fileType = getFileType(item.metadata.name);
    
    switch (fileType) {
      case 'audio':
        return (
          <>
            <AudioPlayer item={item} />
            {state.transcriptionContent && (
              <MarkdownPreview 
                content={state.transcriptionContent}
                currentFolderId={item.parentId}
                provider={provider}
                currentItem={item}
                className="mt-4"
              />
            )}
          </>
        );
      case 'markdown':
        return (
          <Tabs defaultValue="preview" className="w-full">
            <TabsList>
              <TabsTrigger value="preview">Vorschau</TabsTrigger>
              <TabsTrigger value="metadata">Metadaten</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <MarkdownPreview 
                content={state.content}
                currentFolderId={item.parentId}
                provider={provider}
                currentItem={item}
              />
            </TabsContent>
            <TabsContent value="metadata">
              <MarkdownMetadata content={state.content} />
            </TabsContent>
          </Tabs>
        );
      default:
        return <pre className="whitespace-pre-wrap">{state.content}</pre>;
    }
  }, [item, state.error, state.isLoading, state.content, state.transcriptionContent, provider]);

  const memoizedClassName = React.useMemo(() => cn("p-4", className), [className]);

  return (
    <div className={memoizedClassName}>
      {renderedContent}
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if we should NOT update
  const noUpdate = 
    prevProps.item?.id === nextProps.item?.id &&
    prevProps.provider === nextProps.provider &&
    prevProps.className === nextProps.className;

  if (process.env.NODE_ENV === 'development') {
    console.log('FilePreview memo comparison:', {
      prevItemId: prevProps.item?.id,
      nextItemId: nextProps.item?.id,
      prevProvider: !!prevProps.provider,
      nextProvider: !!nextProps.provider,
      shouldUpdate: !noUpdate
    });
  }

  return noUpdate;
}); 