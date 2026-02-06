/**
 * @fileoverview Thumbnail-Generator Utility
 * 
 * @description
 * Zentrale Utility für die Generierung von Thumbnails aus Bildern.
 * Verwendet sharp für performante Server-seitige Bildverarbeitung.
 * 
 * @module image
 */

import sharp from 'sharp'

/**
 * Zentrale Thumbnail-Konfiguration
 * 
 * 640px gewählt für optimale Schärfe auf HD-Displays:
 * - Deckt 2x Retina-Displays vollständig ab
 * - Deckt 3x Displays bei 2-Spalten-Layout ab
 * - Guter Kompromiss zwischen Qualität und Dateigröße (~40KB WebP)
 */
export const THUMBNAIL_SIZE = 640
export const THUMBNAIL_FORMAT: 'webp' | 'jpeg' = 'webp'
export const THUMBNAIL_QUALITY = 80

/**
 * Ergebnis der Thumbnail-Generierung
 */
export interface ThumbnailResult {
  /** Buffer mit dem generierten Thumbnail */
  buffer: Buffer
  /** Breite des Thumbnails in Pixel */
  width: number
  /** Höhe des Thumbnails in Pixel */
  height: number
  /** Format des Thumbnails */
  format: 'webp' | 'jpeg'
  /** Größe in Bytes */
  size: number
}

/**
 * Optionen für die Thumbnail-Generierung
 */
export interface ThumbnailOptions {
  /** Zielgröße in Pixel (Quadrat, Standard: 320) */
  size?: number
  /** Ausgabeformat (Standard: webp für beste Kompression) */
  format?: 'webp' | 'jpeg'
  /** Qualität 1-100 (Standard: 80) */
  quality?: number
}

/**
 * Standard-Optionen für Thumbnails (verwendet zentrale Konstanten)
 */
const DEFAULT_OPTIONS: Required<ThumbnailOptions> = {
  size: THUMBNAIL_SIZE,
  format: THUMBNAIL_FORMAT,
  quality: THUMBNAIL_QUALITY,
}

/**
 * Generiert ein Thumbnail aus einem Bild-Buffer.
 * 
 * Das Bild wird auf die Zielgröße zugeschnitten (cover/center),
 * sodass das Seitenverhältnis erhalten bleibt und das Bild den
 * gesamten Zielbereich ausfüllt.
 * 
 * @param imageBuffer - Buffer mit dem Original-Bild (PNG, JPEG, WebP, etc.)
 * @param options - Optionen für die Thumbnail-Generierung
 * @returns Promise mit dem generierten Thumbnail
 * 
 * @example
 * ```ts
 * const originalBuffer = await file.arrayBuffer()
 * const thumbnail = await generateThumbnail(Buffer.from(originalBuffer))
 * console.log(`Thumbnail: ${thumbnail.width}x${thumbnail.height}, ${thumbnail.size} bytes`)
 * ```
 */
export async function generateThumbnail(
  imageBuffer: Buffer,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  // Sharp-Pipeline für Thumbnail-Generierung
  const pipeline = sharp(imageBuffer)
    // Resize mit cover-Modus (füllt den Zielbereich, schneidet überstehende Bereiche ab)
    .resize(opts.size, opts.size, {
      fit: 'cover',
      position: 'centre', // Zentriert das Bild
      withoutEnlargement: false, // Auch kleine Bilder vergrößern
    })
  
  // Format-spezifische Optionen
  if (opts.format === 'webp') {
    pipeline.webp({ quality: opts.quality })
  } else {
    pipeline.jpeg({ quality: opts.quality, mozjpeg: true })
  }
  
  // Generierung mit Metadaten
  const result = await pipeline.toBuffer({ resolveWithObject: true })
  
  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    format: opts.format,
    size: result.data.length,
  }
}

/**
 * Prüft ob eine Datei ein unterstütztes Bildformat ist
 * 
 * @param file - File-Objekt oder MIME-Type String
 * @returns true wenn das Format für Thumbnail-Generierung unterstützt wird
 */
export function isSupportedImageFormat(file: File | string): boolean {
  const mimeType = typeof file === 'string' ? file : file.type
  
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'image/tiff',
  ]
  
  return supportedTypes.includes(mimeType.toLowerCase())
}

/**
 * Generiert einen Thumbnail-Dateinamen basierend auf dem Original
 * 
 * @param originalName - Name der Original-Datei
 * @param format - Zielformat (Standard: webp)
 * @returns Thumbnail-Dateiname (z.B. "thumb_cover_image.webp")
 */
export function generateThumbnailFileName(
  originalName: string,
  format: 'webp' | 'jpeg' = 'webp'
): string {
  // Entferne Dateiendung
  const baseName = originalName.replace(/\.[^.]+$/, '')
  const extension = format === 'webp' ? 'webp' : 'jpg'
  
  return `thumb_${baseName}.${extension}`
}
