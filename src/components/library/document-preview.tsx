'use client';

import * as React from 'react';
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";

interface DocumentPreviewProps {
  item: StorageItem;
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function DocumentPreview({ item, provider }: DocumentPreviewProps) {
  const [documentUrl, setDocumentUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let objectUrl: string | null = null;

    const loadDocument = async () => {
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
        
        // Erstelle eine Object URL für das Dokument
        objectUrl = URL.createObjectURL(blob);
        setDocumentUrl(objectUrl);
      } catch (err) {
        console.error('[DocumentPreview] Fehler beim Laden des Dokuments:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Dokuments');
      } finally {
        setLoading(false);
      }
    };

    loadDocument();

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

  if (!documentUrl) {
    return (
      <div className="text-center text-muted-foreground p-4">
        Dokument konnte nicht geladen werden
      </div>
    );
  }

  return (
    <iframe 
      src={documentUrl}
      title={item.metadata.name}
      className="w-full h-screen"
    />
  );
} 