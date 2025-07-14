'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { FileLogger } from "@/lib/debug/logger";
import { StorageProvider, StorageItem } from "@/lib/storage/types";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { ImageTransform } from './image-transform';

interface ImagePreviewProps {
  provider: StorageProvider | null;
  activeLibraryId: string;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function ImagePreview({ provider, onRefreshFolder }: ImagePreviewProps) {
  const item = useAtomValue(selectedFileAtom);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showTransform, setShowTransform] = React.useState(false);
  const loadingRef = React.useRef<string | null>(null); // Verhindert doppelte Requests

  // Debug-Log für ImagePreview-Komponente
  React.useEffect(() => {
    FileLogger.info('ImagePreview', 'ImagePreview-Komponente gerendert', {
      hasItem: !!item,
      itemId: item?.id,
      itemName: item?.metadata.name,
      mimeType: item?.metadata.mimeType,
      hasProvider: !!provider,
      providerName: provider?.name,
      imageUrl,
      isLoading,
      loadingRef: loadingRef.current
    });
  }, [item, provider, imageUrl, isLoading]);

  React.useEffect(() => {
    if (!item || !provider) {
      FileLogger.debug('ImagePreview', 'useEffect abgebrochen', {
        hasItem: !!item,
        hasProvider: !!provider,
        itemId: item?.id,
        itemName: item?.metadata.name
      });
      return;
    }

    // Verhindere doppelte Requests für dieselbe Datei
    if (loadingRef.current === item.id) {
      FileLogger.debug('ImagePreview', 'Request läuft bereits für diese Datei', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      return;
    }

    const loadImage = async () => {
      try {
        FileLogger.info('ImagePreview', 'Starte Bild-Laden', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType,
          providerName: provider.name
        });
        
        loadingRef.current = item.id;
        setIsLoading(true);
        
        FileLogger.debug('ImagePreview', 'Lade Bild-URL', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType
        });
        
        // Streaming-URL vom Provider holen
        const url = await provider.getStreamingUrl(item.id);
        
        FileLogger.debug('ImagePreview', 'getStreamingUrl aufgerufen', {
          itemId: item.id,
          hasUrl: !!url,
          urlLength: url?.length,
          url: url?.substring(0, 100) + '...'
        });
        
        if (!url) {
          FileLogger.error('ImagePreview', 'Keine Streaming-URL verfügbar', {
            itemId: item.id,
            itemName: item.metadata.name,
            providerName: provider.name
          });
          throw new Error('Keine Streaming-URL verfügbar');
        }
        
        FileLogger.info('ImagePreview', 'Bild-URL erhalten', { 
          itemId: item.id,
          url: url.substring(0, 100) + '...', // Nur die ersten 100 Zeichen loggen
          urlLength: url.length
        });
        
        setImageUrl(url);
      } catch (err) {
        FileLogger.error('ImagePreview', 'Fehler beim Laden des Bildes', {
          error: err,
          itemId: item.id,
          itemName: item.metadata.name,
          providerName: provider.name
        });
      } finally {
        setIsLoading(false);
        loadingRef.current = null;
        FileLogger.debug('ImagePreview', 'Bild-Laden abgeschlossen', {
          itemId: item.id,
          hasImageUrl: !!imageUrl,
          isLoading: false
        });
      }
    };

    loadImage();
  }, [item?.id, provider]); // Nur item.id und provider als Dependencies

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingRef.current = null;
    };
  }, []);

  if (!item) {
    FileLogger.debug('ImagePreview', 'Kein Item ausgewählt');
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Kein Bild ausgewählt
      </div>
    );
  }

  if (isLoading) {
    FileLogger.debug('ImagePreview', 'Zeige Loading-State', {
      itemId: item.id,
      itemName: item.metadata.name
    });
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
    FileLogger.warn('ImagePreview', 'Keine Bild-URL verfügbar', {
      itemId: item.id,
      itemName: item.metadata.name,
      hasProvider: !!provider
    });
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Bild konnte nicht geladen werden
      </div>
    );
  }

  FileLogger.debug('ImagePreview', 'Rendere Bild', {
    itemId: item.id,
    itemName: item.metadata.name,
    imageUrlLength: imageUrl.length
  });

  const handleTransformButtonClick = () => {
    setShowTransform(true);
  };

  return (
    <div className="flex flex-col h-full">
      {item && (
        <div className="flex items-center justify-between mx-4 mt-4 mb-2 flex-shrink-0">
          {/* Kopfzeile: Image Preview | Dateiname | Transform-Button */}
          <div className="flex items-center gap-2 w-full">
            <span className="text-xs font-semibold text-muted-foreground">Image Preview</span>
            <span className="text-xs text-muted-foreground truncate max-w-[40vw]">{item.metadata.name}</span>
            <div className="flex-1" />
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
        </div>
      )}
      
      {showTransform ? (
        <div className="flex-1 overflow-auto">
          <ImageTransform 
            onRefreshFolder={(folderId, updatedItems, twinItem) => {
              FileLogger.info('ImagePreview', 'Bild-Transformation abgeschlossen', {
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
      ) : (
        <div className="flex items-start justify-center h-full p-4 overflow-auto">
          <img
            src={imageUrl}
            alt={item.metadata.name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => {
              FileLogger.info('ImagePreview', 'Bild erfolgreich geladen', {
                itemId: item.id,
                itemName: item.metadata.name
              });
            }}
            onError={(e) => {
              FileLogger.error('ImagePreview', 'Fehler beim Laden des Bildes', {
                itemId: item.id,
                itemName: item.metadata.name,
                imageUrl: imageUrl.substring(0, 100) + '...',
                errorEvent: e
              });
            }}
          />
        </div>
      )}
    </div>
  );
} 