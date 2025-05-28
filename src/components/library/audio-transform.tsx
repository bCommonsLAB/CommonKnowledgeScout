"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { TransformService, TransformResult } from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";

interface AudioTransformProps {
  item: StorageItem;
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function AudioTransform({ item, onTransformComplete, onRefreshFolder }: AudioTransformProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: "de",
    fileName: item.metadata.name,
    createShadowTwin: true,
    fileExtension: "md"
  });
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  
  const handleTransform = async () => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Kein Storage Provider verfügbar",
        duration: 7000
      });
      return;
    }
    
    if (!activeLibrary) {
      toast.error("Fehler", {
        description: "Aktive Bibliothek nicht gefunden",
        duration: 7000
      });
      return;
    }
    setIsLoading(true);

    try {
      // Datei vom Server laden
      const { blob } = await provider.getBinary(item.id);
      if (!blob) {
        throw new Error("Datei konnte nicht geladen werden");
      }

      // Konvertiere Blob zu File für die Verarbeitung
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Transformiere die Audio-Datei mit dem TransformService
      const result = await TransformService.transformAudio(
        file,
        item,
        saveOptions,
        provider,
        refreshItems,
        activeLibrary.id
      );

      console.log('Audio Transformation abgeschlossen:', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length
      });

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && item.parentId && result.updatedItems.length > 0) {
        console.log('Informiere Library über aktualisierte Dateiliste', {
          folderId: item.parentId,
          itemsCount: result.updatedItems.length,
          savedItemId: result.savedItem?.id
        });
        onRefreshFolder(item.parentId, result.updatedItems, result.savedItem || undefined);
      } else {
        // Wenn kein onRefreshFolder-Handler da ist, rufen wir selbst den handleTransformResult auf
        transformResultHandlerRef.current(result);
      }
      
      // Falls onTransformComplete-Callback existiert, auch für Abwärtskompatibilität aufrufen
      if (onTransformComplete) {
        onTransformComplete(result.text, result.savedItem || undefined, result.updatedItems);
      }
    } catch (error) {
      console.error("Fehler bei der Audio-Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transkription"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    setSaveOptions(options);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          console.log("Audio-Transcription vollständig abgeschlossen und Datei ausgewählt");
        }}
        childrenAction={(handleTransformResult: (result: TransformResult) => void, isProcessingResult: boolean) => {
          // Speichere die handleTransformResult-Funktion in der Ref
          transformResultHandlerRef.current = handleTransformResult;
          
          return (
            <>
              <SaveOptionsComponent 
                originalFileName={item.metadata.name}
                onOptionsChangeAction={handleSaveOptionsChange}
                className="mb-4"
              />
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird transkribiert..." : "Transkribieren"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 