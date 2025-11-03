"use client";

import { useAtom } from 'jotai';
import { useState, useCallback } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";

import {
  selectedTransformationItemsAtom,
  ingestionDialogOpenAtom,
} from '@/atoms/transcription-options';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom, folderItemsAtom } from '@/atoms/library-atom';
import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { FileLogger, StateLogger } from '@/lib/debug/logger';

// Progress-Interface für Ingestion
interface IngestionProgress {
  currentItem: number;
  totalItems: number;
  currentFileName: string;
  status: 'processing' | 'success' | 'error';
}

// Result-Interface für Ingestion
interface IngestionResult {
  success: boolean;
  results: Array<{
    item: StorageItem;
    success: boolean;
    chunksUpserted?: number;
    error?: string;
    warnings?: {
      imageErrors?: Array<{ slideIndex: number; imageUrl: string; error: string }>;
      message?: string;
    };
  }>;
}

interface ProgressState {
  isProcessing: boolean;
  currentProgress: IngestionProgress | null;
  results: IngestionResult | null;
}

// Hilfsfunktion: Sammelt rekursiv alle Markdown-Dateien in einem Ordner
async function collectMarkdownFilesRecursively(
  provider: StorageProvider,
  folderId: string,
  visitedFolders: Set<string> = new Set()
): Promise<StorageItem[]> {
  if (visitedFolders.has(folderId)) {
    return [];
  }
  visitedFolders.add(folderId);

  const markdownFiles: StorageItem[] = [];
  
  try {
    const items = await provider.listItemsById(folderId);
    
    for (const item of items) {
      if (item.metadata.name.startsWith('.')) {
        continue;
      }

      if (item.type === 'folder') {
        const subFiles = await collectMarkdownFilesRecursively(
          provider,
          item.id,
          visitedFolders
        );
        markdownFiles.push(...subFiles);
      } else if (item.type === 'file') {
        const isMd = item.metadata.name.toLowerCase().endsWith('.md') ||
                     (item.metadata.mimeType || '').toLowerCase().includes('markdown');
        if (isMd) {
          markdownFiles.push(item);
        }
      }
    }
  } catch (error) {
    FileLogger.error('IngestionDialog', 'Fehler beim rekursiven Durchsuchen', {
      folderId,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler'
    });
  }

  return markdownFiles;
}

