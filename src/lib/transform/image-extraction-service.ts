import { StorageProvider, StorageItem } from "@/lib/storage/types";
import { FileLogger } from "@/lib/debug/logger";

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
    textContents?: Array<{ page: number; content: string }>
  ): Promise<ImageExtractionResult> {
    try {
      FileLogger.info('ImageExtractionService', 'Starte ZIP-Extraktion und Bild-Speicherung', {
        fileName,
        originalFile: originalItem.metadata.name,
        base64DataLength: base64ZipData.length
      });
      
      // Generiere Ordnername: .{pdf-name-ohne-extension}
      const folderName = this.generateImageFolderName(originalItem.metadata.name);
      
      // Erstelle den Ordner
      const folderItem = await provider.createFolder(originalItem.parentId, folderName);
      
      FileLogger.info('ImageExtractionService', 'Ordner erstellt', {
        folderId: folderItem.id,
        folderName: folderName
      });
      
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
        folderName,
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
   * Generiert den Ordnernamen für die Bilder
   * @param pdfFileName Name der PDF-Datei
   * @returns Ordnername im Format .{name-ohne-extension}
   */
  private static generateImageFolderName(pdfFileName: string): string {
    // Entferne die Dateiendung
    const nameWithoutExtension = pdfFileName.replace(/\.[^/.]+$/, '');
    return `.${nameWithoutExtension}`;
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