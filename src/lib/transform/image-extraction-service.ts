/**
 * @fileoverview Image Extraction Service - PDF Image Extraction and Storage
 * 
 * @description
 * Service for extracting images from PDF ZIP archives and storing them with associated
 * text content. Handles ZIP archive parsing, image file extraction, markdown file creation
 * for text content, and folder organization. Creates structured folder hierarchies for
 * extracted images and their metadata.
 * 
 * @module transform
 * 
 * @exports
 * - ImageExtractionService: Main image extraction service class
 * - ExtractedPageImage: Interface for extracted page images
 * - ImageExtractionResult: Result interface for image extraction
 * 
 * @usedIn
 * - src/lib/transform/transform-service.ts: Transform service uses image extraction
 * - src/lib/external-jobs/images.ts: External jobs use image extraction
 * 
 * @dependencies
 * - @/lib/storage/types: Storage types
 * - @/lib/debug/logger: Logging utilities
 * - jszip: ZIP archive parsing library
 */

import { StorageProvider, StorageItem } from "@/lib/storage/types";
import { FileLogger } from "@/lib/debug/logger";
import { generateShadowTwinFolderName } from "@/lib/storage/shadow-twin";

type ZipExtractCapableProvider = StorageProvider & {
  saveAndExtractZipInFolder: (parentId: string, zipBase64: string) => Promise<StorageItem[]>
}

function canSaveAndExtractZipInFolder(provider: StorageProvider): provider is ZipExtractCapableProvider {
  return typeof (provider as unknown as { saveAndExtractZipInFolder?: unknown }).saveAndExtractZipInFolder === 'function'
}

/**
 * Interface für extrahierte Bilder mit zugehörigem Text
 */
export interface ExtractedPageImage {
  pageNumber: number;
  imageBlob: Blob;
  textContent: string;
  imageName: string; // z.B. "page_001.png"
  textName: string;  // z.B. "page_001.md"
}

/**
 * Interface für das Ergebnis der Bild-Extraktion
 */
export interface ImageExtractionResult {
  extractedImages: ExtractedPageImage[];
  folderItem?: StorageItem;
  savedItems: StorageItem[];
}

/**
 * Service für die Extraktion und Speicherung von PDF-Bildern
 */
export class ImageExtractionService {
  
