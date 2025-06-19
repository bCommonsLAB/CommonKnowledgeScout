'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { StorageProvider } from "@/lib/storage/types";

interface ImagePreviewProps {
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function ImagePreview({ provider }: ImagePreviewProps) {
  const item = useAtomValue(selectedFileAtom);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!item || !provider) return;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        
        FileLogger.debug('ImagePreview', 'Lade Bild-URL', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType
        });
        
        // Streaming-URL vom Provider holen
        const url = await provider.getStreamingUrl(item.id);
        if (!url) {
          throw new Error('Keine Streaming-URL verfügbar');
        }
        
        setImageUrl(url);
        FileLogger.debug('ImagePreview', 'Bild-URL erhalten', { url });
      } catch (err) {
        FileLogger.error('ImagePreview', 'Fehler beim Laden des Bildes', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadImage();
  }, [item, provider]);

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Kein Bild ausgewählt
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Lade Bild...</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Bild konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <img
        src={imageUrl}
        alt={item.metadata.name}
        className="max-w-full max-h-full object-contain"
        onError={() => {
          FileLogger.error('ImagePreview', 'Fehler beim Laden des Bildes', {
            itemId: item.id,
            itemName: item.metadata.name
          });
        }}
      />
    </div>
  );
} 