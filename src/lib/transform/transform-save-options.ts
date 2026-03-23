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
  includeOcrImages?: boolean;
  includePageImages?: boolean;
  /** @deprecated zugunsten includeOcrImages/includePageImages */
  includeImages?: boolean;
  /** Nach Speicherung automatisch Ingestion-Pipeline */
  useIngestionPipeline?: boolean;
  /** Freitext-Kontext fürs LLM (z. B. Bild-Transformation) */
  context?: string;
}
