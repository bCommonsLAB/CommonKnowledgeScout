# Azure Storage Integration für Bilder - Übertragungsanleitung

Diese Dokumentation beschreibt die Azure Storage-Integration für Bilder in diesem Projekt und wie diese in ein anderes Projekt übertragen werden kann.

## Übersicht der involvierten Module

### 1. Core Service Module

#### `src/lib/services/azure-storage-service.ts`
Dies ist der zentrale Service für alle Azure Storage-Operationen. Er stellt folgende Funktionen bereit:

- **Upload von Bildern**: `uploadImage(filename: string, buffer: Buffer): Promise<string>`
- **URL-Generierung**: `getImageUrl(filename: string): string`
- **Bilder auflisten**: `getStoredImages(): Promise<Array<...>>`
- **Bilder löschen**: `deleteImage(imageUrl: string): Promise<boolean>`

#### `src/lib/config.ts`
Konfigurationsdatei, die die Azure Storage-Einstellungen aus Umgebungsvariablen lädt:

```typescript
STORAGE: {
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    uploadDir: process.env.UPLOAD_DIR || 'naturescout',
    type: 'azure',
    baseUrl: process.env.AZURE_STORAGE_CONNECTION_STRING 
        ? `https://${process.env.AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+)/)?.[1]}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER_NAME}`
        : '',
}
```

### 2. API Routes

#### `src/app/api/upload/route.ts`
Hauptroute für den Bild-Upload. Führt folgende Schritte aus:

1. Empfängt Bild über FormData
2. Verarbeitet Bild mit Sharp (Rotation, Resize, Optimierung)
3. Erstellt Low-Resolution-Version (max 360px)
4. Lädt beide Versionen in Azure Storage hoch
5. Gibt URLs zurück

#### `src/app/api/admin/images/rotate/route.ts`
Admin-Route zum Rotieren von Bildern in Azure Storage.

#### `src/app/api/admin/images/route.ts`
Admin-Route zum Auflisten aller Bilder in Azure Storage.

#### `src/app/api/admin/storage-cleanup/route.ts`
Admin-Route für Storage-Cleanup und Verwaltung.

### 3. Frontend-Komponenten

#### `src/components/ImageUpload.tsx`
Client-Komponente für direkten Upload (optional, verwendet SAS-Tokens).

## Abhängigkeiten

### NPM-Pakete

```json
{
  "@azure/storage-blob": "^12.25.0",
  "sharp": "^0.33.5"
}
```

### TypeScript-Typen

Für `sharp` sind keine zusätzlichen Types nötig (Paket enthält eigene Typen).

## Konfiguration

### Umgebungsvariablen

Folgende Umgebungsvariablen müssen gesetzt werden:

#### Erforderlich:

1. **`AZURE_STORAGE_CONNECTION_STRING`**
   - Format: `DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<key>;EndpointSuffix=core.windows.net`
   - Wo zu finden: Azure Portal → Storage Account → Access Keys → Connection String

2. **`AZURE_STORAGE_CONTAINER_NAME`**
   - Name des Blob-Containers (z.B. `biodiv`, `naturescout`)
   - Container muss in Azure Storage Account erstellt werden (Blob-Public-Zugriff sollte aktiviert sein)

#### Optional:

3. **`UPLOAD_DIR`**
   - Unterverzeichnis im Container für Bilder (Standard: `naturescout`)
   - Beispiel: Wenn `UPLOAD_DIR=naturescout`, werden Bilder unter `naturescout/1234567890.jpg` gespeichert

4. **`NEXT_PUBLIC_MAX_IMAGE_WIDTH`**
   - Maximale Bildbreite nach Verarbeitung (Standard: 2000)

5. **`NEXT_PUBLIC_MAX_IMAGE_HEIGHT`**
   - Maximale Bildhöhe nach Verarbeitung (Standard: 2000)

6. **`NEXT_PUBLIC_MAX_IMAGE_QUALITY`**
   - JPEG-Qualität 0-1 (Standard: 0.8)

### Azure Storage Account Setup

1. **Storage Account erstellen** im Azure Portal
2. **Container erstellen** mit öffentlichem Blob-Zugriff:
   - Container-Name festlegen (z.B. `biodiv`)
   - Access Level: **Blob** (öffentlicher Zugriff für einzelne Blobs)
3. **Connection String kopieren** aus Access Keys

## Schritt-für-Schritt Übertragung

### Schritt 1: Dependencies installieren

```bash
npm install @azure/storage-blob sharp
# oder
pnpm add @azure/storage-blob sharp
# oder
yarn add @azure/storage-blob sharp
```

### Schritt 2: Konfigurationsdatei erstellen/kopieren

Erstelle `src/lib/config.ts` (oder passe vorhandene an):

```typescript
// Server-side Konfiguration
export const serverConfig = {
    STORAGE: {
        containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || '',
        connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
        uploadDir: process.env.UPLOAD_DIR || 'uploads', // Dein Standard-Verzeichnis
        type: 'azure',
        baseUrl: process.env.AZURE_STORAGE_CONNECTION_STRING 
            ? `https://${process.env.AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+)/)?.[1]}.blob.core.windows.net/${process.env.AZURE_STORAGE_CONTAINER_NAME}`
            : '',
    }
};

