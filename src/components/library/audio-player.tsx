'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { memo, useEffect, useRef, useState } from 'react';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { AudioTransform } from './audio-transform';
import { Button } from '@/components/ui/button';
import { Wand2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AudioPlayerProps {
  provider: StorageProvider | null;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  activeLibraryId: string;
}

export const AudioPlayer = memo(function AudioPlayer({ provider, onRefreshFolder, activeLibraryId }: AudioPlayerProps) {
  const item = useAtomValue(selectedFileAtom);
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

  // Hooks immer außerhalb von Bedingungen aufrufen
  React.useEffect(() => {
    if (!item || !provider) {
      setAudioUrl(null);
      setError(null);
      return;
    }

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        FileLogger.debug('AudioPlayer', 'Lade Audio-URL', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType
        });
        
        // Streaming-URL vom Provider holen
        const url = await provider.getStreamingUrl(item.id);
        if (!url) {
          throw new Error('Keine Streaming-URL verfügbar');
        }
        
        setAudioUrl(url);
        FileLogger.debug('AudioPlayer', 'Audio-URL erhalten', { url });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler';
        FileLogger.error('AudioPlayer', 'Fehler beim Laden des Audios', err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [item, provider]);

  // Cleanup-Funktion für Object URLs
  React.useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Debug Logging
  useEffect(() => {
    FileLogger.debug('AudioPlayer', 'Mounted with item', {
      itemId: item?.id,
      itemName: item?.metadata.name,
      mimeType: item?.metadata.mimeType
    });
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
      lastProgressRef.current = currentProgress;
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
      FileLogger.error('AudioPlayer', 'Error', {
        error,
        errorCode,
        errorMessage,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.currentSrc
      });
    }
  };

  // Füge die fehlenden Event-Handler hinzu
  const handleLoadStart = () => {};
  const handleLoadedMetadata = () => {};
  const handleCanPlay = () => {};

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Keine Audiodatei ausgewählt
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Lade Audio...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        Fehler beim Laden des Audios: {error}
      </div>
    );
  }

  if (!audioUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Audio konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <audio
        ref={audioRef}
        controls
        className="w-full max-w-md"
        onError={handleError}
        onLoadStart={handleLoadStart}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onProgress={handleProgress}
      >
        <source src={audioUrl} type={item.metadata.mimeType} />
        Ihr Browser unterstützt das Audio-Element nicht.
      </audio>

      {showTransform && (
        <div className="mt-4 border rounded-lg">
          <AudioTransform 
            onRefreshFolder={(folderId, updatedItems, twinItem) => {
              FileLogger.info('AudioPlayer', 'Audio Transformation abgeschlossen', {
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
  );
}, (prevProps, nextProps) => {
  const shouldUpdate = prevProps.provider !== nextProps.provider;
  if (process.env.NODE_ENV === 'development') {
    FileLogger.debug('AudioPlayer', 'Memo comparison', {
      hasChanged: shouldUpdate
    });
  }
  return !shouldUpdate;
}); 