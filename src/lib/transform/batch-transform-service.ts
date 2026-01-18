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
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming';
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types';

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

/**
 * Ermittelt Template-Inhalt für benutzerdefinierte Templates einmalig,
 * damit wir pro Seite nicht mehrfach aus Mongo laden müssen.
 */
async function resolveTemplateContent(args: {
  template: string
  libraryId: string
}): Promise<{ templateName: string; templateContent?: string; isStandard: boolean }> {
  const standardTemplates = ['Besprechung', 'Gedanken', 'Interview', 'Zusammenfassung']
  const isStandard = standardTemplates.includes(args.template)
  if (isStandard) {
    return { templateName: args.template, isStandard: true }
  }

  try {
    const { loadTemplate } = await import('@/lib/templates/template-service-client')
    const templateResult = await loadTemplate({
      libraryId: args.libraryId,
      preferredTemplateName: args.template,
    })
    return { templateName: args.template, templateContent: templateResult.templateContent, isStandard: false }
  } catch (error) {
    // Erklärung: Fallback auf Standard-Template, falls Custom-Template nicht geladen werden kann.
    console.error('[BatchTransformService] Template-Load fehlgeschlagen, Fallback auf Standard-Template', error)
    return { templateName: 'Besprechung', isStandard: true }
  }
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
        
        // Generiere den Shadow-Twin-Namen mit zentraler Logik
        const artifactKey: ArtifactKey = {
          sourceId: item.item.id,
          kind: 'transcript',
          targetLanguage: baseOptions.targetLanguage,
        };
        const shadowTwinName = buildArtifactName(artifactKey, item.item.metadata.name).replace(/\.md$/, '');
        
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
            
          case 'document':
            result = await TransformService.transformPdf(
              file,
              item.item,
              {
                ...baseOptions,
                fileName: shadowTwinName,
                extractionMethod: "mistral_ocr" // Globaler Default: mistral_ocr
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
            // Verwende zentrale Client-Library für MongoDB-Templates
            const { loadTemplate } = await import('@/lib/templates/template-service-client')
            const templateResult = await loadTemplate({
              libraryId,
              preferredTemplateName: template
            })
            const templateContent = templateResult.templateContent
            
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
          // Explizite Parameter übergeben statt aus Dateinamen zu parsen
          const result = await TransformService.saveTransformedText(
            transformedText,
            items[0].item, // Verwende das erste Item als Referenz
            {
              ...baseOptions,
              fileName: combinedFileName
            },
            provider,
            refreshItems,
            libraryId, // libraryId für Modus-Bestimmung
            'transformation', // artifactKind: Template-Transformation
            template // templateName: Explizit übergeben
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

  /**
   * Transformiert eine Batch von Text-Dateien – jede Datei wird separat transformiert.
   * Diese Variante ist für Seiten-Splitting gedacht (1 Seite -> 1 Output).
   */
  static async transformTextBatchPerFile(
    items: BatchTransformationItem[],
    baseOptions: BaseTransformOptions,
    template: string,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    libraryId: string,
    onProgress?: (progress: BatchTransformProgress) => void
  ): Promise<BatchTransformResult> {
    const results: BatchTransformResult['results'] = []
    let hasError = false

    // Erklärung: Template-Inhalt nur einmal laden, um wiederholte DB-Calls zu vermeiden.
    const resolvedTemplate = await resolveTemplateContent({ template, libraryId })

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      onProgress?.({
        currentItem: i + 1,
        totalItems: items.length,
        currentFileName: item.item.metadata.name,
        status: 'processing',
      })

      try {
        const { blob } = await provider.getBinary(item.item.id)
        if (!blob) {
          throw new Error(`Datei ${item.item.metadata.name} konnte nicht geladen werden`)
        }

        const content = await blob.text()
        let transformedText: string

        if (resolvedTemplate.isStandard) {
          transformedText = await transformText(
            content,
            baseOptions.targetLanguage,
            libraryId,
            resolvedTemplate.templateName
          )
        } else if (resolvedTemplate.templateContent) {
          transformedText = await transformTextWithTemplate(
            content,
            baseOptions.targetLanguage,
            libraryId,
            resolvedTemplate.templateContent
          )
        } else {
          // Defensive: wenn templateContent fehlt, fallback auf Standard-Template.
          transformedText = await transformText(
            content,
            baseOptions.targetLanguage,
            libraryId,
            'Besprechung'
          )
        }

        // Erklärung: per-file Output wird neben der Seite gespeichert (nicht als Shadow-Twin),
        // damit Explorer die Dokumente direkt sieht.
        const baseName = item.item.metadata.name.replace(/\.mdx?$/i, '')
        const extension = (baseOptions.fileExtension || 'md').replace(/^\./, '')
        const fileName = `${baseName}.${template}.${baseOptions.targetLanguage}.${extension}`
        const file = new File([transformedText], fileName, { type: 'text/markdown' })
        const targetParentId = item.item.parentId || 'root'
        const savedItem = await provider.uploadFile(targetParentId, file)

        results.push({
          item: item.item,
          success: true,
          savedItem,
        })
      } catch (error) {
        hasError = true
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.push({
          item: item.item,
          success: false,
          error: errorMessage,
        })
      }
    }

    // UI-Refresh: Wenn möglich, aktualisieren wir den Parent-Ordner einmalig.
    if (items.length > 0) {
      const parentId = items[0].item.parentId
      if (parentId) {
        try {
          await refreshItems(parentId)
        } catch (error) {
          console.error('[BatchTransformService] Refresh fehlgeschlagen', error)
        }
      }
    }

    onProgress?.({
      currentItem: items.length,
      totalItems: items.length,
      currentFileName: 'Transformation abgeschlossen',
      status: 'success',
    })

    return {
      success: !hasError,
      results,
    }
  }
} 