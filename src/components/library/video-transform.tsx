"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { useAtomValue } from "jotai";
import { activeLibraryAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { toast } from "sonner";
import { 
  TransformService, 
  VideoTransformOptions, 
  VideoTransformResult 
} from "@/lib/transform/transform-service";
import { TransformSaveOptions as SaveOptionsType } from "@/components/library/transform-save-options";
import { TransformSaveOptions as SaveOptionsComponent } from "@/components/library/transform-save-options";
import { TransformResultHandler } from "@/components/library/transform-result-handler";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface VideoTransformProps {
  item: StorageItem;
  onTransformComplete?: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

export function VideoTransform({ item, onTransformComplete, onRefreshFolder }: VideoTransformProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [saveOptions, setSaveOptions] = useState<SaveOptionsType>({
    targetLanguage: "de",
    fileName: item.metadata.name,
    createShadowTwin: true,
    fileExtension: "md"
  });
  
  // Video-spezifische Optionen
  const [extractAudio, setExtractAudio] = useState<boolean>(true);
  const [extractFrames, setExtractFrames] = useState<boolean>(false);
  const [frameInterval, setFrameInterval] = useState<number>(1);
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [template, setTemplate] = useState<string>("Video");
  
  // Referenz für den TransformResultHandler
  const transformResultHandlerRef = useRef<(result: VideoTransformResult) => void>(() => {});
  
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

      // Kombiniere die allgemeinen und video-spezifischen Optionen
      const videoOptions: VideoTransformOptions = {
        ...saveOptions,
        extractAudio,
        extractFrames,
        frameInterval,
        sourceLanguage,
        template
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

      console.log('Video Transformation abgeschlossen:', {
        textLength: result.text.length,
        savedItemId: result.savedItem?.id,
        updatedItemsCount: result.updatedItems.length,
        framesCount: result.frames?.length || 0
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
      console.error("Fehler bei der Video-Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transformation"
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
          console.log("Video-Transformation vollständig abgeschlossen und Datei ausgewählt");
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
              
              <div className="space-y-4 mb-4">
                <h4 className="text-sm font-medium">Video-Optionen</h4>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="extractAudio" 
                    checked={extractAudio}
                    onCheckedChange={(checked) => setExtractAudio(checked === true)}
                  />
                  <Label htmlFor="extractAudio">Audio extrahieren und transkribieren</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="extractFrames" 
                    checked={extractFrames}
                    onCheckedChange={(checked) => setExtractFrames(checked === true)}
                  />
                  <Label htmlFor="extractFrames">Frames extrahieren</Label>
                </div>
                
                {extractFrames && (
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="frameInterval">Intervall (Sekunden)</Label>
                    <Input 
                      id="frameInterval"
                      type="number" 
                      min={1}
                      value={frameInterval}
                      onChange={(e) => setFrameInterval(parseInt(e.target.value) || 1)}
                      className="w-full"
                    />
                  </div>
                )}

                {extractAudio && (
                  <>
                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="sourceLanguage">Quellsprache</Label>
                      <Select
                        value={sourceLanguage}
                        onValueChange={setSourceLanguage}
                      >
                        <SelectTrigger id="sourceLanguage">
                          <SelectValue placeholder="Quellsprache auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatisch erkennen</SelectItem>
                          <SelectItem value="de">Deutsch</SelectItem>
                          <SelectItem value="en">Englisch</SelectItem>
                          <SelectItem value="fr">Französisch</SelectItem>
                          <SelectItem value="es">Spanisch</SelectItem>
                          <SelectItem value="it">Italienisch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col space-y-2">
                      <Label htmlFor="template">Vorlage</Label>
                      <Select
                        value={template}
                        onValueChange={setTemplate}
                      >
                        <SelectTrigger id="template">
                          <SelectValue placeholder="Vorlage auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Video">Video</SelectItem>
                          <SelectItem value="Besprechung">Besprechung</SelectItem>
                          <SelectItem value="Interview">Interview</SelectItem>
                          <SelectItem value="Zusammenfassung">Zusammenfassung</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>
              
              <Button 
                onClick={handleTransform} 
                disabled={isLoading || isProcessingResult}
                className="w-full"
              >
                {isLoading ? "Wird verarbeitet..." : "Video verarbeiten"}
              </Button>
            </>
          );
        }}
      />
    </div>
  );
} 