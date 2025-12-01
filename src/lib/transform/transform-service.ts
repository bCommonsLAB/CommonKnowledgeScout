/**
 * @fileoverview Transform Service - Central Transformation Service
 * 
 * @description
 * Central service for file transformations. Handles PDF, audio, video, image, and text
 * transformations via Secretary Service. Manages shadow twin creation, markdown storage,
 * image extraction, and RAG ingestion. Provides unified interface for all transformation
 * types with consistent error handling and progress tracking.
 * 
 * @module transform
 * 
 * @exports
 * - TransformService: Main transformation service class
 * - TransformSaveOptions: Options interface for transformations
 * - PdfTransformOptions: PDF-specific transformation options
 * - VideoTransformOptions: Video-specific transformation options
 * - ImageTransformOptions: Image-specific transformation options
 * - TransformResult: Result interface for transformations
 * 
 * @usedIn
 * - src/components/library: Library components use transform service
 * - src/app/api/transform: Transform API routes use service
 * 
 * @dependencies
 * - @/lib/secretary/client: Secretary Service client for transformations
 * - @/lib/transform/image-extraction-service: Image extraction service
 * - @/lib/storage/types: Storage types
 * - @/lib/debug/logger: Logging utilities
 */

import { StorageItem, StorageProvider } from "@/lib/storage/types";
import { transformAudio, transformText, transformVideo, transformPdf, transformImage, SecretaryAudioResponse, SecretaryVideoResponse, SecretaryPdfResponse, SecretaryImageResponse } from "@/lib/secretary/client";
import { ImageExtractionService, ImageExtractionResult } from "./image-extraction-service";
import { FileLogger } from '@/lib/debug/logger';
import { generateShadowTwinFolderName } from "@/lib/storage/shadow-twin";

export interface TransformSaveOptions {
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeOcrImages?: boolean; // Mistral OCR Bilder als Base64 (in mistral_ocr_raw.pages[*].images[*].image_base64)
  includePageImages?: boolean; // Seiten-Bilder als ZIP (parallel extrahiert)
  includeImages?: boolean; // Rückwärtskompatibilität: für Standard-Endpoint (deprecated, verwende includeOcrImages/includePageImages)
  useIngestionPipeline?: boolean; // Neu: Auto-RAG nach Speicherung
}

export interface PdfTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  template?: string;
  skipTemplate?: boolean; // Phase 1: nur Extraktion
  // Policies steuern die Phasen klar typisiert
  policies?: import('@/lib/processing/phase-policy').PhasePolicies;
}

export interface TransformResult {
  text: string;
  savedItem?: StorageItem;
  updatedItems: StorageItem[];
  imageExtractionResult?: ImageExtractionResult; // Neu: Ergebnis der Bild-Extraktion
  jobId?: string;
}

export interface VideoTransformOptions extends TransformSaveOptions {
  extractAudio: boolean;
  extractFrames: boolean;
  frameInterval: number;
  sourceLanguage?: string;
  template?: string;
}

export interface ImageTransformOptions extends TransformSaveOptions {
  extractionMethod: string;
  context?: string;
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
    options: PdfTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    // Für Mistral OCR: Beide Parameter standardmäßig true
    const isMistralOcr = options.extractionMethod === 'mistral_ocr';
    const includeOcrImages = options.includeOcrImages !== undefined 
      ? options.includeOcrImages 
      : (isMistralOcr ? true : (options.includeImages ?? false)); // Standard: true für Mistral OCR
    const includePageImages = options.includePageImages !== undefined
      ? options.includePageImages
      : (isMistralOcr ? true : false); // Standard: true für Mistral OCR
    
