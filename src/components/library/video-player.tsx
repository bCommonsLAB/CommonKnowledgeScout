'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem } from '@/lib/storage/types';
import { VideoTransform } from './video-transform';
import { Button } from '@/components/ui/button';
import { Wand2 } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';

interface VideoPlayerProps {
  item: StorageItem;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export const VideoPlayer = memo(function VideoPlayer({ item, onRefreshFolder }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransform, setShowTransform] = useState(false);
  const lastProgressRef = useRef<{
    currentTime: number;
    readyState: number;
    networkState: number;
    buffered: { start: number; end: number } | null;
  } | null>(null);
  
  // Hole die aktive Bibliotheks-ID aus dem globalen Zustand
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);

  // Debug Logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[VideoPlayer] Mounted with item:', {
        id: item.id,
        name: item.metadata.name,
        mimeType: item.metadata.mimeType
      });
    }

    // Reset states when item changes
    setError(null);
    setIsLoading(true);

    const videoElement = videoRef.current;

    // Cleanup function
    return () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    };
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
    setIsLoading(true);
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
    setIsLoading(false);
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
    setIsLoading(false);
    
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

  const videoUrl = `/api/storage/filesystem?action=binary&fileId=${item.id}&libraryId=${activeLibraryId}`;

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
      {error && (
        <div className="text-sm text-red-500 mb-2">
          Fehler beim Laden der Video-Datei: {error}
        </div>
      )}
      {isLoading && !error && (
        <div className="text-sm text-muted-foreground mb-2">
          Video-Datei wird geladen...
        </div>
      )}
      <video 
        ref={videoRef}
        controls 
        className={`w-full ${isLoading ? 'opacity-50' : ''}`}
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
  const shouldUpdate = prevProps.item.id !== nextProps.item.id;
  if (process.env.NODE_ENV === 'development') {
    console.log('[VideoPlayer] Memo comparison:', {
      prevId: prevProps.item.id,
      nextId: nextProps.item.id,
      shouldUpdate
    });
  }
  return !shouldUpdate;
}); 