  /**
   * Speichert das ZIP-Archiv und extrahiert die Bilder einzeln
   * @param base64ZipData Base64-kodierte ZIP-Daten
   * @param fileName Name der ZIP-Datei
   * @param originalItem Das ursprüngliche PDF-StorageItem
   * @param provider Der Storage-Provider
   * @param refreshItems Callback zum Aktualisieren der Dateiliste
   * @param extractedText Der extrahierte Text aus der PDF (optional)
   * @param targetLanguage Die Zielsprache für die Markdown-Dateien (optional)
   * @param textContents Array mit seiten-spezifischen Texten (optional)
   * @param shadowTwinFolderId Optional: ID des Shadow-Twin-Verzeichnisses. Wenn vorhanden, werden Bilder dort gespeichert statt in separatem Ordner.
   * @returns Ergebnis der Speicherung
   */
  static async saveZipArchive(
    base64ZipData: string,
    fileName: string,
    originalItem: StorageItem,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>,
    extractedText?: string,
    targetLanguage?: string,
    textContents?: Array<{ page: number; content: string }>,
    shadowTwinFolderId?: string
  ): Promise<ImageExtractionResult> {
    try {
      FileLogger.info('ImageExtractionService', 'Starte ZIP-Extraktion und Bild-Speicherung', {
        fileName,
        originalFile: originalItem.metadata.name,
        base64DataLength: base64ZipData.length,
        hasShadowTwinFolder: !!shadowTwinFolderId
      });
      
      let folderItem: StorageItem;
      
      if (shadowTwinFolderId) {
        // Verwende Shadow-Twin-Verzeichnis
        folderItem = await provider.getItemById(shadowTwinFolderId);
        if (!folderItem || folderItem.type !== 'folder') {
          throw new Error(`Shadow-Twin-Verzeichnis mit ID ${shadowTwinFolderId} nicht gefunden oder kein Verzeichnis`);
        }
        FileLogger.info('ImageExtractionService', 'Verwende Shadow-Twin-Verzeichnis', {
          folderId: folderItem.id,
          folderName: folderItem.metadata.name
        });
      } else {
        // Erstelle separaten Ordner (Rückwärtskompatibilität)
        const folderName = generateShadowTwinFolderName(originalItem.metadata.name);
        folderItem = await provider.createFolder(originalItem.parentId, folderName);
        FileLogger.info('ImageExtractionService', 'Ordner erstellt', {
          folderId: folderItem.id,
          folderName: folderName
        });
      }
      
      // PERFORMANCE (filesystem):
      // Wenn der Provider eine ZIP-Bulk-Extraktion anbietet, nutzen wir diese, um N einzelne Uploads
      // (und damit N HTTP Requests beim LocalStorageProvider) zu vermeiden.
      if (canSaveAndExtractZipInFolder(provider)) {
        const savedItems = await provider.saveAndExtractZipInFolder(folderItem.id, base64ZipData)
        FileLogger.info('ImageExtractionService', 'ZIP via Bulk-Extraction gespeichert', {
          zipName: fileName,
          folderId: folderItem.id,
          savedItems: savedItems.length,
        })
        return { extractedImages: [], folderItem, savedItems }
      }
      
      
      // Base64 zu Buffer konvertieren
      const buffer = Buffer.from(base64ZipData, 'base64');
      FileLogger.debug('ImageExtractionService', 'Base64 zu Buffer konvertiert', {
        bufferLength: buffer.length,
        bufferBytes: buffer.byteLength
      });
      
      // ZIP-Archiv mit JSZip entpacken
      const JSZip = await import('jszip');
      const zip = new JSZip.default();
      const zipContent = await zip.loadAsync(buffer);
      
      FileLogger.info('ImageExtractionService', 'ZIP-Archiv geladen', {
        totalFiles: Object.keys(zipContent.files).length,
        fileList: Object.keys(zipContent.files),
        zipSize: buffer.length
      });
      
      // Detaillierte Analyse der ZIP-Struktur
      const fileDetails = Object.entries(zipContent.files).map(([path, file]) => ({
        path,
        isDirectory: file.dir,
        size: 'unknown' // JSZip API gibt keine direkte Größe preis
      }));
      
      FileLogger.info('ImageExtractionService', 'Detaillierte ZIP-Analyse', {
        fileDetails,
        hasImages: fileDetails.some(f => !f.isDirectory && (f.path.includes('.png') || f.path.includes('.jpg') || f.path.includes('.jpeg')))
      });
      
      const savedItems: StorageItem[] = [];
      
      // ZIP-Backup wird nicht mehr gespeichert - nur Bilder werden extrahiert
      
      // Extrahiere und speichere alle Bilder
      let processedFiles = 0;
      let skippedFiles = 0;
      let errorFiles = 0;
      
      for (const [filePath, file] of Object.entries(zipContent.files)) {
        FileLogger.debug('ImageExtractionService', 'Verarbeite ZIP-Eintrag', {
          filePath,
          isDirectory: file.dir,
          fileSize: 'unknown' // JSZip API gibt keine direkte Größe preis
        });
        
        if (!file.dir) {
          try {
            // Bestimme den Dateityp basierend auf der Erweiterung
            const fileExtension = filePath.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';
            
            if (fileExtension === 'png') {
              mimeType = 'image/png';
            } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
              mimeType = 'image/jpeg';
            }
            
            // Extrahiere den ursprünglichen Dateinamen aus dem Pfad
            const originalFileName = filePath.split('/').pop() || filePath;
            
            // Konvertiere image_XXX zu page_XXX und behalte führende Nullen bei
            const pageFileName = originalFileName.replace(/^image_(\d+)/, (match, pageNum) => {
              // Behalte die ursprüngliche Formatierung bei (mit oder ohne führende Nullen)
              return `page_${pageNum.padStart(3, '0')}`;
            });
            
            FileLogger.debug('ImageExtractionService', 'Extrahiere Bild-Datei', {
              filePath,
              originalFileName,
              pageFileName,
              fileExtension,
              mimeType
            });
            
            // Bild-Blob extrahieren
            const imageBlob = await file.async('blob');
            
            FileLogger.debug('ImageExtractionService', 'Bild-Blob erstellt', {
              pageFileName,
              blobSize: imageBlob.size,
              blobType: imageBlob.type
            });
            
            // Bild-Datei mit neuem Namen erstellen und speichern
            const imageFile = new File([imageBlob], pageFileName, { type: mimeType });
            const savedImageItem = await provider.uploadFile(folderItem.id, imageFile);
            savedItems.push(savedImageItem);
            
            FileLogger.info('ImageExtractionService', `Bild extrahiert und gespeichert`, {
              pageFileName,
              fileSize: imageBlob.size,
              mimeType,
              savedItemId: savedImageItem.id
            });
            
            // Erstelle entsprechende Markdown-Datei mit seiten-spezifischem Text
            if (textContents && textContents.length > 0) {
              try {
                // Extrahiere die Seitennummer aus dem Dateinamen (mit führenden Nullen)
                const pageMatch = pageFileName.match(/page_(\d+)/);
                if (pageMatch) {
                  const pageNumber = parseInt(pageMatch[1], 10);
                  
                  // Finde den entsprechenden Text für diese Seite
                  const pageText = textContents.find(tc => tc.page === pageNumber);
                  
                  if (pageText) {
                    // Generiere Markdown-Dateinamen mit Sprachkürzel
                    const baseFileName = pageFileName.replace(/\.(png|jpg|jpeg)$/i, '');
                    const markdownFileName = targetLanguage 
                      ? `${baseFileName}.${targetLanguage}.md`
                      : `${baseFileName}.md`;
                    
                    const markdownContent = this.createMarkdownContent(pageFileName, pageText.content, originalItem.metadata.name, targetLanguage, pageNumber);
                    const markdownBlob = new Blob([markdownContent], { type: 'text/markdown' });
                    const markdownFile = new File([markdownBlob], markdownFileName, { type: 'text/markdown' });
                    const savedMarkdownItem = await provider.uploadFile(folderItem.id, markdownFile);
                    savedItems.push(savedMarkdownItem);
                    
                    FileLogger.info('ImageExtractionService', `Markdown-Datei erstellt`, {
                      markdownFileName,
                      pageNumber,
                      targetLanguage,
                      contentLength: markdownContent.length,
                      savedItemId: savedMarkdownItem.id
                    });
                  } else {
                    FileLogger.warn('ImageExtractionService', `Kein Text für Seite ${pageNumber} gefunden`, {
                      pageFileName,
                      availablePages: textContents.map(tc => tc.page)
                    });
                  }
                }
              } catch (error) {
                FileLogger.error('ImageExtractionService', `Fehler beim Erstellen der Markdown-Datei für ${pageFileName}`, error);
                // Weitermachen, auch wenn Markdown-Erstellung fehlschlägt
              }
            }
            
            processedFiles++;
          } catch (error) {
            FileLogger.error('ImageExtractionService', `Fehler beim Speichern von ${filePath}`, error);
            errorFiles++;
            // Weitermachen mit der nächsten Datei
          }
        } else {
          FileLogger.debug('ImageExtractionService', 'Verzeichnis übersprungen', { filePath });
          skippedFiles++;
        }
      }
      
      FileLogger.info('ImageExtractionService', 'Bild-Extraktion abgeschlossen', {
        processedFiles,
        skippedFiles,
        errorFiles,
        totalSavedItems: savedItems.length
      });
      
      // README-Datei wird nicht mehr erstellt - nur Bilder werden gespeichert
      
      // Aktualisiere die Dateiliste des übergeordneten Ordners
      await refreshItems(originalItem.parentId);
      
      FileLogger.info('ImageExtractionService', 'ZIP-Extraktion vollständig abgeschlossen', {
        folderName: folderItem.metadata.name,
        extractedFilesCount: processedFiles,
        totalSavedItems: savedItems.length
      });
      
      return {
        extractedImages: [], // Leer, da wir die Bilder direkt speichern
        folderItem,
        savedItems
      };
    } catch (error) {
      FileLogger.error('ImageExtractionService', 'Fehler bei der ZIP-Extraktion', error);
      throw new Error(`Fehler bei der ZIP-Extraktion: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }
  
  /**
   * Erstellt einen Download-Link für das Base64-ZIP-Archiv
   * @param base64ZipData Base64-kodierte ZIP-Daten
   * @returns Download-URL
   */
  static createZipDownloadUrl(base64ZipData: string): string {
    try {
      // Base64 zu Buffer konvertieren (wie in der Event-Job-Route)
      const buffer = Buffer.from(base64ZipData, 'base64');
      
      // Blob erstellen
      const blob = new Blob([buffer], { type: 'application/zip' });
      
      // URL erstellen
      return URL.createObjectURL(blob);
    } catch (error) {
      FileLogger.error('ImageExtractionService', 'Fehler beim Erstellen der Download-URL', error);
      throw new Error(`Fehler beim Erstellen der Download-URL: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }
  
  /**
   * Speichert Mistral OCR Bilder im Shadow-Twin-Verzeichnis
   * @param images Array von Mistral OCR Bildern mit Base64-Daten
   * @param shadowTwinFolderId ID des Shadow-Twin-Verzeichnisses
   * @param provider Der Storage-Provider
   * @returns Array von gespeicherten StorageItems
   */
  static async saveMistralOcrImages(
    images: Array<{ id: string; image_base64: string }>,
    shadowTwinFolderId: string,
    provider: StorageProvider
  ): Promise<StorageItem[]> {
    const savedItems: StorageItem[] = [];
    
    FileLogger.info('ImageExtractionService', 'Starte Mistral OCR Bild-Speicherung', {
      imageCount: images.length,
      shadowTwinFolderId
    });
    
    // Stelle sicher, dass Shadow-Twin-Verzeichnis existiert
    const folderItem = await provider.getItemById(shadowTwinFolderId);
    if (!folderItem || folderItem.type !== 'folder') {
      throw new Error(`Shadow-Twin-Verzeichnis mit ID ${shadowTwinFolderId} nicht gefunden oder kein Verzeichnis`);
    }
    
    for (const image of images) {
      try {
        // Extrahiere Base64-Daten aus Data URL (Format: data:image/jpeg;base64,...)
        let base64Data = image.image_base64;
        if (base64Data.startsWith('data:')) {
          // Entferne Data URL Prefix
          const commaIndex = base64Data.indexOf(',');
          if (commaIndex !== -1) {
            base64Data = base64Data.substring(commaIndex + 1);
          }
        }
        
        // Konvertiere Base64 zu Buffer
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Bestimme MIME-Type und Extension aus image.id oder Data URL
        let mimeType = 'image/jpeg';
        
        if (image.image_base64.startsWith('data:')) {
          const mimeMatch = image.image_base64.match(/data:image\/([^;]+)/);
          if (mimeMatch) {
            const mimePart = mimeMatch[1].toLowerCase();
            if (mimePart === 'png') {
              mimeType = 'image/png';
            } else if (mimePart === 'jpeg' || mimePart === 'jpg') {
              mimeType = 'image/jpeg';
            }
          }
        } else {
          // Versuche Extension aus image.id zu extrahieren
          const idExtension = image.id.split('.').pop()?.toLowerCase();
          if (idExtension === 'png') {
            mimeType = 'image/png';
          } else if (idExtension === 'jpg' || idExtension === 'jpeg') {
            mimeType = 'image/jpeg';
          }
        }
        
        // Verwende image.id als Dateinamen (z.B. "img-0.jpeg")
        const fileName = image.id;
        
        // Erstelle File-Objekt
        const blob = new Blob([buffer], { type: mimeType });
        const file = new File([blob], fileName, { type: mimeType });
        
        // Speichere im Shadow-Twin-Verzeichnis
        const savedItem = await provider.uploadFile(shadowTwinFolderId, file);
        savedItems.push(savedItem);
        
        FileLogger.info('ImageExtractionService', 'Mistral OCR Bild gespeichert', {
          fileName,
          fileSize: buffer.length,
          mimeType,
          savedItemId: savedItem.id
        });
      } catch (error) {
        FileLogger.error('ImageExtractionService', `Fehler beim Speichern von Mistral OCR Bild ${image.id}`, error);
        // Weitermachen mit nächstem Bild
      }
    }
    
    FileLogger.info('ImageExtractionService', 'Mistral OCR Bild-Speicherung abgeschlossen', {
      totalImages: images.length,
      savedItems: savedItems.length
    });
    
    return savedItems;
  }
  
  /**
   * Erstellt Markdown-Inhalt für ein Bild
   * @param imageFileName Name der Bilddatei
   * @param extractedText Der extrahierte Text aus der PDF
   * @param pdfFileName Name der ursprünglichen PDF-Datei
   * @param targetLanguage Die Zielsprache (optional)
   * @param pageNumber Die Seitennummer (optional)
   * @returns Markdown-Inhalt
   */
  private static createMarkdownContent(imageFileName: string, extractedText: string, pdfFileName: string, targetLanguage?: string, pageNumber?: number): string {
    const languageInfo = targetLanguage ? `**Sprache:** ${targetLanguage}` : '';
    const pageInfo = pageNumber ? `**Seite:** ${pageNumber}` : '';
    
    return `# ${imageFileName}

## Quelle
**PDF-Datei:** ${pdfFileName}
**Bild:** ${imageFileName}
${languageInfo}
${pageInfo}

## Extrahierter Text
${extractedText}

---
*Automatisch erstellt am ${new Date().toLocaleString('de-DE')}*
`;
  }

} 