'use client';

import { useState, useEffect } from "react";
import { StorageItem, StorageFile } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface FilePreviewProps {
  item: StorageItem | null;
  className?: string;
}

interface FileMetadata {
  content: {
    title?: string;
    description?: string;
  };
  transcriptionStatus?: 'pending' | 'completed' | 'failed';
  transcription?: string;
}

// Hilfsfunktion für die Dateityp-Erkennung
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'txt':
    case 'doc':
    case 'docx':
      return 'text';
    default:
      return 'unknown';
  }
}

export function FilePreview({ item, className }: FilePreviewProps) {
  const [binaryUrl, setBinaryUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item?.type === 'file') {
      loadBinary();
    }
    return () => {
      if (binaryUrl) {
        URL.revokeObjectURL(binaryUrl);
      }
    };
  }, [item]);

  const loadBinary = async () => {
    if (!item) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { blob, mimeType } = await item.provider.getBinary(item.item.id);
      const url = URL.createObjectURL(blob);
      setBinaryUrl(url);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Datei';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) {
    return (
      <div className={cn("p-6", className)}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Bitte wählen Sie eine Datei aus, um die Vorschau anzuzeigen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-6", className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // TODO: Hier würden wir die Metadaten von der API abrufen
  const metadata: FileMetadata = {
    content: {
      title: item.item.name,
      description: "Beschreibung der Datei wird hier angezeigt...",
    },
    transcriptionStatus: 'pending',
  };

  const renderFileContent = () => {
    const fileType = getFileType(item.item.name);

    if (isLoading) {
      return (
        <div className="w-full h-[400px] flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      );
    }

    if (!binaryUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-[200px]">
          <p className="text-sm text-muted-foreground">Datei wird geladen...</p>
        </div>
      );
    }

    return (
      <>
        <CardHeader>
          <CardTitle>{metadata.content.title}</CardTitle>
          <p className="text-muted-foreground line-clamp-2">
            {metadata.content.description}
          </p>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            {fileType === 'audio' && (
              <audio controls className="w-full">
                <source src={binaryUrl} type="audio/mpeg" />
                Ihr Browser unterstützt das Audio-Element nicht.
              </audio>
            )}
            {fileType === 'video' && (
              <video controls className="w-full max-h-[400px]">
                <source src={binaryUrl} type="video/mp4" />
                Ihr Browser unterstützt das Video-Element nicht.
              </video>
            )}
            {fileType === 'image' && (
              <div className="relative w-full h-[400px] bg-muted rounded-md overflow-hidden">
                <Image
                  src={binaryUrl}
                  alt={item.item.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
            )}
            {fileType === 'pdf' && (
              <iframe 
                src={binaryUrl} 
                className="w-full h-[400px] border-none rounded-md"
              />
            )}
            {fileType === 'text' && (
              <pre className="p-4 bg-muted rounded-md overflow-auto max-h-[400px]">
                Inhalt wird geladen...
              </pre>
            )}
            {fileType === 'markdown' && (
              <div className="prose dark:prose-invert max-w-none">
                Markdown-Inhalt wird geladen...
              </div>
            )}
            {fileType === 'unknown' && (
              <div className="flex flex-col items-center justify-center h-[200px] bg-muted rounded-md">
                <ImageIcon className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Vorschau nicht verfügbar für diesen Dateityp
                </p>
              </div>
            )}
          </div>

          {(fileType === 'audio' || fileType === 'video') && (
            <div className="mt-6 border-t pt-4">
              <h2 className="text-xl font-semibold mb-2">Transkript</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {metadata.transcriptionStatus === 'completed' 
                  ? metadata.transcription || "Transkript wird geladen..."
                  : "Transkript wird erstellt..."}
              </p>
            </div>
          )}
        </CardContent>
      </>
    );
  };

  return (
    <Card className={cn("w-full h-full overflow-auto", className)}>
      {renderFileContent()}
    </Card>
  );
} 