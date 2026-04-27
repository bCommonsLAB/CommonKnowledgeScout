import { atom } from 'jotai'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'
import { TARGET_LANGUAGE_DEFAULT } from '@/lib/chat/constants'
import type { TargetLanguage } from '@/lib/chat/constants'

/**
 * Runtime-Overrides für PDF-Standardwerte pro Library (nicht persistent).
 * Lebensdauer: bis zum Reload. Vorrang vor DB-Defaults in der UI.
 */
export type PdfRuntimeOverrides = Partial<PdfTransformOptions>;

// Map: libraryId -> Overrides
export const pdfOverridesAtom = atom<Record<string, PdfRuntimeOverrides>>({})

/**
 * Globaler Default für extractionMethod: mistral_ocr (wenn nichts gesetzt ist).
 * WICHTIG: Dieser Default gilt für alle PDF-Flows, wenn keine explizite Auswahl getroffen wurde.
 */
const GLOBAL_DEFAULT_EXTRACTION_METHOD: PdfTransformOptions['extractionMethod'] = 'mistral_ocr'

/**
 * Erzwingt Mistral-spezifische Defaults für Bild-Extraktion.
 * Wenn extractionMethod === 'mistral_ocr':
 *  - includePreviewPages standardmaessig true (Low-Res Thumbnails fuer UI)
 *  - includeHighResPages standardmaessig true (200 DPI fuer Weiterverarbeitung,
 *    z.B. Split-Pages-Funktion)
 *  - includeOcrImages standardmaessig true (von Mistral erkannte eingebettete Bilder)
 * Alle drei Flags koennen explizit ueberschrieben werden.
 */
function applyMistralDefaults(options: Partial<PdfTransformOptions>): Partial<PdfTransformOptions> {
  const extractionMethod = options.extractionMethod || GLOBAL_DEFAULT_EXTRACTION_METHOD
  const isMistralOcr = extractionMethod === 'mistral_ocr'

  return {
    ...options,
    extractionMethod,
    // Vorschau-Bilder: bei Mistral standardmaessig true, sonst durchreichen
    includePreviewPages: isMistralOcr
      ? (options.includePreviewPages !== undefined ? options.includePreviewPages : true)
      : options.includePreviewPages,
    // HighRes-Bilder: bei Mistral standardmaessig true, sonst durchreichen.
    // Diese sind die Quelle fuer die Split-Pages-Funktion.
    includeHighResPages: isMistralOcr
      ? (options.includeHighResPages !== undefined ? options.includeHighResPages : true)
      : options.includeHighResPages,
    // OCR-Bilder (eingebettete Bilder aus dem PDF): bei Mistral standardmaessig true
    includeOcrImages: isMistralOcr
      ? (options.includeOcrImages !== undefined ? options.includeOcrImages : true)
      : options.includeOcrImages,
  }
}

/**
 * Bestimmt die effektive targetLanguage basierend auf Priorität:
 * 1. dbDefaults.targetLanguage (localStorage)
 * 2. libraryConfigChatTargetLanguage (config.chat.targetLanguage)
 * 3. TARGET_LANGUAGE_DEFAULT ('en')
 */
function getEffectiveTargetLanguage(
  dbTargetLanguage: string | undefined,
  libraryConfigChatTargetLanguage: TargetLanguage | undefined
): string {
  // Priorität 1: localStorage-Defaults
  if (dbTargetLanguage) {
    return dbTargetLanguage
  }
  // Priorität 2: Library-Config (config.chat.targetLanguage)
  if (libraryConfigChatTargetLanguage) {
    return libraryConfigChatTargetLanguage
  }
  // Priorität 3: Globaler Default
  return TARGET_LANGUAGE_DEFAULT
}

/**
 * Bestimmt das effektive Template basierend auf Priorität:
 * 1. dbDefaults.template (localStorage)
 * 2. libraryConfigPdfTemplate (config.secretaryService.template)
 */
function getEffectiveTemplate(
  dbTemplate: string | undefined,
  libraryConfigPdfTemplate: string | undefined
): string | undefined {
  if (dbTemplate) return dbTemplate
  if (libraryConfigPdfTemplate) return libraryConfigPdfTemplate
  return undefined
}

export function getEffectivePdfDefaults(
  libraryId: string | undefined,
  dbDefaults: Partial<PdfTransformOptions> | undefined,
  overridesMap: Record<string, PdfRuntimeOverrides>,
  libraryConfigChatTargetLanguage?: TargetLanguage,
  libraryConfigPdfTemplate?: string
): Partial<PdfTransformOptions> {
  if (!libraryId) {
    const merged = { 
      ...(dbDefaults || {}),
      // Verwende Library-Config targetLanguage, wenn dbDefaults.targetLanguage nicht gesetzt ist
      targetLanguage: getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage),
      template: getEffectiveTemplate(dbDefaults?.template, libraryConfigPdfTemplate),
    }
    return applyMistralDefaults(merged)
  }
  const ov = overridesMap[libraryId] || {}
  const merged = { 
    ...(dbDefaults || {}), 
    ...ov,
    // Verwende Library-Config targetLanguage, wenn weder dbDefaults noch overrides targetLanguage setzen
    targetLanguage: ov.targetLanguage ?? getEffectiveTargetLanguage(dbDefaults?.targetLanguage, libraryConfigChatTargetLanguage),
    template: ov.template ?? getEffectiveTemplate(dbDefaults?.template, libraryConfigPdfTemplate),
  }
  return applyMistralDefaults(merged)
}


