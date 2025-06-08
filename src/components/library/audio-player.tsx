'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { AudioTransform } from './audio-transform';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  item: StorageItem;
  provider: StorageProvider | null;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}


export const AudioPlayer = memo(function AudioPlayer({ item, provider, onRefreshFolder }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTransform, setShowTransform] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const lastProgressRef = useRef<{
    currentTime: number;
    readyState: number;
    networkState: number;
    buffered: { start: number; end: number } | null;
  } | null>(null);

  // Audio-URL über Provider laden
  useEffect(() => {
    let objectUrl: string | null = null;

    const loadAudio = async () => {
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
        
        // Erstelle eine Object URL für das Audio
        objectUrl = URL.createObjectURL(blob);
        setAudioUrl(objectUrl);
      } catch (err) {
        console.error('[AudioPlayer] Fehler beim Laden der Audio-Datei:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Audio-Datei');
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();

    // Cleanup: Object URL freigeben
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      // Reset audio element
      const audioElement = audioRef.current;
      if (audioElement) {
        audioElement.pause();
        audioElement.removeAttribute('src');
        audioElement.load();
      }
    };
  }, [item.id, provider]);

  // Debug Logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AudioPlayer] Mounted with item:', {
        id: item.id,
        name: item.metadata.name,
        mimeType: item.metadata.mimeType
      });
    }
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

  if (!audioUrl) {
    return (
      <div className="my-4 mx-4 text-center text-muted-foreground">
        Audio konnte nicht geladen werden
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
          Transkribieren
        </Button>
      </div>
      <audio 
        ref={audioRef}
        controls 
        className="w-full"
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

      {showTransform && (
        <div className="mt-4 border rounded-lg">
          <AudioTransform 
            item={item}
            onRefreshFolder={(folderId, updatedItems, twinItem) => {
              console.log('Audio Transformation abgeschlossen', {
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
    console.log('[AudioPlayer] Memo comparison:', {
      prevId: prevProps.item.id,
      nextId: nextProps.item.id,
      providerChanged: prevProps.provider !== nextProps.provider,
      shouldUpdate
    });
  }
  return !shouldUpdate;
}); 