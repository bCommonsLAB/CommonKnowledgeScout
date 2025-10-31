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

          results.push({
            item: file,
            success: true,
            chunksUpserted: json.chunksUpserted ?? 0
          });

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
      if (successCount === uniqueFiles.length) {
        toast.success("Ingestion abgeschlossen", {
          description: `${successCount} von ${uniqueFiles.length} Dateien erfolgreich ingestiert.`
        });
      } else {
        toast.error("Ingestion mit Fehlern abgeschlossen", {
          description: `${successCount} von ${uniqueFiles.length} Dateien erfolgreich ingestiert.`
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
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {progressState.results.results.map((result) => (
                  <div key={result.item.id} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="truncate">{result.item.metadata.name}</span>
                    {result.success && result.chunksUpserted !== undefined && (
                      <span className="text-xs text-muted-foreground">
                        ({result.chunksUpserted} Chunks)
                      </span>
                    )}
                    {!result.success && (
                      <span className="text-xs text-red-500 truncate">
                        {result.error}
                      </span>
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
