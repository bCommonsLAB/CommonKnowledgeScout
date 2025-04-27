"use client";

import * as React from "react";
import { StorageItem } from "@/lib/storage/types";
import { useSelectedFile } from "@/hooks/use-selected-file";
import { TransformResult } from "@/lib/transform/transform-service";

interface TransformResultHandlerProps {
  onResultProcessed?: () => void;
  children: (
    handleTransformResult: (result: TransformResult) => void,
    isProcessing: boolean
  ) => React.ReactNode;
}

/**
 * TransformResultHandler - Verarbeitet Transformationsergebnisse und führt Folgeaktionen aus
 * 
 * Diese Komponente nimmt das Ergebnis einer Transformation entgegen und führt
 * standardisierte Aktionen aus:
 * 1. Aktualisieren der Dateiliste
 * 2. Auswählen der neuen Datei
 * 3. Benachrichtigen der übergeordneten Komponente
 */
export function TransformResultHandler({
  onResultProcessed,
  children
}: TransformResultHandlerProps) {
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { selectFile } = useSelectedFile();

  const handleTransformResult = React.useCallback(
    (result: TransformResult) => {
      setIsProcessing(true);
      
      try {
        console.log("TransformResultHandler: Verarbeite Ergebnis", {
          hasItem: !!result.savedItem,
          itemsUpdated: result.updatedItems?.length || 0
        });
        
        // Die neue Datei auswählen, wenn verfügbar
        if (result.savedItem) {
          console.log("TransformResultHandler: Wähle neue Datei aus", result.savedItem.id);
          selectFile(result.savedItem);
        }
        
        // Die übergeordnete Komponente über die abgeschlossene Verarbeitung informieren
        if (onResultProcessed) {
          onResultProcessed();
        }
      } catch (error) {
        console.error("Fehler bei der Verarbeitung des Transformationsergebnisses:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [selectFile, onResultProcessed]
  );

  return <>{children(handleTransformResult, isProcessing)}</>;
} 