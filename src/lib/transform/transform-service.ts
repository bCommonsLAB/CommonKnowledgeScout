import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo, transformPdf, SecretaryAudioResponse, SecretaryVideoResponse, SecretaryPdfResponse } from "@/lib/secretary/client";

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

/**
 * Typ für die Metadaten, die im Frontmatter gespeichert werden
 */
interface TransformMetadata {
  // Quelldatei-Informationen
  source_file?: string;
  source_file_id?: string;
  source_file_size?: number;
  source_file_type?: string;
  
  // Transformations-Informationen
  source_language?: string;
  target_language?: string;
  
  // Audio-Metadaten
  audio_duration?: number;
  audio_format?: string;
  audio_channels?: number;
  audio_sample_rate?: number;
  audio_bit_rate?: number;
  
  // Prozess-Informationen
  process_id?: string;
  processor?: string;
  processing_duration_ms?: number;
  model_used?: string;
  tokens_used?: number;
  
  // Secretary Service Informationen
  cache_used?: boolean;
  cache_key?: string;
  
  // Weitere Felder können hinzugefügt werden
  [key: string]: string | number | boolean | undefined;
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
   * Generiert einen standardisierten Namen für einen Shadow-Twin
   * @param originalName Der ursprüngliche Dateiname
   * @param targetLanguage Die Zielsprache
   * @returns Der generierte Shadow-Twin-Name ohne Dateiendung
   */
  static generateShadowTwinName(originalName: string, targetLanguage: string): string {
    // Entferne alle Dateiendungen aus dem Namen
    const nameWithoutExtension = originalName.split('.').slice(0, -1).join('.');
    return `${nameWithoutExtension}.${targetLanguage}`;
  }

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
    // Audio-Datei wird transformiert - hole die vollständige Response
    const response = await transformAudio(file, options.targetLanguage, libraryId);
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (typeof response === 'string') {
      // Falls die Response nur ein String ist (alte API)
      transformedText = response;
    } else if (response && 'data' in response && response.data && response.data.transcription) {
      // Neue API mit vollständigen Metadaten
      const audioResponse = response as SecretaryAudioResponse;
      transformedText = audioResponse.data.transcription.text;
      
      // Sammle relevante Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: audioResponse.data.transcription.source_language || options.targetLanguage,
        target_language: options.targetLanguage,
        
        // Audio-Metadaten (falls vorhanden)
        audio_duration: audioResponse.data.metadata?.duration,
        audio_format: audioResponse.data.metadata?.format,
        audio_channels: audioResponse.data.metadata?.channels,
        audio_sample_rate: audioResponse.data.metadata?.sample_rate,
        audio_bit_rate: audioResponse.data.metadata?.bit_rate,
        
        // Prozess-Informationen
        process_id: audioResponse.process?.id,
        processor: audioResponse.process?.main_processor,
        processing_duration_ms: audioResponse.process?.llm_info?.total_duration,
        model_used: audioResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: audioResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: audioResponse.process?.is_from_cache || false,
        cache_key: audioResponse.process?.cache_key
      };
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    }
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin) {
      const shadowTwinName = TransformService.generateShadowTwinName(originalItem.metadata.name, options.targetLanguage);
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        shadowTwinName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
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
  ): Promise<TransformResult> {
    console.log('[TransformService] transformVideo gestartet mit Optionen:', options);
    
    // Video-Datei wird transformiert - hole die vollständige Response
    const response = await transformVideo(
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
    
    console.log('[TransformService] Vollständige Video-Response:', JSON.stringify(response, null, 2));
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    console.log('[TransformService] Response-Check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasTranscription: !!(response && response.data && response.data.transcription),
      transcriptionType: response && response.data && response.data.transcription ? typeof response.data.transcription : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : [],
      transcriptionKeys: response && response.data && response.data.transcription ? Object.keys(response.data.transcription) : []
    });
    
    if (response && response.data && response.data.transcription) {
      console.log('[TransformService] Transkription gefunden:', response.data.transcription);
      
      // Vollständige Video-Response mit Metadaten
      const videoResponse = response as SecretaryVideoResponse;
      transformedText = videoResponse.data.transcription.text;
      
      console.log('[TransformService] Extrahierter Text-Länge:', transformedText.length);
      console.log('[TransformService] Text-Vorschau:', transformedText.substring(0, 200));
      
      // Sammle relevante Video-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        source_language: videoResponse.data.transcription.source_language || options.sourceLanguage || 'auto',
        target_language: options.targetLanguage,
        
        // Video-Metadaten
        video_duration: videoResponse.data.metadata?.duration,
        video_duration_formatted: videoResponse.data.metadata?.duration_formatted,
        video_file_size: videoResponse.data.metadata?.file_size,
        video_title: videoResponse.data.metadata?.title,
        audio_file: videoResponse.data.metadata?.audio_file,
        
        // Prozess-Informationen
        process_id: videoResponse.process?.id,
        processor: videoResponse.process?.main_processor,
        sub_processors: videoResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: videoResponse.process?.llm_info?.total_duration,
        model_used: videoResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: videoResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: videoResponse.process?.is_from_cache || false,
        cache_key: videoResponse.process?.cache_key
      };
      
      console.log('[TransformService] Extrahierte Metadaten:', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      console.error('[TransformService] Keine Transkription in der Response gefunden!');
      console.error('[TransformService] Response-Struktur:', {
        hasResponse: !!response,
        hasData: !!(response && response.data),
        hasTranscription: !!(response && response.data && response.data.transcription),
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    console.log('[TransformService] Finaler transformierter Text-Länge:', transformedText.length);
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      console.log('[TransformService] Speichere Shadow-Twin mit Länge:', markdownContent.length);
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      console.log('[TransformService] Keine Speicherung:', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
    }
    
    return {
      text: transformedText,
      updatedItems: []
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

  /**
   * Transformiert eine PDF-Datei mithilfe des Secretary Services
   * @param file Die zu transformierende PDF-Datei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Speicheroptionen
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformPdf(
    file: File,
    originalItem: StorageItem,
    options: TransformSaveOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    console.log('[TransformService] transformPdf gestartet mit Optionen:', options);
    
    // PDF-Datei wird transformiert - hole die vollständige Response
    const response = await transformPdf(file, options.targetLanguage, libraryId);
    
    console.log('[TransformService] Vollständige PDF-Response:', JSON.stringify(response, null, 2));
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    console.log('[TransformService] Response-Check:', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasTextContent: !!(response && response.data && response.data.text_content),
      textContentType: response && response.data && response.data.text_content ? typeof response.data.text_content : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : []
    });
    
    if (response && response.data && response.data.text_content) {
      console.log('[TransformService] Text-Content gefunden:', response.data.text_content);
      
      // Vollständige PDF-Response mit Metadaten
      const pdfResponse = response as SecretaryPdfResponse;
      transformedText = pdfResponse.data.text_content;
      
      console.log('[TransformService] Extrahierter Text-Länge:', transformedText.length);
      console.log('[TransformService] Text-Vorschau:', transformedText.substring(0, 200));
      
      // Sammle relevante PDF-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // PDF-Metadaten
        page_count: pdfResponse.data.metadata?.page_count,
        format: pdfResponse.data.metadata?.format,
        
        // Prozess-Informationen
        process_id: pdfResponse.process?.id,
        processor: pdfResponse.process?.main_processor,
        sub_processors: pdfResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: pdfResponse.process?.llm_info?.total_duration,
        model_used: pdfResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: pdfResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: pdfResponse.process?.is_from_cache || false,
        cache_key: pdfResponse.process?.cache_key
      };
      
      console.log('[TransformService] Extrahierte Metadaten:', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      console.error('[TransformService] Kein Text-Content in der Response gefunden!');
      console.error('[TransformService] Response-Struktur:', {
        hasResponse: !!response,
        hasData: !!(response && response.data),
        hasTextContent: !!(response && response.data && response.data.text_content),
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    console.log('[TransformService] Finaler transformierter Text-Länge:', transformedText.length);
    
    // Erstelle Markdown-Inhalt mit Frontmatter
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);
    
    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      console.log('[TransformService] Speichere Shadow-Twin mit Länge:', markdownContent.length);
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems
      );
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems
      };
    } else {
      console.log('[TransformService] Keine Speicherung:', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length
      });
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
        candidateName = `${baseName}(${counter}).${extension}`;
      }
      
      return candidateName;
    };
    
    // Generiere eindeutigen Dateinamen
    const uniqueFileName = generateUniqueFileName(fileName, fileExtension);
    
    console.log('[TransformService] Eindeutiger Dateiname generiert:', {
      baseNameWithLanguage: fileName,
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

  /**
   * Erstellt Markdown-Inhalt mit YAML-Frontmatter
   */
  private static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
    // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }
    
    // Erstelle YAML-Frontmatter
    let frontmatter = '---\n';
    
    // Sortiere die Metadaten für bessere Lesbarkeit
    const sortedKeys = Object.keys(metadata).sort((a, b) => {
      // Gruppiere nach Kategorien
      const categoryOrder = ['source_', 'transformation_', 'audio_', 'process', 'secretary_', 'cache_'];
      const getCategoryIndex = (key: string) => {
        for (let i = 0; i < categoryOrder.length; i++) {
          if (key.startsWith(categoryOrder[i])) return i;
        }
        return categoryOrder.length;
      };
      
      const categoryA = getCategoryIndex(a);
      const categoryB = getCategoryIndex(b);
      
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }
      return a.localeCompare(b);
    });
    
    // Füge Metadaten zum Frontmatter hinzu
    for (const key of sortedKeys) {
      const value = metadata[key];
      
      // Überspringe undefined-Werte
      if (value === undefined) {
        continue;
      }
      
      // Formatiere den Wert je nach Typ
      if (typeof value === 'string') {
        // Escape Anführungszeichen in Strings
        const escapedValue = value.replace(/"/g, '\\"');
        frontmatter += `${key}: "${escapedValue}"\n`;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        frontmatter += `${key}: ${value}\n`;
      } else {
        // Für komplexe Objekte verwende JSON (sollte nicht vorkommen)
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    frontmatter += '---\n\n';
    
    // Kombiniere Frontmatter mit Inhalt
    return frontmatter + content;
  }
} 