    FileLogger.info('TransformService', 'PDF-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage,
      includeOcrImages,
      includePageImages,
      includeImages: options.includeImages // Rückwärtskompatibilität
    });
    FileLogger.debug('TransformService', 'Bild-Optionen', {
      includeOcrImages,
      includePageImages,
      includeImages: options.includeImages,
      isMistralOcr
    });
    
    // PDF-Datei wird transformiert - hole die vollständige Response
    // transformPdf erwartet includeOcrImages als Parameter (nicht includePageImages, das wird intern gesetzt)
    const response = await transformPdf(
      file,
      options.targetLanguage,
      libraryId,
      options.template,
      options.extractionMethod,
      options.useCache ?? true,
      includeOcrImages, // Mistral OCR Bilder als Base64
      undefined, // skipTemplate wird nicht mehr verwendet; Flags steuern Phasen
      {
        originalItemId: originalItem.id,
        parentId: originalItem.parentId,
        originalFileName: originalItem.metadata.name,
          policies: options.policies,
      }
    );
    
    FileLogger.debug('TransformService', 'Vollständige PDF-Response', { response: JSON.stringify(response, null, 2) });

    // Asynchroner Flow: nur "accepted" → Ergebnis via Webhook, kein Client-Fehler
    if (response && (response as unknown as { status?: string; data?: { extracted_text?: string } }).status === 'accepted' && !((response as unknown as { data?: { extracted_text?: string } }).data?.extracted_text)) {
      const r = response as unknown as { job?: { id?: string }; process?: { id?: string; is_from_cache?: boolean } };
      FileLogger.info('TransformService', 'Job akzeptiert – Ergebnis kommt per Webhook', {
        jobId: r?.job?.id,
        processId: r?.process?.id,
        fromCache: r?.process?.is_from_cache || false
      });
      return { text: '', updatedItems: [], jobId: r?.job?.id };
    }
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    FileLogger.debug('TransformService', 'Response-Check', {
      hasResponse: !!response,
      responseType: typeof response,
      hasData: !!(response && response.data),
      dataType: response && response.data ? typeof response.data : 'undefined',
      hasExtractedText: !!(response && response.data && response.data.extracted_text),
      extractedTextType: response && response.data && response.data.extracted_text ? typeof response.data.extracted_text : 'undefined',
      dataKeys: response && response.data ? Object.keys(response.data) : []
    });
    
    // Prüfe auf images_archive_data und Mistral OCR Bilder
    const hasZipImages = !!(response && response.data && response.data.images_archive_data);
    const hasMistralOcrImages = !!(response && response.data && response.data.mistral_ocr_raw?.pages?.some((page) => 
      page.images && page.images.length > 0 && page.images.some(img => img.image_base64 && img.image_base64 !== null)
    ));
    
    FileLogger.debug('TransformService', 'Images Check', {
      hasImagesArchiveData: hasZipImages,
      hasImagesArchiveFilename: !!(response && response.data && response.data.images_archive_filename),
      imagesArchiveDataLength: response && response.data && response.data.images_archive_data ? response.data.images_archive_data.length : 0,
      imagesArchiveFilename: response && response.data ? response.data.images_archive_filename : 'undefined',
      hasMistralOcrImages: hasMistralOcrImages,
      mistralOcrPagesCount: response && response.data && response.data.mistral_ocr_raw?.pages ? response.data.mistral_ocr_raw.pages.length : 0
    });
    
    // Entscheidungslogik: Shadow-Twin-Verzeichnis oder Datei?
    // Erstelle Verzeichnis, wenn Bilder vorhanden sind (ZIP oder Mistral OCR)
    const shouldCreateShadowTwinFolder = (includePageImages && hasZipImages) || (includeOcrImages && hasMistralOcrImages);
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige PDF-Response mit Metadaten
      const pdfResponse = response as SecretaryPdfResponse;
      transformedText = pdfResponse.data.extracted_text;
      
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
        extraction_method: pdfResponse.data.metadata?.extraction_method,
        file_name: pdfResponse.data.metadata?.file_name,
        file_size: pdfResponse.data.metadata?.file_size,
        
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
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.warn('TransformService', 'Keine synchronen PDF-Daten erhalten', {
        hasResponse: !!response,
        hasData: !!(response && (response as unknown as { data?: unknown }).data)
      });
    }
    
    // Shadow-Twin-Verzeichnis erstellen, wenn Bilder vorhanden
    let shadowTwinFolderId: string | undefined;
    if (shouldCreateShadowTwinFolder) {
      try {
        const folderName = generateShadowTwinFolderName(originalItem.metadata.name);
        const folderItem = await provider.createFolder(originalItem.parentId, folderName);
        shadowTwinFolderId = folderItem.id;
        FileLogger.info('TransformService', 'Shadow-Twin-Verzeichnis erstellt', {
          folderId: folderItem.id,
          folderName: folderName
        });
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler beim Erstellen des Shadow-Twin-Verzeichnisses', error);
        // Weiter ohne Verzeichnis (Fallback auf Datei)
      }
    }
    
    // Bilder speichern (ZIP-Archive)
    let imageExtractionResult: ImageExtractionResult | undefined;
    if (includePageImages && hasZipImages && response && response.data && response.data.images_archive_data) {
      try {
        FileLogger.info('TransformService', 'Starte ZIP-Bild-Extraktion', {
          imagesArchiveFilename: response.data.images_archive_filename,
          imagesArchiveDataLength: response.data.images_archive_data.length,
          shadowTwinFolderId: shadowTwinFolderId
        });
        imageExtractionResult = await ImageExtractionService.saveZipArchive(
          response.data.images_archive_data,
          response.data.images_archive_filename || 'pdf_images.zip',
          originalItem,
          provider,
          refreshItems,
          transformedText, // Extrahierten Text weitergeben
          options.targetLanguage, // Target Language weitergeben
          response.data.metadata?.text_contents, // Seiten-spezifische Texte weitergeben
          shadowTwinFolderId // Shadow-Twin-Verzeichnis-ID (optional)
        );
        FileLogger.info('TransformService', 'ZIP-Bild-Extraktion abgeschlossen', {
          folderCreated: !!imageExtractionResult.folderItem,
          savedItemsCount: imageExtractionResult.savedItems.length
        });
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler bei der ZIP-Bild-Extraktion', error);
        // Bild-Extraktion ist optional, daher weitermachen
      }
    }
    
    // Mistral OCR Bilder speichern
    if (includeOcrImages && hasMistralOcrImages && shadowTwinFolderId && response && response.data && response.data.mistral_ocr_raw?.pages) {
      try {
        // Sammle alle Bilder aus allen Seiten
        const allImages: Array<{ id: string; image_base64: string }> = [];
        for (const page of response.data.mistral_ocr_raw.pages) {
          if (page.images && Array.isArray(page.images)) {
            for (const image of page.images) {
              if (image.id && image.image_base64) {
                allImages.push({
                  id: image.id,
                  image_base64: image.image_base64
                });
              }
            }
          }
        }
        
        if (allImages.length > 0) {
          FileLogger.info('TransformService', 'Starte Mistral OCR Bild-Speicherung', {
            imageCount: allImages.length,
            shadowTwinFolderId: shadowTwinFolderId
          });
          
          const savedMistralImages = await ImageExtractionService.saveMistralOcrImages(
            allImages,
            shadowTwinFolderId,
            provider
          );
          
          FileLogger.info('TransformService', 'Mistral OCR Bild-Speicherung abgeschlossen', {
            savedItemsCount: savedMistralImages.length
          });
          
          // Füge gespeicherte Bilder zu imageExtractionResult hinzu
          if (imageExtractionResult) {
            imageExtractionResult.savedItems.push(...savedMistralImages);
          } else {
            // Erstelle neues Result wenn noch keins existiert
            imageExtractionResult = {
              extractedImages: [],
              folderItem: await provider.getItemById(shadowTwinFolderId) as StorageItem | undefined,
              savedItems: savedMistralImages
            };
          }
        }
      } catch (error) {
        FileLogger.error('TransformService', 'Fehler bei der Mistral OCR Bild-Speicherung', error);
        // Bild-Extraktion ist optional, daher weitermachen
      }
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // NEU: Detaillierte Debug-Logs für das Speicherproblem
    FileLogger.info('TransformService', 'Speicher-Bedingungen prüfen', {
      createShadowTwin: options.createShadowTwin,
      hasTransformedText: !!transformedText,
      transformedTextLength: transformedText.length,
      markdownContentLength: markdownContent.length,
      willSave: options.createShadowTwin && transformedText
    });

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
      // Wenn Shadow-Twin-Verzeichnis existiert: Markdown im Verzeichnis speichern
      // Sonst: Markdown im Parent-Verzeichnis speichern (wie bisher)
      const parentIdForMarkdown = shadowTwinFolderId || originalItem.parentId;
      
      const result = await TransformService.saveTwinFile(
        markdownContent,
        originalItem,
        options.fileName,
        options.fileExtension,
        provider,
        refreshItems,
        parentIdForMarkdown // Parent-ID für Markdown (Verzeichnis oder Original-Parent)
      );
      
      FileLogger.info('TransformService', 'Shadow-Twin erfolgreich gespeichert', {
        savedItemId: result.savedItem?.id,
        savedItemName: result.savedItem?.metadata.name,
        updatedItemsCount: result.updatedItems.length
      });

      // Nach dem Speichern: Doc-Meta in MongoDB upserten (Statuscache)
      try {
        const saved = result.savedItem
        if (saved && saved.type === 'file') {
          // Metadaten an API weiterreichen
          const payload: Record<string, unknown> = {
            fileId: saved.id,
            fileName: saved.metadata.name,
            docModifiedAt: saved.metadata.modifiedAt || new Date().toISOString(),
            docMeta: metadata,
            // Statusfelder (falls im Metadata vorhanden)
            extract_status: (metadata as unknown as { extract_status?: string }).extract_status,
            template_status: (metadata as unknown as { template_status?: string }).template_status,
            ingest_status: (metadata as unknown as { ingest_status?: string }).ingest_status,
            process_status: (metadata as unknown as { process_status?: string }).process_status,
            hasError: (metadata as unknown as { hasError?: boolean }).hasError,
            errorCode: (metadata as unknown as { errorCode?: string }).errorCode,
            errorMessage: (metadata as unknown as { errorMessage?: string }).errorMessage,
            lastErrorAt: (metadata as unknown as { lastErrorAt?: string }).lastErrorAt,
            year: (metadata as unknown as { year?: number | string }).year,
            language: (metadata as unknown as { language?: string }).language,
            region: (metadata as unknown as { region?: string }).region,
            docType: (metadata as unknown as { docType?: string }).docType,
            source: (metadata as unknown as { source?: string }).source,
            isScan: (metadata as unknown as { isScan?: boolean }).isScan,
            pageCount: (metadata as unknown as { pageCount?: number | string }).pageCount,
            authors: (metadata as unknown as { authors?: string[] }).authors,
            tags: (metadata as unknown as { tags?: string[] }).tags,
          }
          FileLogger.info('TransformService', 'Doc-Meta Upsert call', { libraryId, fileId: saved.id })
          // Fire-and-forget; Fehler loggen, Prozess nicht blockieren
          fetch(`/api/chat/${libraryId}/upsert-doc-meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(err => {
            FileLogger.warn('TransformService', 'Doc-Meta Upsert fehlgeschlagen (non-blocking)', { err: String(err) })
          })
        }
      } catch (e) {
        FileLogger.warn('TransformService', 'Doc-Meta Upsert übersprungen', { err: String(e) })
      }
      
      return {
        text: transformedText, // Gebe nur den Text zurück, nicht das Markdown mit Frontmatter
        savedItem: result.savedItem,
        updatedItems: result.updatedItems,
        imageExtractionResult
      };
    } else {
      FileLogger.warn('TransformService', 'Keine Speicherung - Bedingungen nicht erfüllt', {
        createShadowTwin: options.createShadowTwin,
        hasText: !!transformedText,
        textLength: transformedText.length,
        reason: !options.createShadowTwin ? 'createShadowTwin ist false' : 'transformedText ist leer'
      });
    }

    return {
      text: transformedText,
      updatedItems: [],
      imageExtractionResult
    };
  }

  /**
   * Transformiert ein Bild mithilfe des Secretary Services
   * @param file Die zu transformierende Bilddatei
   * @param originalItem Das ursprüngliche StorageItem
   * @param options Optionen für Bild-Transformation und Speicherung
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param libraryId ID der aktiven Bibliothek
   * @returns Das Transformationsergebnis
   */
  static async transformImage(
    file: File,
    originalItem: StorageItem,
    options: ImageTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string
  ): Promise<TransformResult> {
    FileLogger.info('TransformService', 'Bild-Transformation gestartet', {
      fileName: originalItem.metadata.name,
      extractionMethod: options.extractionMethod,
      targetLanguage: options.targetLanguage
    });
    
    // Bild wird transformiert - hole die vollständige Response
    const response = await transformImage(
      file,
      options.targetLanguage,
      libraryId,
      options.extractionMethod,
      options.context,
      options.useCache ?? true
    );
    
    FileLogger.debug('TransformService', 'Vollständige Bild-Response', {
      response: JSON.stringify(response, null, 2)
    });
    
    // Extrahiere den Text aus der Response
    let transformedText = '';
    let metadata: TransformMetadata = {};
    
    if (response && response.data && response.data.extracted_text) {
      FileLogger.info('TransformService', 'Extracted-Text gefunden', {
        textLength: response.data.extracted_text.length,
        textPreview: response.data.extracted_text.substring(0, 200)
      });
      
      // Vollständige Bild-Response mit Metadaten
      const imageResponse = response as SecretaryImageResponse;
      transformedText = imageResponse.data.extracted_text;
      
      // Sammle relevante Bild-Metadaten
      metadata = {
        // Quelldatei-Informationen
        source_file: originalItem.metadata.name,
        source_file_id: originalItem.id,
        source_file_size: originalItem.metadata.size,
        source_file_type: originalItem.metadata.mimeType,
        
        // Transformations-Informationen
        target_language: options.targetLanguage,
        
        // Bild-Metadaten
        dimensions: imageResponse.data.metadata?.dimensions,
        format: imageResponse.data.metadata?.format,
        color_mode: imageResponse.data.metadata?.color_mode,
        dpi: imageResponse.data.metadata?.dpi?.join('x'),
        extraction_method: imageResponse.data.metadata?.extraction_method,
        file_name: imageResponse.data.metadata?.file_name,
        file_size: imageResponse.data.metadata?.file_size,
        
        // Prozess-Informationen
        process_id: imageResponse.process?.id,
        processor: imageResponse.process?.main_processor,
        sub_processors: imageResponse.process?.sub_processors?.join(', '),
        processing_duration_ms: imageResponse.process?.llm_info?.total_duration,
        model_used: imageResponse.process?.llm_info?.requests?.[0]?.model,
        tokens_used: imageResponse.process?.llm_info?.total_tokens,
        
        // Secretary Service Informationen
        cache_used: imageResponse.process?.is_from_cache || false,
        cache_key: imageResponse.process?.cache_key
      };
      
      FileLogger.debug('TransformService', 'Extrahierte Metadaten', metadata);
      
      // Entferne undefined-Werte
      Object.keys(metadata).forEach(key => {
        if (metadata[key] === undefined || metadata[key] === null) {
          delete metadata[key];
        }
      });
    } else {
      FileLogger.error('TransformService', 'Kein Extracted-Text in der Response gefunden!', {
        responseKeys: response ? Object.keys(response) : [],
        dataKeys: response && response.data ? Object.keys(response.data) : []
      });
    }
    
    FileLogger.debug('TransformService', 'Finaler transformierter Text', {
      textLength: transformedText.length
    });
    const markdownContent = TransformService.createMarkdownWithFrontmatter(transformedText, metadata);

    // Ergebnis wird gespeichert, wenn gewünscht
    if (options.createShadowTwin && transformedText) {
      FileLogger.info('TransformService', 'Speichere Shadow-Twin', {
        markdownLength: markdownContent.length
      });
      
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
      FileLogger.debug('TransformService', 'Keine Speicherung', {
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
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    parentId?: string // Optional: Parent-ID für Markdown (Shadow-Twin-Verzeichnis oder Original-Parent)
  ): Promise<{ savedItem?: StorageItem; updatedItems: StorageItem[] }> {
    console.log('[TransformService] saveTwinFile aufgerufen mit:', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension
    });
    
    // Bestimme Parent-ID (Shadow-Twin-Verzeichnis oder Original-Parent)
    const targetParentId = parentId || originalItem.parentId;
    
    // NEU: Detaillierte Debug-Logs
    FileLogger.info('TransformService', 'saveTwinFile gestartet', {
      originalItemName: originalItem.metadata.name,
      fileName: fileName,
      fileExtension: fileExtension,
      contentLength: content.length,
      parentId: targetParentId,
      isShadowTwinFolder: !!parentId
    });
    
    // Hole aktuelle Dateien im Verzeichnis
    const currentItems = await refreshItems(targetParentId);
    FileLogger.debug('TransformService', 'Aktuelle Dateien im Verzeichnis', {
      parentId: originalItem.parentId,
      itemCount: currentItems.length,
      existingFiles: currentItems.filter(item => item.type === 'file').map(item => item.metadata.name)
    });
    
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
    
    FileLogger.info('TransformService', 'Dateiname generiert', {
      baseName: fileName,
      uniqueFileName: uniqueFileName,
      existingFilesCount: currentItems.filter(item => item.type === 'file').length
    });
    
    // Markdown-Datei erstellen und speichern
    const fileBlob = new Blob([content], { type: "text/markdown" });
    const file = new File([fileBlob], uniqueFileName, { type: "text/markdown" });
    
    FileLogger.info('TransformService', 'Datei vorbereitet für Upload', {
      fileName: uniqueFileName,
      fileSize: file.size,
      fileType: file.type,
      contentLength: content.length
    });
    
    // In dasselbe Verzeichnis wie die Originaldatei hochladen
    FileLogger.info('TransformService', 'Starte Upload', {
      parentId: targetParentId,
      fileName: uniqueFileName
    });
    
    const savedItem = await provider.uploadFile(targetParentId, file);
    
    FileLogger.info('TransformService', 'Upload erfolgreich', {
      savedItemId: savedItem.id,
      savedItemName: savedItem.metadata.name,
      savedItemSize: savedItem.metadata.size
    });
    
    // Aktualisierte Dateiliste holen
    const updatedItems = await refreshItems(targetParentId);
    
    FileLogger.info('TransformService', 'Dateiliste aktualisiert', {
      updatedItemsCount: updatedItems.length,
      newFileFound: updatedItems.some(item => item.id === savedItem.id)
    });
    
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
  static createMarkdownWithFrontmatter(content: string, metadata: TransformMetadata): string {
    // Wenn keine Metadaten vorhanden sind, gebe nur den Inhalt zurück
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }
    
    // Normalisiere eingehende Metadaten (entferne doppelte Serialisierung/Quotes)
    const normalizedMeta: Record<string, unknown> = {}
    const maybeJsonParse = (val: string): unknown => {
      let s = val.trim()
      // Entferne mehrfach gesetzte umschließende Quotes und unescape \" → "
      for (let i = 0; i < 3; i++) {
        const startsQ = s.startsWith('"') && s.endsWith('"')
        if (startsQ) s = s.slice(1, -1)
        s = s.replace(/\\\"/g, '"') // \" → "
        s = s.replace(/\\\\/g, '\\') // \\ → \
      }
      // Versuche JSON zu parsen, wenn wie JSON aussieht
      const looksJson = s.startsWith('[') || s.startsWith('{') || (s.startsWith('"') && s.endsWith('"'))
      if (looksJson) {
        try { return JSON.parse(s) } catch { /* ignore */ }
      }
      return s
    }
    for (const [k, v] of Object.entries(metadata)) {
      if (v === undefined) continue
      if (typeof v === 'string') {
        const parsed = maybeJsonParse(v)
        normalizedMeta[k] = parsed
      } else {
        normalizedMeta[k] = v
      }
    }

    // Erstelle YAML-Frontmatter
    let frontmatter = '---\n';
    
    // Sortiere die Metadaten für bessere Lesbarkeit
    const sortedKeys = Object.keys(normalizedMeta).sort((a, b) => {
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
      const value = normalizedMeta[key];
      
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
        // Für Arrays/Objekte: als JSON einbetten (kompakt)
        frontmatter += `${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    frontmatter += '---\n\n';
    
    // Kombiniere Frontmatter mit Inhalt
    return frontmatter + content;
  }
} 