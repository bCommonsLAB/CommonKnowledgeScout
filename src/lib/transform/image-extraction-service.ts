import { StorageProvider, StorageItem } from "@/lib/storage/types";
import { FileLogger } from "@/lib/debug/logger";

/**
 * Interface für extrahierte Bilder mit zugehörigem Text
 */
export interface ExtractedPageImage {
  pageNumber: number;
  imageBlob: Blob;
  textContent: string;
  imageName: string; // z.B. "page_1.png"
  textName: string;  // z.B. "page_1.md"
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
   * @returns Ergebnis der Speicherung
   */
  static async saveZipArchive(
    base64ZipData: string,
    fileName: string,
    originalItem: StorageItem,
    provider: StorageProvider,
    refreshItems: (folderId: string) => Promise<StorageItem[]>
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
      
      // Speichere das ZIP-Archiv als Backup
      const zipBlob = new Blob([buffer], { type: 'application/zip' });
      const zipFile = new File([zipBlob], fileName, { type: 'application/zip' });
      const savedZipItem = await provider.uploadFile(folderItem.id, zipFile);
      savedItems.push(savedZipItem);
      
      FileLogger.info('ImageExtractionService', 'ZIP-Backup gespeichert', {
        zipFileName: fileName,
        zipSize: zipBlob.size
      });
      
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
            
            // Extrahiere den Dateinamen aus dem Pfad
            const fileName = filePath.split('/').pop() || filePath;
            
            FileLogger.debug('ImageExtractionService', 'Extrahiere Bild-Datei', {
              filePath,
              fileName,
              fileExtension,
              mimeType
            });
            
            // Bild-Blob extrahieren
            const imageBlob = await file.async('blob');
            
            FileLogger.debug('ImageExtractionService', 'Bild-Blob erstellt', {
              fileName,
              blobSize: imageBlob.size,
              blobType: imageBlob.type
            });
            
            // Bild-Datei erstellen und speichern
            const imageFile = new File([imageBlob], fileName, { type: mimeType });
            const savedImageItem = await provider.uploadFile(folderItem.id, imageFile);
            savedItems.push(savedImageItem);
            
            FileLogger.info('ImageExtractionService', `Bild extrahiert und gespeichert`, {
              fileName,
              fileSize: imageBlob.size,
              mimeType,
              savedItemId: savedImageItem.id
            });
            
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
      
      // Erstelle eine README-Datei
      const readmeContent = this.createReadmeContent(originalItem.metadata.name, fileName, processedFiles);
      const readmeBlob = new Blob([readmeContent], { type: 'text/markdown' });
      const readmeFile = new File([readmeBlob], 'README.md', { type: 'text/markdown' });
      const savedReadmeItem = await provider.uploadFile(folderItem.id, readmeFile);
      savedItems.push(savedReadmeItem);
      
      // Aktualisiere die Dateiliste des übergeordneten Ordners
      await refreshItems(originalItem.parentId);
      
      FileLogger.info('ImageExtractionService', 'ZIP-Extraktion vollständig abgeschlossen', {
        folderName,
        zipFileName: fileName,
        extractedFilesCount: processedFiles,
        totalSavedItems: savedItems.length,
        readmeCreated: true
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
   * Erstellt README-Inhalt für den Bilder-Ordner
   * @param pdfFileName Name der PDF-Datei
   * @param zipFileName Name der ZIP-Datei
   * @param extractedFilesCount Anzahl der extrahierten Dateien
   * @returns README-Inhalt
   */
  private static createReadmeContent(pdfFileName: string, zipFileName: string, extractedFilesCount: number): string {
    return `# PDF-Bilder Archiv

## Quelle
**PDF-Datei:** ${pdfFileName}

## Inhalt
Dieser Ordner enthält alle Seiten der PDF-Datei als Bilder.

**Archiv-Datei:** ${zipFileName} (Backup)
**Extrahierte Dateien:** ${extractedFilesCount} Bilder

## Dateistruktur
- \`page_001.png\`, \`page_002.png\`, etc. - Hauptbilder (300 DPI, PNG)
- \`preview_001.jpg\`, \`preview_002.jpg\`, etc. - Vorschaubilder (JPG)
- \`${zipFileName}\` - Original-ZIP-Archiv als Backup

## Verwendung
Die Bilder können für die Qualitätskontrolle der PDF-Textextraktion verwendet werden.
Vergleichen Sie den extrahierten Text mit den entsprechenden Bildern, um die Genauigkeit zu überprüfen.

## Qualitätskontrolle
- **Hauptbilder (PNG):** Hohe Auflösung für detaillierte Analyse
- **Vorschaubilder (JPG):** Komprimiert für schnelle Vorschau

---
*Automatisch erstellt am ${new Date().toLocaleString('de-DE')}*
`;
  }
} 