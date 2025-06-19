'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { VideoTransform } from './video-transform';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface VideoPlayerProps {
  provider: StorageProvider | null;
  activeLibraryId: string;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function VideoPlayer({ provider, activeLibraryId, onRefreshFolder }: VideoPlayerProps) {
  const item = useAtomValue(selectedFileAtom);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showTransform, setShowTransform] = React.useState(false);
  const lastProgressRef = React.useRef<{
    currentTime: number;
    readyState: number;
    networkState: number;
    buffered: { start: number; end: number } | null;
  } | null>(null);

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
      FileLogger.debug('VideoPlayer', 'Progress', { currentProgress });
      lastProgressRef.current = currentProgress;
    }
  };

  const handleLoadStart = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      FileLogger.debug('VideoPlayer', 'Load started', {
        itemId: item?.id,
        itemName: item?.metadata.name
      });
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      FileLogger.debug('VideoPlayer', 'Metadata loaded', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      });
    }
  };

  const handleCanPlay = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      FileLogger.debug('VideoPlayer', 'Can play', {
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
      FileLogger.error('VideoPlayer', 'Error', {
        error,
        itemId: item?.id,
        itemName: item?.metadata.name
      });
    }
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
    <div className="flex items-center justify-center h-full p-4">
      <video
        controls
        className="w-full max-w-4xl"
        onError={handleError}
      >
        <source src={videoUrl} type={item.metadata.mimeType} />
        Ihr Browser unterstützt das Video-Element nicht.
      </video>
    </div>
  );
} 