// Validierung auf Server-Seite
if (typeof window === 'undefined') {
    if (!serverConfig.STORAGE.connectionString || 
         !serverConfig.STORAGE.containerName) {
        console.warn('Warnung: Azure Storage Konfiguration ist unvollständig');
    } 
}
```

### Schritt 3: Azure Storage Service erstellen/kopieren

Erstelle `src/lib/services/azure-storage-service.ts`:

```typescript
import { BlobServiceClient } from '@azure/storage-blob';
import { serverConfig } from '../config';

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient;
  private containerClient;
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    if (!serverConfig.STORAGE.connectionString) {
      throw new Error('Azure Storage connection string ist nicht konfiguriert');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(
      serverConfig.STORAGE.connectionString
    );
    
    this.containerClient = this.blobServiceClient.getContainerClient(
      serverConfig.STORAGE.containerName
    );
    
    this.uploadDir = serverConfig.STORAGE.uploadDir;
    this.baseUrl = serverConfig.STORAGE.baseUrl || '';
  }

  async uploadImage(filename: string, buffer: Buffer): Promise<string> {
    try {
      const blobName = `${this.uploadDir}/${filename}`;
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      
      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: 'image/jpeg',
          blobCacheControl: 'no-cache, no-store, must-revalidate'
        }
      });
      
      return `${this.baseUrl}/${blobName}`;
    } catch (error) {
      console.error('Fehler beim Upload des Bildes:', error);
      throw new Error(`Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  getImageUrl(filename: string): string {
    return `${this.baseUrl}/${this.uploadDir}/${filename}`;
  }

  async getStoredImages(): Promise<Array<{ url: string; filename: string; size: number; lastModified: string }>> {
    const images = [];
    const dirPrefix = `${this.uploadDir}/`;
    
    try {
      for await (const blob of this.containerClient.listBlobsFlat({ prefix: dirPrefix })) {
        const url = `${this.baseUrl}/${blob.name}`;
        const filename = blob.name.substring(dirPrefix.length);
        
        images.push({ 
          url, 
          filename,
          size: blob.properties.contentLength || 0,
          lastModified: blob.properties.lastModified?.toISOString() || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Fehler beim Abrufen der gespeicherten Bilder:', error);
    }
    
    return images;
  }

  async deleteImage(imageUrl: string): Promise<boolean> {
    try {
      const urlObj = new URL(imageUrl);
      const pathSegments = urlObj.pathname.split('/');
      
      const containerIndex = pathSegments.findIndex(segment => 
        segment === serverConfig.STORAGE.containerName);
      
      if (containerIndex === -1) {
        throw new Error(`Container ${serverConfig.STORAGE.containerName} nicht in URL gefunden`);
      }
      
      const blobPath = pathSegments.slice(containerIndex + 1).join('/');
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath);
      
      await blockBlobClient.delete();
      return true;
    } catch (error) {
      console.error(`Fehler beim Löschen des Bildes ${imageUrl}:`, error);
      return false;
    }
  }
}
```

### Schritt 4: Upload-Route erstellen/kopieren

Erstelle `src/app/api/upload/route.ts` (Next.js App Router):

```typescript
import { AzureStorageService } from '@/lib/services/azure-storage-service';
import sharp from 'sharp';
import { publicConfig } from '@/lib/config'; // Falls vorhanden

const { maxWidth = 2000, maxHeight = 2000, quality = 0.8 } = publicConfig?.imageSettings || {};
const LOW_RES_MAX_SIZE = 360;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    
    if (!file) {
      return new Response('Keine Datei gefunden', { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    try {
      // Bild-Metadaten ermitteln
      const metadata = await sharp(buffer).metadata();
      
      // EXIF-Orientierung korrigieren
      let sharpInstance = sharp(buffer, { failOnError: false }).rotate();
      const rotatedMetadata = await sharpInstance.metadata();
      const width = rotatedMetadata.width || 0;
      const height = rotatedMetadata.height || 0;
      
      // Berechne neue Dimensionen
      let newWidth = width;
      let newHeight = height;

      if (width > height) {
        if (width > maxWidth) {
          newHeight = Math.round((height * maxWidth) / width);
          newWidth = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          newWidth = Math.round((width * maxHeight) / height);
          newHeight = maxHeight;
        }
      }

      // Format bestimmen
      const outputFormat = (metadata.format === 'jpeg' || metadata.format === 'jpg') ? 'jpeg' : 
                          (metadata.format === 'png') ? 'png' : 'jpeg';
      
      // Bild optimieren
      let processedBuffer;
      if (outputFormat === 'jpeg') {
        processedBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(newWidth, newHeight)
          .jpeg({ quality: Math.round(quality * 100) })
          .toBuffer();
      } else if (outputFormat === 'png') {
        processedBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(newWidth, newHeight)
          .png({ quality: Math.round(quality * 100) })
          .toBuffer();
      } else {
        processedBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(newWidth, newHeight)
          .jpeg({ quality: Math.round(quality * 100) })
          .toBuffer();
      }

      // Low-Resolution Version erstellen
      let lowResWidth = width;
      let lowResHeight = height;
      
      if (width > height) {
        if (width > LOW_RES_MAX_SIZE) {
          lowResHeight = Math.round((height * LOW_RES_MAX_SIZE) / width);
          lowResWidth = LOW_RES_MAX_SIZE;
        }
      } else {
        if (height > LOW_RES_MAX_SIZE) {
          lowResWidth = Math.round((width * LOW_RES_MAX_SIZE) / height);
          lowResHeight = LOW_RES_MAX_SIZE;
        }
      }
      
      let lowResBuffer;
      if (outputFormat === 'jpeg') {
        lowResBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(lowResWidth, lowResHeight)
          .jpeg({ quality: Math.round(quality * 80) })
          .toBuffer();
      } else if (outputFormat === 'png') {
        lowResBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(lowResWidth, lowResHeight)
          .png({ quality: Math.round(quality * 80) })
          .toBuffer();
      } else {
        lowResBuffer = await sharp(buffer, { failOnError: false })
          .rotate()
          .resize(lowResWidth, lowResHeight)
          .jpeg({ quality: Math.round(quality * 80) })
          .toBuffer();
      }

      // In Azure Storage hochladen
      const timestamp = Date.now();
      const extension = outputFormat === 'png' ? 'png' : 'jpg';
      const filename = `${timestamp}.${extension}`;
      const lowResFilename = `${timestamp}_low.${extension}`;

      const azureStorage = new AzureStorageService();
      const url = await azureStorage.uploadImage(filename, processedBuffer);
      const lowResUrl = await azureStorage.uploadImage(lowResFilename, lowResBuffer);

      return Response.json({ 
        filename,
        url,
        lowResFilename,
        lowResUrl,
        success: true 
      });
    } catch (imageError: unknown) {
      console.error('Fehler bei der Bildverarbeitung:', imageError);
      
      // Fallback: Upload ohne Verarbeitung
      try {
        const timestamp = Date.now();
        const filename = `${timestamp}_original.jpg`;
        
        const azureStorage = new AzureStorageService();
        const url = await azureStorage.uploadImage(filename, buffer);
        
        return Response.json({ 
          filename,
          url,
          success: true,
          message: 'Bild ohne Optimierung hochgeladen aufgrund eines Verarbeitungsfehlers'
        });
      } catch (uploadError: unknown) {
        throw new Error(`Bildverarbeitung fehlgeschlagen: ${imageError instanceof Error ? imageError.message : 'Unbekannter Fehler'}`);
      }
    }
  } catch (error) {
    console.error('Fehler beim Upload:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unbekannter Fehler beim Upload'
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

### Schritt 5: Umgebungsvariablen konfigurieren

Erstelle `.env.local` (oder `.env` für Produktion):

```env
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=<dein-account>;AccountKey=<dein-key>;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=<dein-container-name>
UPLOAD_DIR=uploads
NEXT_PUBLIC_MAX_IMAGE_WIDTH=2000
NEXT_PUBLIC_MAX_IMAGE_HEIGHT=2000
NEXT_PUBLIC_MAX_IMAGE_QUALITY=0.8
```

### Schritt 6: Frontend-Integration

Beispiel für Upload im Frontend:

```typescript
async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log('Hochgeladen:', result.url);
    console.log('Low-Res:', result.lowResUrl);
    return result;
  } else {
    throw new Error(result.error || 'Upload fehlgeschlagen');
  }
}
```

## Wichtige Hinweise

### Sicherheit

1. **Connection String niemals im Client-Code verwenden**
   - Nur in Server-seitigen Komponenten/Routes verwenden
   - Keine Environment-Variablen mit `NEXT_PUBLIC_` Präfix für Connection Strings

2. **Container-Zugriff**
   - Container sollte auf "Blob" (öffentlich) gesetzt sein für direkten Zugriff auf Bilder
   - Oder SAS-Tokens verwenden für zeitlich begrenzten Zugriff

3. **Validierung**
   - Upload-Route sollte Authentifizierung/Authorization prüfen
   - Dateitypen validieren (nur Bilder erlauben)
   - Dateigröße begrenzen

### Performance

1. **Bildoptimierung**
   - Sharp wird verwendet für automatische Rotation, Resize und Kompression
   - Low-Resolution-Versionen werden automatisch erstellt für schnellere Ladezeiten

2. **Cache-Control**
   - Aktuell: `no-cache, no-store, must-revalidate` (für Development)
   - Für Produktion: Anpassen je nach Anforderung

### Fehlerbehandlung

- Der Service wirft Fehler, die in den API-Routes gefangen werden sollten
- Fallback-Mechanismus: Falls Bildverarbeitung fehlschlägt, wird Original hochgeladen

## Testing

### Lokales Testen

1. Azure Storage Account erstellen
2. Container erstellen mit öffentlichem Zugriff
3. Connection String kopieren
4. Umgebungsvariablen setzen
5. Upload-Route testen:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "image=@/path/to/test-image.jpg"
```

