'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { StorageProvider } from '@/lib/storage/types';

interface VideoPlayerProps {
  provider: StorageProvider | null;
}

export function VideoPlayer({ provider }: VideoPlayerProps) {
  const item = useAtomValue(selectedFileAtom);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      >
        <source src={videoUrl} type={item.metadata.mimeType} />
        Ihr Browser unterstützt das Video-Element nicht.
      </video>
    </div>
  );
} 