export function IngestionDialog() {
  const [isOpen, setIsOpen] = useAtom(ingestionDialogOpenAtom);
  const [selectedItems] = useAtom(selectedTransformationItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  
  const { provider, refreshItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const [, setFolderItems] = useAtom(folderItemsAtom);

  // Handler für die Batch-Ingestion
  const handleStartBatchIngestion = useCallback(async () => {
    if (!provider || !activeLibraryId) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }
    
    const isMarkdown = (name: string, mime?: string) => {
      const lower = name.toLowerCase();
      return lower.endsWith('.md') || (mime || '').toLowerCase().includes('markdown');
    };

    // Sammle alle zu verarbeitenden Markdown-Dateien
    const allMarkdownFiles: StorageItem[] = [];
    
    for (const selectedItem of selectedItems) {
      const item = selectedItem.item;
      
      if (item.type === 'file' && isMarkdown(item.metadata.name, item.metadata.mimeType)) {
        allMarkdownFiles.push(item);
      } else if (item.type === 'folder') {
        try {
          const folderFiles = await collectMarkdownFilesRecursively(provider, item.id);
          if (folderFiles.length === 0) {
            toast.warning("Keine Markdown-Dateien gefunden", { 
              description: `Im Ordner "${item.metadata.name}" wurden keine Markdown-Dateien gefunden` 
            });
          } else {
            allMarkdownFiles.push(...folderFiles);
          }
        } catch (error) {
          toast.error("Fehler beim Durchsuchen", { 
            description: `Ordner "${item.metadata.name}": ${error instanceof Error ? error.message : 'Unbekannter Fehler'}` 
          });
        }
      }
    }

    if (allMarkdownFiles.length === 0) {
      toast.info("Hinweis", { description: "Keine Markdown‑Dateien ausgewählt oder gefunden" });
      return;
    }

    // Entferne Duplikate
    const uniqueFiles = Array.from(
      new Map(allMarkdownFiles.map(file => [file.id, file])).values()
    );

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    const results: IngestionResult['results'] = [];
    let hasError = false;

    try {
      for (let i = 0; i < uniqueFiles.length; i++) {
        const file = uniqueFiles[i];
        
        // Progress-Update
        setProgressState(prev => ({
          ...prev,
          currentProgress: {
            currentItem: i + 1,
            totalItems: uniqueFiles.length,
            currentFileName: file.metadata.name,
            status: 'processing'
          }
        }));

        try {
          const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/ingest-markdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId: file.id, fileName: file.metadata.name })
          });
          const json = await res.json().catch(() => ({}));
          
          if (!res.ok) {
            throw new Error(typeof json?.error === 'string' ? json.error : 'Ingestion fehlgeschlagen');
          }

          // Prüfe auf Warnungen (z.B. Bild-Fehler)
          const hasWarnings = json.warnings && json.warnings.imageErrors && Array.isArray(json.warnings.imageErrors) && json.warnings.imageErrors.length > 0;

          results.push({
            item: file,
            success: true,
            chunksUpserted: json.chunksUpserted ?? 0,
            warnings: hasWarnings ? json.warnings : undefined,
          });

          // Zeige Warnung für Bild-Fehler an
          if (hasWarnings && json.warnings?.imageErrors) {
            const imageErrors = json.warnings.imageErrors as Array<{ slideIndex: number; imageUrl: string; error: string }>;
            toast.warning("Ingestion mit Bild-Fehlern", {
              description: `${imageErrors.length} Bild(er) konnten nicht verarbeitet werden. Details in der Ergebnisliste.`,
              duration: 8000,
            });
          }

          setProgressState(prev => ({
            ...prev,
            currentProgress: {
              ...prev.currentProgress!,
              status: 'success'
            }
          }));
        } catch (error) {
          hasError = true;
          results.push({
            item: file,
            success: false,
            error: error instanceof Error ? error.message : 'Unbekannter Fehler'
          });

          setProgressState(prev => ({
            ...prev,
            currentProgress: {
              ...prev.currentProgress!,
              status: 'error'
            }
          }));
        }
      }

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results: {
          success: !hasError,
          results
        }
      }));

      // Ordner aktualisieren
      try {
        const firstFile = uniqueFiles[0];
        if (firstFile?.parentId) {
          const refreshed = await refreshItems(firstFile.parentId);
          setFolderItems(refreshed);
        }
      } catch {
        // Ignoriere Fehler beim Aktualisieren
      }

      // Erfolgs-/Fehlermeldung
      const successCount = results.filter(r => r.success).length;
      const totalImageErrors = results.reduce((sum, r) => {
        return sum + (r.warnings?.imageErrors?.length || 0);
      }, 0);
      
      if (successCount === uniqueFiles.length) {
        if (totalImageErrors > 0) {
          toast.warning("Ingestion mit Bild-Fehlern abgeschlossen", {
            description: `${successCount} von ${uniqueFiles.length} Dateien erfolgreich ingestiert. ${totalImageErrors} Bild(er) konnten nicht verarbeitet werden.`
          });
        } else {
          toast.success("Ingestion abgeschlossen", {
            description: `${successCount} von ${uniqueFiles.length} Dateien erfolgreich ingestiert.`
          });
        }
      } else {
        toast.error("Ingestion mit Fehlern abgeschlossen", {
          description: `${successCount} von ${uniqueFiles.length} Dateien erfolgreich ingestiert.${totalImageErrors > 0 ? ` ${totalImageErrors} Bild(er) konnten nicht verarbeitet werden.` : ''}`
        });
      }

      StateLogger.info('IngestionDialog', 'Batch Ingestion done', { 
        ok: successCount, 
        fail: uniqueFiles.length - successCount, 
        total: uniqueFiles.length
      });

    } catch (error) {
      console.error('Batch ingestion error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `Batch-Ingestion fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, selectedItems, refreshItems, setFolderItems]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    if (!progressState.isProcessing) {
      setIsOpen(false);
      setProgressState({
        isProcessing: false,
        currentProgress: null,
        results: null
      });
    }
  }, [setIsOpen, progressState.isProcessing]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  // Filtere nur Markdown-Dateien und Ordner für die Anzeige
  const displayItems = selectedItems.filter(({ item }) => {
    const isMd = item.metadata.name.toLowerCase().endsWith('.md') ||
                 (item.metadata.mimeType || '').toLowerCase().includes('markdown');
    return item.type === 'folder' || (item.type === 'file' && isMd);
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Markdown-Ingestion</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien/Ordner */}
          <div>
            <h4 className="mb-4 text-sm font-medium">
              Ausgewählte Dateien/Ordner ({displayItems.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {displayItems.map(({ item }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="truncate">{item.metadata.name}</span>
                  {item.type === 'folder' && (
                    <span className="text-xs text-muted-foreground">(Ordner)</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fortschrittsanzeige */}
          {progressState.isProcessing && progressState.currentProgress && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Verarbeite: {progressState.currentProgress.currentFileName}</span>
                <span>{progressState.currentProgress.currentItem} / {progressState.currentProgress.totalItems}</span>
              </div>
              <Progress value={progressPercentage} className="w-full" />
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">
                  {progressState.currentProgress.status === 'processing' && 'Verarbeite...'}
                  {progressState.currentProgress.status === 'success' && 'Erfolgreich'}
                  {progressState.currentProgress.status === 'error' && 'Fehler'}
                </span>
              </div>
            </div>
          )}

          {/* Ergebnisse */}
          {progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Ergebnisse</h4>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="space-y-2 border-b border-border pb-2 last:border-b-0">
                    <div className="flex items-start gap-2 text-sm">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{result.item.metadata.name}</span>
                          {result.success && result.chunksUpserted !== undefined && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              ({result.chunksUpserted} Chunks)
                            </span>
                          )}
                          {result.success && result.warnings?.imageErrors && result.warnings.imageErrors.length > 0 && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-500 whitespace-nowrap">
                              ⚠️ {result.warnings.imageErrors.length} Bild-Fehler
                            </span>
                          )}
                        </div>
                        
                        {/* Fehlermeldung mehrzeilig anzeigen */}
                        {!result.success && result.error && (
                          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded text-xs">
                            <div className="font-semibold text-red-700 dark:text-red-400 mb-1">
                              Fehler während der Ingestion:
                            </div>
                            <div className="text-red-600 dark:text-red-300 whitespace-pre-wrap break-words">
                              {result.error}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Bild-Fehler Details anzeigen */}
                    {result.success && result.warnings?.imageErrors && result.warnings.imageErrors.length > 0 && (
                      <div className="pl-6 space-y-2 text-xs">
                        <div className="font-semibold text-yellow-600 dark:text-yellow-500 mb-1">
                          Bild-Fehler Details:
                        </div>
                        {result.warnings.imageErrors.map((imgError, idx) => (
                          <div key={idx} className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 rounded">
                            <div className="font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                              Slide {imgError.slideIndex + 1} - Bild-Upload Fehler:
                            </div>
                            <div className="text-yellow-600 dark:text-yellow-300 whitespace-pre-wrap break-words mb-1">
                              {imgError.error}
                            </div>
                            <div className="text-xs opacity-75 break-all text-muted-foreground">
                              Pfad: {imgError.imageUrl}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={progressState.isProcessing}
          >
            {progressState.results ? 'Schließen' : 'Abbrechen'}
          </Button>
          
          {!progressState.isProcessing && !progressState.results && (
            <Button 
              onClick={handleStartBatchIngestion}
              disabled={displayItems.length === 0}
            >
              Ingestion starten ({displayItems.length} {displayItems.length === 1 ? 'Element' : 'Elemente'})
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
