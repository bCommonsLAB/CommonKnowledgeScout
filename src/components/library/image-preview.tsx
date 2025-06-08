'use client';

import * as React from 'react';
import Image from "next/image";
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

interface ImagePreviewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function ImagePreview({ item, provider }: ImagePreviewProps) {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      if (!provider) {
        setError('Kein Storage Provider verfügbar');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Verwende die getBinary Methode des Providers
        const { blob } = await provider.getBinary(item.id);
        
        // Erstelle eine Object URL für das Bild
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error('[ImagePreview] Fehler beim Laden des Bildes:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Bildes');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    // Cleanup: Object URL freigeben
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [item.id, provider]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!imageUrl) {
    return (
      <div className="text-center text-muted-foreground p-4">
        Bild konnte nicht geladen werden
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Image
        src={imageUrl}
        alt={item.metadata.name}
        width={800}
        height={600}
        className="max-w-full h-auto"
        style={{ objectFit: "contain" }}
        unoptimized // Wichtig für Object URLs
      />
    </div>
  );
} 