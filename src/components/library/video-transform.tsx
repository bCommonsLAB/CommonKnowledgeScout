"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { 
  TransformService, 
  VideoTransformOptions, 
  TransformResult 
} from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { getUserFriendlyVideoErrorMessage } from "@/lib/utils";
import { FileLogger } from "@/lib/debug/logger"

interface VideoTransformProps {
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function VideoTransform({ onTransformComplete, onRefreshFolder }: VideoTransformProps) {
  const item = useAtomValue(selectedFileAtom);
  const [isLoading, setIsLoading] = useState(false);
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: TransformResult) => void>(() => {});
  
  // Hilfsfunktion für den Basis-Dateinamen
  const getBaseFileName = (fileName: string): string => {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  };
  
  // Generiere Shadow-Twin Dateinamen nach Konvention
  const generateShadowTwinName = (baseName: string, targetLanguage: string): string => {
    return `${baseName}.${targetLanguage}`;
  };
  
  const baseName = item ? getBaseFileName(item.metadata.name) : '';
  const defaultLanguage = "de";
  
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: defaultLanguage,
    fileName: generateShadowTwinName(baseName, defaultLanguage),
    createShadowTwin: true,
    fileExtension: "md"
  });
  
  // Prüfe ob item vorhanden ist
  if (!item) {
    return (
      <div className="flex flex-col gap-4 p-4 text-center text-muted-foreground">
        Keine Video-Datei ausgewählt
      </div>
    );
  }
  
  const handleTransform = async () => {
    FileLogger.info('VideoTransform', 'handleTransform aufgerufen mit saveOptions', saveOptions as unknown as Record<string, unknown>);
    
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

      // Kombiniere die allgemeinen Optionen mit festen Video-Transkriptions-Einstellungen
      const videoOptions: VideoTransformOptions = {
        ...saveOptions,
        extractAudio: true,      // Audio muss für Transkription extrahiert werden
        extractFrames: false,    // Frames sind für Transkription nicht notwendig
        frameInterval: 1,        // Irrelevant da extractFrames false ist
        sourceLanguage: "auto",  // Automatische Spracherkennung
        template: undefined      // Keine Vorlage notwendig
      };

      // Transformiere die Video-Datei mit dem TransformService
      const result = await TransformService.transformVideo(
        file,
        item,
        videoOptions,
        provider,
        refreshItems,
        activeLibrary.id
      );

      FileLogger.info('VideoTransform', 'Video Transformation abgeschlossen', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length
      });

      // Wenn wir einen onRefreshFolder-Handler haben, informiere die übergeordnete Komponente
      if (onRefreshFolder && item.parentId && result.updatedItems.length > 0) {
        FileLogger.info('VideoTransform', 'Informiere Library über aktualisierte Dateiliste', {
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
      FileLogger.error('VideoTransform', 'Fehler bei der Video-Transformation', error);
      toast.error("Fehler", {
        description: getUserFriendlyVideoErrorMessage(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOptionsChange = (options: SaveOptionsType) => {
    FileLogger.debug('VideoTransform', 'handleSaveOptionsChange aufgerufen mit', options as unknown as Record<string, unknown>);
    setSaveOptions(options);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <TransformResultHandler
        onResultProcessed={() => {
          FileLogger.info('VideoTransform', 'Video-Transkription vollständig abgeschlossen und Datei ausgewählt');
        }}
        childrenAction={(handleTransformResult, isProcessingResult) => {
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