'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { VideoTransform } from './video-transform';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  item: StorageItem;
  provider: StorageProvider | null;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export const VideoPlayer = memo(function VideoPlayer({ item, provider, onRefreshFolder }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransform, setShowTransform] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const lastProgressRef = useRef<{
    currentTime: number;
    readyState: number;
    networkState: number;
    buffered: { start: number; end: number } | null;
  } | null>(null);
  
  // Video-URL über Provider laden
  useEffect(() => {
    let objectUrl: string | null = null;
    const videoElement = videoRef.current;

    const loadVideo = async () => {
      if (!provider) {
        setError('Kein Storage Provider verfügbar');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        // Verwende die getBinary Methode des Providers
        const { blob } = await provider.getBinary(item.id);
        
        // Erstelle eine Object URL für das Video
        objectUrl = URL.createObjectURL(blob);
        setVideoUrl(objectUrl);
      } catch (err) {
        console.error('[VideoPlayer] Fehler beim Laden der Video-Datei:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Video-Datei');
      } finally {
        setIsLoading(false);
      }
    };

    loadVideo();

    // Cleanup: Object URL freigeben
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      // Reset video element
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    };
  }, [item.id, provider]);

  // Debug Logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Mounted with item:', {
        id: item.id,
        name: item.metadata.name,
        mimeType: item.metadata.mimeType
      });
    }
  }, [item]);

  const handleProgress = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    
    // Nur loggen wenn sich etwas signifikant geändert hat
    const currentProgress = {
      currentTime: video.currentTime,
      readyState: video.readyState,
      networkState: video.networkState,
      buffered: video.buffered.length > 0 ? {
        start: video.buffered.start(0),
        end: video.buffered.end(0)
      } : null
    };

    const hasSignificantChange = !lastProgressRef.current || 
      lastProgressRef.current.readyState !== currentProgress.readyState ||
      (lastProgressRef.current.networkState !== currentProgress.networkState && 
       // Ignoriere schnelle Wechsel zwischen NETWORK_IDLE und NETWORK_LOADING
       !(currentProgress.networkState <= 2 && lastProgressRef.current.networkState <= 2)) ||
      JSON.stringify(lastProgressRef.current.buffered) !== JSON.stringify(currentProgress.buffered);

    if (hasSignificantChange && process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Progress:', currentProgress);
      lastProgressRef.current = currentProgress;
    }
  };

  const handleLoadStart = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Load started:', {
        currentTime: video.currentTime,
        readyState: video.readyState,
        networkState: video.networkState
      });
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Metadata loaded:', {
        duration: video.duration,
        readyState: video.readyState
      });
    }
  };

  const handleCanPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Can play:', {
        duration: video.duration,
        readyState: video.readyState,
        networkState: video.networkState
      });
    }
  };

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
      console.error('[VideoPlayer] Error:', {
        error: video.error,
        errorCode,
        errorMessage,
        networkState: video.networkState,
        readyState: video.readyState,
        src: video.currentSrc
      });
    }
  };

  if (error) {
    return (
      <div className="my-4 mx-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="my-4 mx-4 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="my-4 mx-4 text-center text-muted-foreground">
        Video konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div className="my-4 mx-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">
          {item.metadata.name}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTransform(!showTransform)}
        >
          <Wand2 className="h-4 w-4 mr-2" />
          Verarbeiten
        </Button>
      </div>
      <video 
        ref={videoRef}
        controls 
        className="w-full"
        preload="metadata"
        onLoadStart={handleLoadStart}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onProgress={handleProgress}
        onError={handleError}
        src={videoUrl}
      >
        <source 
          src={videoUrl}
          type={item.metadata.mimeType || 'video/mp4'} 
        />
        Ihr Browser unterstützt das Video-Element nicht.
      </video>

      {showTransform && (
        <div className="mt-4 border rounded-lg">
          <VideoTransform 
            item={item}
            onRefreshFolder={(folderId, updatedItems, twinItem) => {
              console.log('Video Transformation abgeschlossen', {
                folderId,
                itemsCount: updatedItems.length,
                twinItemId: twinItem?.id
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
  );
}, (prevProps, nextProps) => {
  const shouldUpdate = prevProps.item.id !== nextProps.item.id || prevProps.provider !== nextProps.provider;
  if (process.env.NODE_ENV === 'development') {
    console.log('[VideoPlayer] Memo comparison:', {
      prevId: prevProps.item.id,
      nextId: nextProps.item.id,
      providerChanged: prevProps.provider !== nextProps.provider,
      shouldUpdate
    });
  }
  return !shouldUpdate;
}); 