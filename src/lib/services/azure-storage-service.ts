import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { getAzureStorageConfig } from '@/lib/config/azure-storage'
import { FileLogger } from '@/lib/debug/logger'
import crypto from 'crypto'
import * as fs from 'fs'

/**
 * Sanitized Library-ID für Azure Storage-Unterordner
 * Konvertiert Library-ID zu Azure-kompatiblem Ordnernamen
 */
export function sanitizeLibraryId(libraryId: string): string {
  // Nur erlaubte Zeichen: a-z, 0-9, Bindestriche (-)
  // Unterstriche werden zu Bindestrichen konvertiert
  // Sonderzeichen werden entfernt
  // Lowercase
  return libraryId
    .toLowerCase()
    .replace(/_/g, '-') // Unterstriche zu Bindestrichen
    .replace(/[^a-z0-9-]/g, '') // Entferne ungültige Zeichen
    .replace(/-+/g, '-') // Mehrfache Bindestriche zu einem
    .replace(/^-+|-+$/g, '') // Entferne führende/trailing Bindestriche
    .slice(0, 63) // Azure Container Name Limit (auch für Unterordner)
}

/**
 * Berechnet SHA-256 Hash eines Buffers
 * Gibt ersten 16 Zeichen des Hex-Hash zurück (für Dateinamen)
 */
export function calculateImageHash(buffer: Buffer): string {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  return hash.slice(0, 16) // Erste 16 Zeichen für Dateinamen
}

/**
 * Azure Storage Service für Bild-Uploads
 * Unterstützt Hash-basierte Deduplizierung und Library-spezifische Unterordner
 */
export class AzureStorageService {
  private blobServiceClient: BlobServiceClient | null = null
  private config: ReturnType<typeof getAzureStorageConfig> = null

