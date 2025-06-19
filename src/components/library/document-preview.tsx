'use client';

import * as React from 'react';
import { useAtomValue } from "jotai";
import { selectedFileAtom } from "@/atoms/library-atom";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { FileLogger } from "@/lib/debug/logger";
import { StorageProvider } from "@/lib/storage/types";

interface DocumentPreviewProps {
  provider: StorageProvider | null;
  activeLibraryId: string;
}

export function DocumentPreview({ provider }: DocumentPreviewProps) {
  const item = useAtomValue(selectedFileAtom);
  const [documentUrl, setDocumentUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!item || !provider) return;

    const loadDocument = async () => {
      try {
        setIsLoading(true);
        
        FileLogger.debug('DocumentPreview', 'Lade Dokument-URL', {
          itemId: item.id,
          itemName: item.metadata.name,
          mimeType: item.metadata.mimeType
        });
        
        // Streaming-URL vom Provider holen
        const url = await provider.getStreamingUrl(item.id);
        if (!url) {
          throw new Error('Keine Streaming-URL verfügbar');
        }
        
        setDocumentUrl(url);
        FileLogger.debug('DocumentPreview', 'Dokument-URL erhalten', { url });
      } catch (err) {
        FileLogger.error('DocumentPreview', 'Fehler beim Laden des Dokuments', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [item, provider]);

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Kein Dokument ausgewählt
      </div>
    );
  }

  const handleDownload = () => {
    if (!documentUrl) return;
    
    FileLogger.info('DocumentPreview', 'Download gestartet', {
      itemName: item.metadata.name
    });
    
    // Erstelle einen temporären Link zum Download
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = item.metadata.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bestimme das passende Icon basierend auf dem Dateityp
  const getFileIcon = () => {
    // Hier könnten wir später spezifische Icons für verschiedene Dateitypen hinzufügen
    // Für jetzt verwenden wir das generische FileText Icon
    return FileText;
  };

  const Icon = getFileIcon();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Icon className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">{item.metadata.name}</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Dokumentvorschau ist für diesen Dateityp nicht verfügbar
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        Dateigröße: {(item.metadata.size / 1024).toFixed(2)} KB
      </p>
      {documentUrl && !isLoading && (
        <Button 
          onClick={handleDownload}
          disabled={isLoading}
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Dokument herunterladen
        </Button>
      )}
    </div>
  );
} 