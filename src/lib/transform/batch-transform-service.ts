import { StorageItem, StorageProvider } from '@/lib/storage/types';
import { TransformService } from './transform-service';
import { 
  BaseTransformOptions, 
  BatchItem,
  AudioTransformSettings,
  VideoTransformSettings
} from '@/atoms/transform-options';

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
  error?: string;
  results: Array<{
    item: StorageItem;
    success: boolean;
    error?: string;
    savedItem?: StorageItem;
    updatedItems?: StorageItem[];
  }>;
}

export class BatchTransformService {
  static async transformBatch(
    items: BatchItem[],
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
} 