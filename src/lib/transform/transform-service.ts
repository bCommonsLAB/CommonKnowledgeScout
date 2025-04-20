import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText } from "@/lib/secretary/client";
import { saveShadowTwin, generateShadowTwinName } from "@/lib/storage/shadow-twin";
import { toast } from "sonner";

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
}

export interface TransformResult {
  text: string;
  savedItem: StorageItem | null;
  updatedItems: StorageItem[];
}

/**
 * TransformService - Zentraler Service für Transformations- und Speicheroperationen
 * Verantwortlich für:
 * - Transformation von Audio zu Text
 * - Transformation von Text zu optimiertem Text
 * - Speichern der Ergebnisse als Shadow-Twin oder als neue Datei
 * - Aktualisieren der Dateiliste
 * - Bereitstellen einer einheitlichen Schnittstelle für alle Transformationstypen
 */
export class TransformService {
  /**
   * Transformiert eine Audio-Datei in Text und speichert das Ergebnis
   */
  static async transformAudio(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    apiUrl: string,
    apiKey: string
  ): Promise<TransformResult> {
    try {
      // 1. Audio transformieren
      const text = await transformAudio(
        file,
        options.targetLanguage,
        libraryId,
        apiUrl,
        apiKey
      );

      // 2. Ergebnis speichern und Liste aktualisieren
      return await this.saveTransformationResult(
        text,
        originalItem,
        options,
        provider,
        refreshItems
      );
    } catch (error) {
      console.error("Fehler bei der Audio-Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transkription"
      });
      throw error;
    }
  }

  /**
   * Transformiert einen Text und speichert das Ergebnis
   */
  static async transformText(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    apiUrl: string,
    apiKey: string,
    template: string = "Besprechung"
  ): Promise<TransformResult> {
    try {
      // 1. Text transformieren
      const transformedText = await transformText(
        text,
        options.targetLanguage,
        libraryId,
        apiUrl,
        apiKey,
        template
      );

      // 2. Ergebnis speichern und Liste aktualisieren
      return await this.saveTransformationResult(
        transformedText,
        originalItem,
        options,
        provider,
        refreshItems
      );
    } catch (error) {
      console.error("Fehler bei der Text-Transformation:", error);
      toast.error("Fehler", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler bei der Transformation"
      });
      throw error;
    }
  }

  /**
   * Speichert das Transformationsergebnis und aktualisiert die Dateiliste
   */
  private static async saveTransformationResult(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    let savedItem: StorageItem | null = null;

    // 1. Ergebnis speichern (als Shadow-Twin oder normale Datei)
    if (options.createShadowTwin) {
      // Als Shadow-Twin speichern
      savedItem = await saveShadowTwin(
        originalItem,
        { output_text: text },
        options.targetLanguage,
        provider
      );
    } else {
      // Als normale Datei mit angegebenem Namen speichern
      const fileName = `${options.fileName}.${options.fileExtension}`;
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], fileName, { 
        type: options.fileExtension === 'md' ? 'text/markdown' : 'text/plain' 
      });
      
      savedItem = await provider.uploadFile(originalItem.parentId, file);
    }

    // 2. Dateien im Verzeichnis aktualisieren
    const updatedItems = await refreshItems(originalItem.parentId);

    // 3. Erfolgsmeldung anzeigen
    toast.success("Transformation erfolgreich", {
      description: "Die Datei wurde erfolgreich transformiert und gespeichert.",
      duration: 5000
    });

    // 4. Transformationsergebnis zurückgeben
    return {
      text,
      savedItem,
      updatedItems
    };
  }

  /**
   * Speichert einen bereits transformierten Text direkt ohne erneute Transformation
   */
  static async saveTransformedText(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    return this.saveTransformationResult(
      text,
      originalItem,
      options,
      provider,
      refreshItems
    );
  }
} 