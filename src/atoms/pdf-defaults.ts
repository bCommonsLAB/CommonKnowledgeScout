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
 * Wenn extractionMethod === 'mistral_ocr', dann sind includePageImages und includeOcrImages standardmäßig true.
 */
function applyMistralDefaults(options: Partial<PdfTransformOptions>): Partial<PdfTransformOptions> {
  const extractionMethod = options.extractionMethod || GLOBAL_DEFAULT_EXTRACTION_METHOD
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  return {
    ...options,
    extractionMethod,
    // Bei Mistral OCR: includePageImages immer true (erzwungen)
    includePageImages: isMistralOcr 
      ? (options.includePageImages !== undefined ? options.includePageImages : true)
      : options.includePageImages,
    // Bei Mistral OCR: includeOcrImages standardmäßig true (kann überschrieben werden)
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


