import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { TransformService } from './transform-service';
import { 
  BaseTransformOptions, 
  BatchTranscriptionItem,
  BatchTransformationItem,
  AudioTransformSettings,
  VideoTransformSettings
} from '@/atoms/transcription-options';
import { transformText, transformTextWithTemplate } from '@/lib/secretary/client';

// Default-Einstellungen
const DEFAULT_AUDIO_SETTINGS: AudioTransformSettings = {
  sourceLanguage: 'auto',
  template: 'Besprechung'
};

const DEFAULT_VIDEO_SETTINGS: VideoTransformSettings = {
  ...DEFAULT_AUDIO_SETTINGS,
  extractAudio: true,
  extractFrames: false,
  frameInterval: 1
};

export interface BatchTransformProgress {
  currentItem: number;
  totalItems: number;
  currentFileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface BatchTransformResult {
  success: boolean;
  results: Array<{
    item: StorageItem;
    success: boolean;
    error?: string;
    savedItem?: StorageItem;
    updatedItems?: StorageItem[];
  }>;
}

export class BatchTransformService {
  /**
   * Transformiert eine Batch von Audio/Video-Dateien (jede einzeln)
   */
  static async transformBatch(
    items: BatchTranscriptionItem[],
    baseOptions: BaseTransformOptions,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Progress-Update
      onProgress?.({
        currentItem: i + 1,
        totalItems: items.length,
        currentFileName: item.item.metadata.name,
        status: 'processing'
      });

      try {
        let result;
        
        // Hole die Datei als Blob
        const { blob } = await provider.getBinary(item.item.id);
        if (!blob) {
          throw new Error("Datei konnte nicht geladen werden");
        }

        // Konvertiere Blob zu File für die Verarbeitung
        const file = new File([blob], item.item.metadata.name, { type: item.item.metadata.mimeType });
        
        // Generiere den Shadow-Twin-Namen über den TransformService
        const shadowTwinName = TransformService.generateShadowTwinName(
          item.item.metadata.name, 
          baseOptions.targetLanguage
        );
        
        switch (item.type) {
          case 'audio':
            result = await TransformService.transformAudio(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          case 'video':
            result = await TransformService.transformVideo(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                ...DEFAULT_VIDEO_SETTINGS
              },
              provider,
              refreshItems,
              libraryId
            );
            break;
            
          default:
            throw new Error(`Unsupported media type: ${item.type}`);
        }

        results.push({
          item: item.item,
          success: true,
          savedItem: result.savedItem,
          updatedItems: result.updatedItems
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'success'
        });

      } catch (error) {
        hasError = true;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          item: item.item,
          success: false,
          error: errorMessage
        });

        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: item.item.metadata.name,
          status: 'error',
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }

  /**
   * Transformiert eine Batch von Text-Dateien (alle zusammen als ein Dokument)
   */
  static async transformTextBatch(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
    template: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = [];
    let hasError = false;

    try {
      // Progress: Lade alle Texte
      onProgress?.({
        currentItem: 0,
        totalItems: items.length,
        currentFileName: 'Lade alle Texte...',
        status: 'processing'
      });

      // Alle Text-Inhalte laden
      const textContents: Array<{ item: StorageItem; content: string; fileName: string }> = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        onProgress?.({
          currentItem: i + 1,
          totalItems: items.length,
          currentFileName: `Lade ${item.item.metadata.name}...`,
          status: 'processing'
        });

        try {
          // Text-Inhalt laden
          const { blob } = await provider.getBinary(item.item.id);
          if (!blob) {
            throw new Error(`Datei ${item.item.metadata.name} konnte nicht geladen werden`);
          }

          const content = await blob.text();
          textContents.push({
            item: item.item,
            content: content,
            fileName: item.item.metadata.name
          });

          // Erfolg für diese Datei markieren
          results.push({
            item: item.item,
            success: true
          });

        } catch (error) {
          hasError = true;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          results.push({
            item: item.item,
            success: false,
            error: errorMessage
          });
        }
      }

      // Wenn alle Texte erfolgreich geladen wurden, führe die Transformation durch
      if (textContents.length > 0) {
        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformiere kombinierten Text...',
          status: 'processing'
        });

        // Alle Texte zusammenführen
        const combinedText = textContents.map(tc => 
          `## ${tc.fileName}\n\n${tc.content}\n\n---\n\n`
        ).join('');

        console.log('[BatchTransformService] Kombinierter Text erstellt:', {
          fileCount: textContents.length,
          combinedLength: combinedText.length,
          template: template
        });

        // Template-Typ bestimmen
        const standardTemplates = ['Besprechung', 'Gedanken', 'Interview', 'Zusammenfassung'];
        const isStandardTemplate = standardTemplates.includes(template);

        let transformedText: string;

        if (isStandardTemplate) {
          // Standard-Template verwenden
          transformedText = await transformText(
            combinedText,
            baseOptions.targetLanguage,
            libraryId,
            template
          );
        } else {
          // Benutzerdefiniertes Template: Lade Template-Inhalt
          try {
            // Templates-Ordner finden
            const rootItems = await provider.listItemsById('root');
            const templatesFolder = rootItems.find((item: StorageItem) => 
              item.type === 'folder' && item.metadata.name === 'templates'
            );
            
            if (!templatesFolder) {
              throw new Error('Templates-Ordner nicht gefunden');
            }
            
            // Template-Datei finden
            const templateItems = await provider.listItemsById(templatesFolder.id);
            const templateFile = templateItems.find((item: StorageItem) => 
              item.type === 'file' && 
              item.metadata.name === `${template}.md`
            );
            
            if (!templateFile) {
              throw new Error(`Template-Datei "${template}.md" nicht gefunden`);
            }
            
            // Template-Inhalt laden
            const { blob: templateBlob } = await provider.getBinary(templateFile.id);
            const templateContent = await templateBlob.text();
            
            // Direkter Secretary Service Call mit Template-Content
            transformedText = await transformTextWithTemplate(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              templateContent
            );
          } catch (error) {
            console.error('[BatchTransformService] Fehler beim Laden des Template-Inhalts:', error);
            // Fallback auf Standard-Template
            transformedText = await transformText(
              combinedText,
              baseOptions.targetLanguage,
              libraryId,
              "Besprechung"
            );
          }
        }

        // Generiere Dateinamen für das kombinierte Ergebnis
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const combinedFileName = baseOptions.fileName || `Kombinierte_Transformation_${timestamp}`;
        
        // Ergebnis speichern
        if (baseOptions.createShadowTwin) {
          const result = await TransformService.saveTransformedText(
            transformedText,
            items[0].item, // Verwende das erste Item als Referenz
            {
              ...baseOptions,
              fileName: combinedFileName
            },
            provider,
            refreshItems
          );

          // Aktualisiere das erste Ergebnis mit den Speicher-Informationen
          if (results.length > 0) {
            results[0] = {
              ...results[0],
              savedItem: result.savedItem,
              updatedItems: result.updatedItems
            };
          }
        }

        onProgress?.({
          currentItem: items.length,
          totalItems: items.length,
          currentFileName: 'Transformation abgeschlossen',
          status: 'success'
        });

      }

    } catch (error) {
      hasError = true;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('[BatchTransformService] Fehler bei der Batch-Text-Transformation:', error);
      
      // Markiere alle verbleibenden Items als fehlgeschlagen
      for (let i = results.length; i < items.length; i++) {
        results.push({
          item: items[i].item,
          success: false,
          error: errorMessage
        });
      }
    }

    return {
      success: !hasError,
      results
    };
  }
} 