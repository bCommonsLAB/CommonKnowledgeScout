/**
 * Pure Helper fuer den Image-Processor.
 *
 * Diese Funktionen sind seiteneffekt-frei und deterministisch (siehe
 * `.cursor/rules/ingestion-contracts.mdc` §1). Sie wurden in Welle 3
 * (Schritt 4) aus `image-processor.ts` extrahiert, damit sie isoliert
 * testbar sind und die `ImageProcessor`-Klasse schlanker wird.
 *
 * Bewusst NICHT extrahiert: `uploadImageWithDeduplication`,
 * `ensureAzureStorage`, `ensureContainer` — diese sind nicht-pure
 * (Azure-/Logger-/Cache-Aufrufe) und gehoeren weiter in die Klasse.
 */

/**
 * Erzeugt den Cache-Schluessel fuer Bild-Deduplizierung.
 * Format: `${libraryId}:${scope}:${hash}:${extension}`
 */
export function getImageCacheKey(
  libraryId: string,
  scope: 'books' | 'sessions',
  hash: string,
  extension: string
): string {
  return `${libraryId}:${scope}:${hash}:${extension}`
}

/**
 * Normalisiert einen relativen Bildpfad und prueft auf Path-Traversal.
 * Entfernt fuehrende und nachgestellte Slashes; lehnt `..` als
 * Sicherheitsverletzung ab.
 */
export function normalizeImagePath(
  imagePath: string
): { success: boolean; path?: string; error?: string } {
  const normalizedPath = imagePath.replace(/^\/+|\/+$/g, '')
  if (normalizedPath.includes('..')) {
    return { success: false, error: '[Schritt: Bild-Pfad Validierung] Path traversal erkannt' }
  }
  return { success: true, path: normalizedPath }
}

/**
 * Wandelt eine technische Fehlermeldung aus dem Bild-Upload in eine
 * benutzerfreundliche Form mit Phasen-Praefix `[Schritt: Bild-Upload]`.
 */
export function formatImageError(errorMessage: string, imagePath: string): string {
  if (errorMessage.includes('not found') || errorMessage.includes('nicht gefunden')) {
    return `[Schritt: Bild-Upload] Bild nicht gefunden: ${imagePath}`
  }
  if (errorMessage.includes('does not exist')) {
    return `[Schritt: Bild-Upload] Bild-Datei existiert nicht: ${imagePath}`
  }
  if (errorMessage.includes('Upload fehlgeschlagen')) {
    return `[Schritt: Bild-Upload] Upload fehlgeschlagen für ${imagePath}: ${errorMessage.replace('Upload fehlgeschlagen: ', '')}`
  }
  return `[Schritt: Bild-Upload] ${errorMessage}`
}
