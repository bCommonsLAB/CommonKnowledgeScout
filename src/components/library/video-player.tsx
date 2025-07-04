'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { VideoTransform } from './video-transform';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { Tabs } from '@/components/ui/tabs';

interface VideoPlayerProps {
  provider: StorageProvider | null;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  activeLibraryId: string;
}

export const VideoPlayer = memo(function VideoPlayer({ provider, onRefreshFolder }: VideoPlayerProps) {
  const item = useAtomValue(selectedFileAtom);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTransform, setShowTransform] = useState(false);
  const [activeTab, setActiveTab] = useState('tab1');

  // Hooks immer außerhalb von Bedingungen aufrufen
  React.useEffect(() => {
    if (!item || !provider) {
      setVideoUrl(null);
      setError(null);
      return;
    }

    const loadVideo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        FileLogger.debug('VideoPlayer', 'Lade Video-URL', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType
        });
        
        // Streaming-URL vom Provider holen
        const url = await provider.getStreamingUrl(item.id);
        if (!url) {
          throw new Error('Keine Streaming-URL verfügbar');
        }
        
        setVideoUrl(url);
        FileLogger.debug('VideoPlayer', 'Video-URL erhalten', { url });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
        FileLogger.error('VideoPlayer', 'Fehler beim Laden des Videos', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();
  }, [item, provider]);

  // Cleanup-Funktion für Object URLs
  React.useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Debug Logging
  useEffect(() => {
    FileLogger.debug('VideoPlayer', 'Mounted with item', {
      itemId: item?.id,
      itemName: item?.metadata.name,
      mimeType: item?.metadata.mimeType
    });
  }, [item]);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    const errorCode = video.error?.code;
    let errorMessage = 'Unbekannter Fehler';
    
    switch (errorCode) {
      case 1:
        errorMessage = 'Der Ladevorgang wurde abgebrochen';
        break;
      case 2:
        errorMessage = 'Netzwerkfehler';
        break;
      case 3:
        errorMessage = 'Fehler beim Dekodieren der Video-Datei';
        break;
      case 4:
        errorMessage = 'Video-Format wird nicht unterstützt';
        break;
    }

    setError(errorMessage);
    
    if (process.env.NODE_ENV === 'development') {
      FileLogger.error('VideoPlayer', 'Error', {
        error,
        errorCode,
        errorMessage,
        networkState: video.networkState,
        readyState: video.readyState,
        src: video.currentSrc
      });
    }
  };

  const handleTransformButtonClick = () => {
    setShowTransform(true);
  };

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Keine Videodatei ausgewählt
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Lade Video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Fehler beim Laden des Videos: {error}
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Video konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {item && (
        <div className="flex items-center justify-between mx-4 mt-4 mb-2 flex-shrink-0">
          <div className="text-xs text-muted-foreground">
            {item.metadata.name}
          </div>
          {onRefreshFolder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTransformButtonClick}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Transformieren
            </Button>
          )}
        </div>
      )}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-start justify-start p-4 gap-4">
            <div className="flex-1 max-w-4xl">
              <video
                ref={videoRef}
                controls
                className="w-full"
                onError={handleError}
              >
                <source src={videoUrl} type={item.metadata.mimeType} />
                Ihr Browser unterstützt das Video-Element nicht.
              </video>
            </div>

            {/* Transform Dialog */}
            {showTransform && (
              <div className="w-80 border rounded-lg p-4 bg-background flex-shrink-0">
                <VideoTransform 
                  onRefreshFolder={(folderId, updatedItems, twinItem) => {
                    FileLogger.info('VideoPlayer', 'Video Transformation abgeschlossen', {
                      originalFile: item.metadata.name,
                      transcriptFile: updatedItems[0]?.metadata.name || 'unknown'
                    });
                    
                    // UI schließen
                    setShowTransform(false);
                    
                    // Informiere die übergeordnete Komponente über die Aktualisierung
                    if (onRefreshFolder) {
                      onRefreshFolder(folderId, updatedItems, twinItem);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  );
}, (prevProps, nextProps) => {
  const shouldUpdate = prevProps.provider !== nextProps.provider;
  if (process.env.NODE_ENV === 'development') {
    FileLogger.debug('VideoPlayer', 'Memo comparison', {
      hasChanged: shouldUpdate
    });
  }
  return !shouldUpdate;
}); 