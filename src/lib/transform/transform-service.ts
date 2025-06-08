import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo } from "@/lib/secretary/client";

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
}

export interface TransformResult {
  text: string;
  savedItem?: StorageItem;
  updatedItems: StorageItem[];
}

export interface VideoTransformOptions extends TransformSaveOptions {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
  sourceLanguage?: string;
  template?: string;
}

export interface VideoTransformResult extends TransformResult {
  frames?: { url: string; timestamp: number }[];
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
   * Transformiert eine Audio-Datei in Text
   * @param file Die zu transformierende Audio-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformAudio(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    // Audio-Datei wird transformiert
    const transformedText = await transformAudio(file, options.targetLanguage, libraryId);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }

  /**
   * Transformiert eine Video-Datei
   * @param file Die zu transformierende Video-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Video-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis inklusive Video-spezifischer Daten
   */
  static async transformVideo(
    file: File,
    originalItem: StorageItem,
    options: VideoTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<VideoTransformResult> {
    // Video-Datei wird transformiert
    const videoTransformResult = await transformVideo(
      file, 
      {
        extractAudio: options.extractAudio,
        extractFrames: options.extractFrames,
        frameInterval: options.frameInterval,
        targetLanguage: options.targetLanguage,
        sourceLanguage: options.sourceLanguage || 'auto',
        template: options.template
      }, 
      libraryId
    );
    
    // Text aus der Transkription extrahieren (falls vorhanden)
    const transformedText = videoTransformResult.transcription?.text || '';
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems,
        frames: videoTransformResult.frames
      };
    }
    
    return {
      text: transformedText,
      updatedItems: [],
      frames: videoTransformResult.frames
    };
  }

  /**
   * Transformiert einen Text mithilfe des Secretary Services
   */
  static async transformText(
    textContent: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    template: string = "Besprechung"
  ): Promise<TransformResult> {
    console.log('[TransformService] transformText aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      options: options,
      template: template
    });
    
    // Text wird transformiert
    const transformedText = await transformText(
      textContent,
      options.targetLanguage,
      libraryId,
      template
    );
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        transformedText,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    }
    
    return {
      text: transformedText,
      updatedItems: []
    };
  }
  
  // Hilfsmethode zum Speichern der transformierten Datei
  private static async saveTwinFile(
    content: string,
    originalItem: StorageItem,
    fileName: string,
    fileExtension: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<{ savedItem?: StorageItem; updatedItems: StorageItem[] }> {
    console.log('[TransformService] saveTwinFile aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension
    });
    
    // Dateiname ohne Erweiterung extrahieren
    const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
    
    // Hole aktuelle Dateien im Verzeichnis
    const currentItems = await refreshItems(originalItem.parentId);
    
    // Funktion zum Generieren eines eindeutigen Dateinamens
    const generateUniqueFileName = (baseName: string, extension: string): string => {
      let counter = 0;
      let candidateName = `${baseName}.${extension}`;
      
      // Prüfe ob der Name bereits existiert
      while (currentItems.some(item => 
        item.type === 'file' && 
        item.metadata.name.toLowerCase() === candidateName.toLowerCase()
      )) {
        counter++;
        // Füge Nummer in Klammern vor der letzten Erweiterung ein
        // z.B. "analyzer todo.de.md" -> "analyzer todo(1).de.md"
        const parts = baseName.split('.');
        if (parts.length > 1) {
          // Wenn es eine Spracherweiterung gibt (z.B. ".de")
          const mainName = parts.slice(0, -1).join('.');
          const langExtension = parts[parts.length - 1];
          candidateName = `${mainName}(${counter}).${langExtension}.${extension}`;
        } else {
          // Normaler Fall ohne Spracherweiterung
          candidateName = `${baseName}(${counter}).${extension}`;
        }
      }
      
      return candidateName;
    };
    
    // Generiere eindeutigen Dateinamen
    const uniqueFileName = generateUniqueFileName(nameWithoutExtension, fileExtension);
    
    console.log('[TransformService] Eindeutiger Dateiname generiert:', {
      nameWithoutExtension: nameWithoutExtension,
      uniqueFileName: uniqueFileName,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
    // Markdown-Datei erstellen und speichern
    const fileBlob = new Blob([content], { type: "text/markdown" });
    const file = new File([fileBlob], uniqueFileName, { type: "text/markdown" });
    
    // In dasselbe Verzeichnis wie die Originaldatei hochladen
    const savedItem = await provider.uploadFile(originalItem.parentId, file);
    
    // Aktualisierte Dateiliste holen
    const updatedItems = await refreshItems(originalItem.parentId);
    
    return { savedItem, updatedItems };
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

  /**
   * Speichert das Transformationsergebnis als Datei
   */
  static async saveTransformationResult(
    text: string,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
  ): Promise<TransformResult> {
    // Als Shadow-Twin oder als normale Datei mit angegebenem Namen speichern
    if (options.createShadowTwin) {
      const result = await TransformService.saveTwinFile(
        text,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text,
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      // Einfach das Transformationsergebnis zurückgeben ohne Datei zu speichern
      return {
        text,
        updatedItems: []
      };
    }
  }
} 