## Troubleshooting

### Häufige Probleme

1. **"Azure Storage connection string ist nicht konfiguriert"**
   - Prüfe: `AZURE_STORAGE_CONNECTION_STRING` gesetzt?
   - Prüfe: `.env.local` geladen? (Next.js lädt automatisch)

2. **"Container nicht gefunden"**
   - Container muss in Azure Portal erstellt werden
   - Container-Name muss exakt übereinstimmen

3. **"Upload fehlgeschlagen: 403 Forbidden"**
   - Prüfe: Connection String korrekt?
   - Prüfe: Container-Zugriff auf "Blob" gesetzt?

4. **Sharp-Fehler**
   - Sharp benötigt native Dependencies
   - Bei Docker: Sicherstellen, dass Sharp-binary installiert ist
   - Bei Windows: Möglicherweise Build-Tools erforderlich

## Erweiterte Funktionen

### Admin-Routes

Für Admin-Funktionen können folgende Routes übertragen werden:

- `src/app/api/admin/images/route.ts` - Bilder auflisten
- `src/app/api/admin/images/rotate/route.ts` - Bilder rotieren
- `src/app/api/admin/storage-cleanup/route.ts` - Storage-Cleanup

Diese sind optional und sollten entsprechend angepasst werden.

## Zusammenfassung

Die Azure Storage-Integration besteht aus:

1. **Core Service**: `AzureStorageService` für alle Storage-Operationen
2. **Konfiguration**: `serverConfig.STORAGE` aus Umgebungsvariablen
3. **Upload-Route**: `/api/upload` für Bild-Upload mit Verarbeitung
4. **Dependencies**: `@azure/storage-blob` und `sharp`

Die Hauptfunktionalität ist unabhängig vom Rest der Anwendung und kann einfach übertragen werden.

