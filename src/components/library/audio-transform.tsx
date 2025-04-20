"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { transformAudio } from "@/lib/secretary/client";
import { toast } from "sonner";
import { StorageItem } from "@/lib/storage/types";
import { useStorageProvider } from "@/hooks/use-storage-provider";
import { saveShadowTwin, generateShadowTwinName } from "@/lib/storage/shadow-twin";
import { useAtomValue } from "jotai";
import { activeLibraryAtom } from "@/atoms/library-atom";
import { useStorage } from "@/contexts/storage-context";
import { useSelectedFile } from "@/hooks/use-selected-file";

interface AudioTransformProps {
  item: StorageItem;
  onTransformComplete: (text: string, twinItem?: StorageItem, updatedItems?: StorageItem[]) => void;
}

export function AudioTransform({ item, onTransformComplete }: AudioTransformProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("de");
  const provider = useStorageProvider();
  const activeLibrary = useAtomValue(activeLibraryAtom);
  const { refreshItems } = useStorage();
  const { selectFile } = useSelectedFile();
  
  const handleTransform = async () => {
    if (!provider) {
      toast.error("Fehler", {
        description: "Kein Storage Provider verfügbar",
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

      if (!activeLibrary) {
        throw new Error("Aktive Bibliothek nicht gefunden");
      }
      if (!activeLibrary.config.secretaryService || !activeLibrary.config.secretaryService.apiUrl || !activeLibrary.config.secretaryService.apiKey) {
        throw new Error("Secretary Service API URL oder API Key nicht konfiguriert");
      }
      // Konvertiere Blob zu File für die Verarbeitung
      const file = new File([blob], item.metadata.name, { type: item.metadata.mimeType });

      // Audio transformieren - Die Secretary-Header werden automatisch gesetzt
      const text = await transformAudio(file, targetLanguage, activeLibrary.id, activeLibrary.config.secretaryService.apiUrl, activeLibrary.config.secretaryService.apiKey);

      // Shadow-Twin speichern
      const originalTwinItem = await saveShadowTwin(
        item,
        { output_text: text },
        targetLanguage,
        provider
      );

      // Das Verzeichnis neu laden und die aktualisierten Items erhalten
      const updatedItems = await refreshItems(item.parentId);
      
      // Den Namen des erwarteten Twin-Items ermitteln
      const twinFileName = generateShadowTwinName(item.metadata.name, targetLanguage);
      
      // Das aktualisierte Twin-Item in der neuen Liste finden
      const updatedTwinItem = updatedItems.find(updatedItem => 
        updatedItem.metadata.name === twinFileName
      );
      
      // Das aktualisierte Twin-Item auswählen, wenn vorhanden, sonst das ursprüngliche
      const twinItemToSelect = updatedTwinItem || originalTwinItem;
      
      
      // Den neuen Twin auswählen mit dem aktualisierten Objekt
      selectFile(twinItemToSelect);

      toast.success("Transkription erfolgreich", {
        description: "Die Audio-Datei wurde erfolgreich transkribiert, bitte den Text kontrollieren und mit einer Transformation fortfahren.",
        duration: 7000
      });

      // Gib den Text, das neue Twin-Item UND die aktualisierten Items zurück
      onTransformComplete(text, twinItemToSelect, updatedItems);
    } catch (error) {
      console.error("Fehler bei der Audio-Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transkription"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4">
        <Select
          value={targetLanguage}
          onValueChange={setTargetLanguage}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sprache auswählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="de">Deutsch</SelectItem>
            <SelectItem value="en">Englisch</SelectItem>
            <SelectItem value="fr">Französisch</SelectItem>
            <SelectItem value="es">Spanisch</SelectItem>
            <SelectItem value="it">Italienisch</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleTransform} disabled={isLoading}>
          {isLoading ? "Wird transkribiert..." : "Transkribieren"}
        </Button>
      </div>
    </div>
  );
} 