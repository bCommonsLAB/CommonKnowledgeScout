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
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2, FileAudio, FileVideo } from "lucide-react";
import { toast } from "sonner";

import {
  selectedBatchItemsAtom,
  transcriptionDialogOpenAtom,
  baseTransformOptionsAtom,
  BaseTransformOptions
} from '@/atoms/transcription-options';
import { BatchTransformService, BatchTransformProgress, BatchTransformResult } from '@/lib/transform/batch-transform-service';
import { useStorage } from '@/contexts/storage-context';
import { useAtomValue } from 'jotai';
import { activeLibraryIdAtom } from '@/atoms/library-atom';

interface ProgressState {
  isProcessing: boolean;
  currentProgress: BatchTransformProgress | null;
  results: BatchTransformResult | null;
}

export function TranscriptionDialog() {
  const [isOpen, setIsOpen] = useAtom(transcriptionDialogOpenAtom);
  const [selectedItems] = useAtom(selectedBatchItemsAtom);
  const [progressState, setProgressState] = useState<ProgressState>({
    isProcessing: false,
    currentProgress: null,
    results: null
  });
  
  const { provider, refreshItems } = useStorage();
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const baseOptions = useAtomValue(baseTransformOptionsAtom);

  // Handler für die Batch-Transkription
  const handleStartBatchTranscription = useCallback(async () => {
    if (!provider || !activeLibraryId || selectedItems.length === 0) {
      toast.error("Fehler", {
        description: "Storage Provider oder Bibliothek nicht verfügbar"
      });
      return;
    }

    setProgressState({
      isProcessing: true,
      currentProgress: null,
      results: null
    });

    try {
      // Progress-Callback für Fortschrittsanzeige
      const onProgress = (progress: BatchTransformProgress) => {
        setProgressState(prev => ({
          ...prev,
          currentProgress: progress
        }));
      };

      // Batch-Transkription starten
      const results = await BatchTransformService.transformBatch(
        selectedItems,
        baseOptions,
        provider,
        refreshItems,
        activeLibraryId,
        onProgress
      );

      setProgressState(prev => ({
        ...prev,
        isProcessing: false,
        results
      }));

      // Erfolgs-/Fehlermeldung anzeigen
      if (results.success) {
        const successCount = results.results.filter(r => r.success).length;
        toast.success("Batch-Transkription abgeschlossen", {
          description: `${successCount} von ${selectedItems.length} Dateien erfolgreich transkribiert.`
        });
      } else {
        const errorCount = results.results.filter(r => !r.success).length;
        toast.error("Batch-Transkription mit Fehlern abgeschlossen", {
          description: `${errorCount} von ${selectedItems.length} Dateien konnten nicht transkribiert werden.`
        });
      }

    } catch (error) {
      console.error('Batch transcription error:', error);
      setProgressState(prev => ({
        ...prev,
        isProcessing: false
      }));
      
      toast.error("Fehler", {
        description: `Batch-Transkription fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      });
    }
  }, [provider, activeLibraryId, selectedItems, baseOptions, refreshItems]);

  // Dialog schließen und State zurücksetzen
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setProgressState({
      isProcessing: false,
      currentProgress: null,
      results: null
    });
  }, [setIsOpen]);

  // Fortschrittsanzeige berechnen
  const progressPercentage = progressState.currentProgress 
    ? (progressState.currentProgress.currentItem / progressState.currentProgress.totalItems) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Batch-Transkription</DialogTitle>
        </DialogHeader>
        
        <div className="py-6 space-y-6">
          {/* Ausgewählte Dateien */}
          <div>
            <h4 className="mb-4 text-sm font-medium">
              Ausgewählte Dateien ({selectedItems.length})
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedItems.map(({ item, type }) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  {type === 'audio' ? (
                    <FileAudio className="h-4 w-4 text-blue-500" />
                  ) : (
                    <FileVideo className="h-4 w-4 text-red-500" />
                  )}
                  <span className="truncate">{item.metadata.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {type}
                  </Badge>
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

          {/* Einstellungen */}
          {!progressState.isProcessing && !progressState.results && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Einstellungen</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Zielsprache:</span>
                  <div className="font-medium">{baseOptions.targetLanguage}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dateiendung:</span>
                  <div className="font-medium">.{baseOptions.fileExtension}</div>
                </div>
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
              onClick={handleStartBatchTranscription}
              disabled={selectedItems.length === 0}
            >
              Transkription starten ({selectedItems.length} Dateien)
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 