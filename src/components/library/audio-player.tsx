'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem } from '@/lib/storage/types';

interface AudioPlayerProps {
  item: StorageItem;
}

// Formatiert Sekunden in MM:SS Format
function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export const AudioPlayer = memo(function AudioPlayer({ item }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastProgressRef = useRef<{
    currentTime: number;
    readyState: number;
    networkState: number;
    buffered: { start: number; end: number } | null;
  } | null>(null);

  // Debug Logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Mounted with item:', {
        id: item.id,
        name: item.metadata.name,
        mimeType: item.metadata.mimeType
      });
    }

    // Reset states when item changes
    setError(null);
    setIsLoading(true);

    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }
    };
  }, [item]);

  const handleProgress = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    
    // Nur loggen wenn sich etwas signifikant geändert hat
    const currentProgress = {
      currentTime: audio.currentTime,
      readyState: audio.readyState,
      networkState: audio.networkState,
      buffered: audio.buffered.length > 0 ? {
        start: audio.buffered.start(0),
        end: audio.buffered.end(0)
      } : null
    };

    const hasSignificantChange = !lastProgressRef.current || 
      lastProgressRef.current.readyState !== currentProgress.readyState ||
      (lastProgressRef.current.networkState !== currentProgress.networkState && 
       // Ignoriere schnelle Wechsel zwischen NETWORK_IDLE und NETWORK_LOADING
       !(currentProgress.networkState <= 2 && lastProgressRef.current.networkState <= 2)) ||
      JSON.stringify(lastProgressRef.current.buffered) !== JSON.stringify(currentProgress.buffered);

    if (hasSignificantChange && process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Progress:', currentProgress);
      lastProgressRef.current = currentProgress;
    }
  };

  const handleLoadStart = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    setIsLoading(true);
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Load started:', {
        currentTime: audio.currentTime,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Metadata loaded:', {
        duration: audio.duration,
        readyState: audio.readyState
      });
    }
  };

  const handleCanPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    setIsLoading(false);
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Can play:', {
        duration: audio.duration,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    const errorCode = audio.error?.code;
    let errorMessage = 'Unbekannter Fehler';
    
    switch (errorCode) {
      case 1:
        errorMessage = 'Der Ladevorgang wurde abgebrochen';
        break;
      case 2:
        errorMessage = 'Netzwerkfehler';
        break;
      case 3:
        errorMessage = 'Fehler beim Dekodieren der Audio-Datei';
        break;
      case 4:
        errorMessage = 'Audio-Format wird nicht unterstützt';
        break;
    }

    setError(errorMessage);
    setIsLoading(false);
    
    if (process.env.NODE_ENV === 'development') {
      console.error('[AudioPlayer] Error:', {
        error: audio.error,
        errorCode,
        errorMessage,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.currentSrc
      });
    }
  };

  const audioUrl = `/api/storage/filesystem?action=binary&fileId=${item.id}`;

  return (
    <div className="my-4">
      <div className="text-xs text-muted-foreground mb-2">
        {item.metadata.name}
      </div>
      {error && (
        <div className="text-sm text-red-500 mb-2">
          Fehler beim Laden der Audio-Datei: {error}
        </div>
      )}
      {isLoading && !error && (
        <div className="text-sm text-muted-foreground mb-2">
          Audio-Datei wird geladen...
        </div>
      )}
      <audio 
        ref={audioRef}
        controls 
        className={`w-full ${isLoading ? 'opacity-50' : ''}`}
        preload="metadata"
        onLoadStart={handleLoadStart}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onProgress={handleProgress}
        onError={handleError}
        src={audioUrl}
      >
        <source 
          src={audioUrl}
          type={item.metadata.mimeType || 'audio/mpeg'} 
        />
        Ihr Browser unterstützt das Audio-Element nicht.
      </audio>
    </div>
  );
}, (prevProps, nextProps) => {
  const shouldUpdate = prevProps.item.id !== nextProps.item.id;
  if (process.env.NODE_ENV === 'development') {
    console.log('[AudioPlayer] Memo comparison:', {
      prevId: prevProps.item.id,
      nextId: nextProps.item.id,
      shouldUpdate
    });
  }
  return !shouldUpdate;
}); 