  constructor() {
    this.config = getAzureStorageConfig()
    if (!this.config) {
      FileLogger.warn('AzureStorageService', 'Azure Storage nicht konfiguriert')
      return
    }

    try {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        this.config.connectionString
      )
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Initialisieren', error)
      this.blobServiceClient = null
    }
  }

  /**
   * Prüft ob Azure Storage konfiguriert ist
   */
  isConfigured(): boolean {
    return this.config !== null && this.blobServiceClient !== null
  }

  /**
   * Prüft ob ein Container existiert
   * @param containerName Name des Containers
   * @returns true wenn Container existiert, false wenn nicht
   */
  async containerExists(containerName: string): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) return false

      const exists = await containerClient.exists()
      return exists
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Prüfen ob Container existiert', error)
      return false
    }
  }

  /**
   * Gibt Container Client für einen Container zurück
   */
  private getContainerClient(containerName: string): ContainerClient | null {
    if (!this.blobServiceClient) return null
    return this.blobServiceClient.getContainerClient(containerName)
  }

  /**
   * Generiert Blob-Pfad für ein Bild (alte Struktur für Rückwärtskompatibilität)
   */
  private getBlobPath(libraryId: string, hash: string, extension: string): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const sanitizedLibraryId = sanitizeLibraryId(libraryId)
    const filename = `${hash}.${extension}`
    return `${sanitizedLibraryId}/${this.config.uploadDir}/${filename}`
  }

  /**
   * Generiert Blob-Pfad für ein Bild mit Scope (books/sessions) und ownerId (fileId)
   * Neue Struktur: {libraryId}/{scope}/{ownerId}/{hash}.{extension}
   * 
   * WICHTIG: uploadDir wird NICHT verwendet, da der Scope bereits die Unterscheidung macht.
   * Der Scope ersetzt uploadDir für die neue Struktur.
   */
  private getBlobPathWithScope(
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string
  ): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const sanitizedLibraryId = sanitizeLibraryId(libraryId)
    const sanitizedOwnerId = sanitizeLibraryId(ownerId) // Verwende sanitizeLibraryId auch für ownerId
    const filename = `${hash}.${extension}`
    // Struktur: {libraryId}/{scope}/{ownerId}/{hash}.{extension}
    // Scope ersetzt uploadDir für die neue Struktur
    return `${sanitizedLibraryId}/${scope}/${sanitizedOwnerId}/${filename}`
  }

  /**
   * Generiert öffentliche Azure Blob URL
   */
  getImageUrl(containerName: string, libraryId: string, hash: string, extension: string): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const blobPath = this.getBlobPath(libraryId, hash, extension)
    return `${this.config.baseUrl}/${blobPath}`
  }

  /**
   * Prüft ob ein Bild mit gegebenem Hash bereits existiert
   */
  async imageExists(
    containerName: string,
    libraryId: string,
    hash: string,
    extension: string
  ): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) return false

      const blobPath = this.getBlobPath(libraryId, hash, extension)
      const blobClient = containerClient.getBlockBlobClient(blobPath)

      const exists = await blobClient.exists()
      return exists
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Prüfen ob Bild existiert', error)
      return false
    }
  }

  /**
   * Gibt URL für existierendes Bild zurück (falls vorhanden)
   */
  async getImageUrlByHash(
    containerName: string,
    libraryId: string,
    hash: string,
    extension: string
  ): Promise<string | null> {
    if (!this.isConfigured()) return null

    const exists = await this.imageExists(containerName, libraryId, hash, extension)
    if (exists) {
      return this.getImageUrl(containerName, libraryId, hash, extension)
    }
    return null
  }

  /**
   * Lädt ein Bild auf Azure Storage hoch
   * @param containerName Container Name
   * @param libraryId Library ID (wird sanitized für Unterordner)
   * @param hash Hash des Bildes (für Dateinamen)
   * @param extension Dateiendung (z.B. 'jpg', 'png')
   * @param buffer Bild-Daten als Buffer
   * @returns Öffentliche Azure Blob URL
   */
  async uploadImage(
    containerName: string,
    libraryId: string,
    hash: string,
    extension: string,
    buffer: Buffer
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage nicht konfiguriert')
    }

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) {
        throw new Error('Container Client konnte nicht erstellt werden')
      }

      const blobPath = this.getBlobPath(libraryId, hash, extension)
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath)

      // MIME-Type basierend auf Extension bestimmen
      const contentType = this.getContentType(extension)

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=31536000', // 1 Jahr Cache für statische Bilder
        },
      })

      const url = this.getImageUrl(containerName, libraryId, hash, extension)
      FileLogger.info('AzureStorageService', 'Bild hochgeladen', {
        libraryId,
        hash,
        extension,
        blobPath,
        url,
      })

      return url
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Upload des Bildes', error)
      throw new Error(
        `Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      )
    }
  }

  /**
   * Generiert öffentliche Azure Blob URL mit Scope
   */
  getImageUrlWithScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string
  ): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const blobPath = this.getBlobPathWithScope(libraryId, scope, ownerId, hash, extension)
    return `${this.config.baseUrl}/${blobPath}`
  }

  /**
   * Prüft ob ein Bild mit Scope bereits existiert
   */
  async imageExistsWithScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string
  ): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) return false

      const blobPath = this.getBlobPathWithScope(libraryId, scope, ownerId, hash, extension)
      const blobClient = containerClient.getBlockBlobClient(blobPath)

      const exists = await blobClient.exists()
      return exists
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Prüfen ob Bild existiert', error)
      return false
    }
  }

  /**
   * Gibt URL für existierendes Bild mit Scope zurück (falls vorhanden)
   */
  async getImageUrlByHashWithScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string
  ): Promise<string | null> {
    if (!this.isConfigured()) return null

    const exists = await this.imageExistsWithScope(containerName, libraryId, scope, ownerId, hash, extension)
    if (exists) {
      return this.getImageUrlWithScope(containerName, libraryId, scope, ownerId, hash, extension)
    }
    return null
  }

  /**
   * Lädt ein Bild auf Azure Storage hoch mit Scope-Struktur
   * @param containerName Container Name
   * @param libraryId Library ID
   * @param scope 'books' oder 'sessions'
   * @param ownerId fileId oder sessionId
   * @param hash Hash des Bildes
   * @param extension Dateiendung
   * @param buffer Bild-Daten als Buffer
   * @returns Öffentliche Azure Blob URL
   */
  async uploadImageToScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    hash: string,
    extension: string,
    buffer: Buffer
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage nicht konfiguriert')
    }

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) {
        throw new Error('Container Client konnte nicht erstellt werden')
      }

      const blobPath = this.getBlobPathWithScope(libraryId, scope, ownerId, hash, extension)
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath)

      // MIME-Type basierend auf Extension bestimmen
      const contentType = this.getContentType(extension)

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=31536000', // 1 Jahr Cache für statische Bilder
        },
      })

      const url = this.getImageUrlWithScope(containerName, libraryId, scope, ownerId, hash, extension)
      FileLogger.info('AzureStorageService', 'Bild hochgeladen (mit Scope)', {
        libraryId,
        scope,
        ownerId,
        hash,
        extension,
        blobPath,
        url,
      })

      return url
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Upload des Bildes', error)
      throw new Error(
        `Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      )
    }
  }

  /**
   * Löscht alle Bilder für einen Owner (z.B. alle Bilder eines Buchs)
   * @param containerName Container Name
   * @param libraryId Library ID
   * @param scope 'books' oder 'sessions'
   * @param ownerId fileId oder sessionId
   */
  async deleteImagesForOwner(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage nicht konfiguriert')
    }

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) {
        throw new Error('Container Client konnte nicht erstellt werden')
      }

      const sanitizedLibraryId = sanitizeLibraryId(libraryId)
      const sanitizedOwnerId = sanitizeLibraryId(ownerId)
      // Struktur: {libraryId}/{scope}/{ownerId}/ (ohne uploadDir)
      const prefix = `${sanitizedLibraryId}/${scope}/${sanitizedOwnerId}/`

      FileLogger.info('AzureStorageService', 'Lösche Bilder für Owner', {
        libraryId,
        scope,
        ownerId,
        prefix,
      })

      // Liste alle Blobs mit diesem Prefix
      let deletedCount = 0
      for await (const blob of containerClient.listBlobsFlat({ prefix })) {
        const blobClient = containerClient.getBlockBlobClient(blob.name)
        await blobClient.delete()
        deletedCount++
      }

      FileLogger.info('AzureStorageService', 'Bilder gelöscht', {
        libraryId,
        scope,
        ownerId,
        deletedCount,
      })
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Löschen der Bilder', error)
      throw new Error(
        `Löschung fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      )
    }
  }

  /**
   * Generiert Blob-Pfad für ein PDF mit Scope (books/sessions) und ownerId (fileId)
   * Struktur: {libraryId}/{scope}/{ownerId}/{originalFilename}
   * 
   * WICHTIG: Verwendet Original-Dateinamen (sanitized), nicht Hash-basiert wie Bilder.
   */
  private getPdfBlobPathWithScope(
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    originalFileName: string
  ): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const sanitizedLibraryId = sanitizeLibraryId(libraryId)
    const sanitizedOwnerId = sanitizeLibraryId(ownerId)
    
    // Sanitize Dateiname: entferne ungültige Zeichen, behalte Erweiterung
    const sanitizedFileName = originalFileName
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Ersetze ungültige Zeichen durch Unterstrich
      .replace(/_{2,}/g, '_') // Mehrfache Unterstriche zu einem
      .replace(/^_+|_+$/g, '') // Entferne führende/trailing Unterstriche
    
    // Struktur: {libraryId}/{scope}/{ownerId}/{originalFilename}
    return `${sanitizedLibraryId}/${scope}/${sanitizedOwnerId}/${sanitizedFileName}`
  }

  /**
   * Generiert öffentliche Azure Blob URL für PDF mit Scope
   */
  getPdfUrlWithScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    originalFileName: string
  ): string {
    if (!this.config) throw new Error('Azure Storage nicht konfiguriert')
    const blobPath = this.getPdfBlobPathWithScope(libraryId, scope, ownerId, originalFileName)
    return `${this.config.baseUrl}/${blobPath}`
  }

  /**
   * Prüft ob ein PDF bereits existiert
   */
  async pdfExistsWithScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    originalFileName: string
  ): Promise<boolean> {
    if (!this.isConfigured()) return false

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) return false

      const blobPath = this.getPdfBlobPathWithScope(libraryId, scope, ownerId, originalFileName)
      const blobClient = containerClient.getBlockBlobClient(blobPath)

      const exists = await blobClient.exists()
      return exists
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Prüfen ob PDF existiert', error)
      return false
    }
  }

  /**
   * Lädt ein PDF auf Azure Storage hoch mit Scope-Struktur (Streaming-Variante)
   * Verwendet uploadStream für große Dateien, um Speicher zu sparen
   * @param containerName Container Name
   * @param libraryId Library ID
   * @param scope 'books' oder 'sessions'
   * @param ownerId fileId oder sessionId
   * @param originalFileName Original-Dateiname des PDFs (z.B. "Habermann_Economy.pdf")
   * @param filePath Absoluter Dateipfad zum PDF (für Streaming)
   * @returns Öffentliche Azure Blob URL
   */
  async uploadPdfToScopeFromFile(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    originalFileName: string,
    filePath: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage nicht konfiguriert')
    }

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) {
        throw new Error('Container Client konnte nicht erstellt werden')
      }

      const blobPath = this.getPdfBlobPathWithScope(libraryId, scope, ownerId, originalFileName)
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath)

      // PDF Content-Type
      const contentType = 'application/pdf'

      // Erstelle Readable Stream vom Dateisystem
      const fileStream = fs.createReadStream(filePath)

      // Upload via Stream (speicher-effizient für große Dateien)
      await blockBlobClient.uploadStream(fileStream, undefined, undefined, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=31536000', // 1 Jahr Cache
        },
      })

      const url = this.getPdfUrlWithScope(containerName, libraryId, scope, ownerId, originalFileName)
      FileLogger.info('AzureStorageService', 'PDF hochgeladen (mit Scope, via Stream)', {
        libraryId,
        scope,
        ownerId,
        originalFileName,
        filePath,
        blobPath,
        url,
      })

      return url
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Upload des PDFs (Stream)', error)
      throw new Error(
        `PDF-Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      )
    }
  }

  /**
   * Lädt ein PDF auf Azure Storage hoch mit Scope-Struktur (Buffer-Variante)
   * Fallback für Provider, die keinen direkten Dateipfad liefern können
   * @param containerName Container Name
   * @param libraryId Library ID
   * @param scope 'books' oder 'sessions'
   * @param ownerId fileId oder sessionId
   * @param originalFileName Original-Dateiname des PDFs (z.B. "Habermann_Economy.pdf")
   * @param buffer PDF-Daten als Buffer
   * @returns Öffentliche Azure Blob URL
   */
  async uploadPdfToScope(
    containerName: string,
    libraryId: string,
    scope: 'books' | 'sessions',
    ownerId: string,
    originalFileName: string,
    buffer: Buffer
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Azure Storage nicht konfiguriert')
    }

    try {
      const containerClient = this.getContainerClient(containerName)
      if (!containerClient) {
        throw new Error('Container Client konnte nicht erstellt werden')
      }

      const blobPath = this.getPdfBlobPathWithScope(libraryId, scope, ownerId, originalFileName)
      const blockBlobClient = containerClient.getBlockBlobClient(blobPath)

      // PDF Content-Type
      const contentType = 'application/pdf'

      await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: {
          blobContentType: contentType,
          blobCacheControl: 'public, max-age=31536000', // 1 Jahr Cache
        },
      })

      const url = this.getPdfUrlWithScope(containerName, libraryId, scope, ownerId, originalFileName)
      FileLogger.info('AzureStorageService', 'PDF hochgeladen (mit Scope)', {
        libraryId,
        scope,
        ownerId,
        originalFileName,
        blobPath,
        url,
        bufferSize: buffer.length,
      })

      return url
    } catch (error) {
      FileLogger.error('AzureStorageService', 'Fehler beim Upload des PDFs', error)
      throw new Error(
        `PDF-Upload fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      )
    }
  }

  /**
   * Bestimmt Content-Type basierend auf Dateiendung
   */
  private getContentType(extension: string): string {
    const ext = extension.toLowerCase()
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    }
    return contentTypes[ext] || 'image/jpeg'
  }
}

