/**
 * @fileoverview Zentrale Typdefinition: TransformSaveOptions
 *
 * @description
 * Eine einzige Schnittstelle für Speicher-/UI-Optionen bei Transformationen (Archiv,
 * Secretary, External Jobs). Verhindert divergierende Duplikate zwischen UI-Komponente
 * und TransformService (siehe Policy: pipeline-standard-path-policy / rules-gap-analysis).
 *
 * @module transform
 */

/**
 * Optionen zum Speichern nach einer Transformation (Sprache, Dateiname, Shadow-Twin, Extraktion).
 *
 * Index-Signatur: erlaubt optionale Zusatzfelder (z. B. `extractionMethod`) ohne den
 * Vertrag zu brechen, wenn Payloads über APIs laufen.
 */
export interface TransformSaveOptions {
  [key: string]: unknown;
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  /** PDF: Extraktionsmethode (native, mistral_ocr, …) */
  extractionMethod?: string;
  useCache?: boolean;
  /** OCR-Bilder (von Mistral erkannte eingebettete Bilder) als ZIP anfordern. */
  includeOcrImages?: boolean;
  /**
   * PDF-Vorschau-Renderings (Low-Res, ~360 px, JPEG q80) im pages.zip anfordern.
   * Liefert preview_NNN.jpg zur UI-Vorschau / als Thumbnail.
   * Default bei mistral_ocr: true.
   */
  includePreviewPages?: boolean;
  /**
   * PDF-Hochaufloesungs-Renderings (200 DPI, JPEG q85) im pages.zip anfordern.
   * Liefert page_NNN.jpeg zur Weiterverarbeitung (z.B. Split-Pages-Funktion).
   * Default bei mistral_ocr: true.
   * Unabhaengig von includePreviewPages — beide koennen kombiniert werden.
   */
  includeHighResPages?: boolean;
  /** @deprecated zugunsten includeOcrImages */
  includeImages?: boolean;
  /** Nach Speicherung automatisch Ingestion-Pipeline */
  useIngestionPipeline?: boolean;
  /** Freitext-Kontext fürs LLM (z. B. Bild-Transformation) */
  context?: string;
}
