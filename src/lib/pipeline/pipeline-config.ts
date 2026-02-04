/**
 * @fileoverview Zentrale Pipeline-Konfigurationstypen
 * 
 * @description
 * Shared Types für Pipeline-Konfiguration, verwendet von:
 * - UI-Komponenten (PipelineSheet, MediaBatchDialog)
 * - API-Endpoints (unified pipeline endpoint)
 * - Backend-Orchestrierung (run-pipeline.ts)
 * 
 * @module pipeline
 */

import type { MediaKind, JobType } from "@/lib/media-types"

// =============================================================================
// POLICIES
// =============================================================================

/**
 * Policy für eine einzelne Phase
 * - ignore: Phase überspringen
 * - do: Ausführen wenn Gate nicht existiert
 * - force: Immer ausführen (Gate ignorieren)
 */
export type PhasePolicy = "ignore" | "do" | "force"

/**
 * Policies für alle drei Phasen
 */
export interface PipelinePolicies {
  /** Phase 1: Extraktion/OCR/Transkription */
  extract: PhasePolicy
  /** Phase 2: Template-Transformation + Metadaten */
  metadata: PhasePolicy
  /** Phase 3: RAG-Ingestion */
  ingest: PhasePolicy
}

// =============================================================================
// PIPELINE-KONFIGURATION
// =============================================================================

/**
 * Vollständige Pipeline-Konfiguration
 * Verwendet für Job-Erstellung und UI-Konfiguration
 */
export interface PipelineConfig {
  // --- Phasen ---
  /** Welche Phasen aktiviert sind */
  phases: {
    extract: boolean
    template: boolean
    ingest: boolean
  }
  /** Policies für jede Phase */
  policies: PipelinePolicies
  
  // --- Template ---
  /** Name des zu verwendenden Templates */
  templateName?: string
  /** Zielsprache für die Verarbeitung */
  targetLanguage: string
  
  // --- Cover-Bild ---
  /** Cover-Bild generieren? */
  generateCoverImage?: boolean
  /** Custom Prompt für Cover-Bild-Generierung */
  coverImagePrompt?: string
  
  // --- Force-Override ---
  /** Bestehende Assets überschreiben? (setzt alle Policies auf 'force') */
  forceOverride?: boolean
  
  // --- LLM-Modell ---
  /** LLM-Modell für Template-Transformation (z.B. 'google/gemini-2.5-flash') */
  llmModel?: string
}

// =============================================================================
// API-REQUEST
// =============================================================================

/**
 * Einzelnes Item für Batch-Verarbeitung
 */
export interface PipelineItem {
  /** Storage-Item-ID */
  fileId: string
  /** Parent-Folder-ID */
  parentId: string
  /** Dateiname */
  name: string
  /** MIME-Type (optional, wird aus Dateiname inferiert wenn nicht angegeben) */
  mimeType?: string
}

/**
 * Request-Body für den Unified Pipeline Endpoint
 */
export interface PipelineRequest {
  /** Library-ID */
  libraryId: string
  
  /** Einzelnes Item (für Einzel-Modus) */
  item?: PipelineItem
  
  /** Mehrere Items (für Batch-Modus) */
  items?: PipelineItem[]
  
  /** Pipeline-Konfiguration */
  config: PipelineConfig
  
  /** Batch-Name (optional, für Gruppierung) */
  batchName?: string
  
  // --- PDF-spezifische Optionen ---
  /** Extraktionsmethode für PDFs (default: mistral_ocr) */
  extractionMethod?: string
  /** OCR-Bilder einschließen? */
  includeOcrImages?: boolean
  /** Seitenbilder einschließen? */
  includePageImages?: boolean
  /** Cache verwenden? */
  useCache?: boolean
}

/**
 * Response vom Unified Pipeline Endpoint
 */
export interface PipelineResponse {
  /** Erfolgreich erstellte Jobs */
  jobs: Array<{
    jobId: string
    fileId: string
    fileName: string
    mediaKind: MediaKind
    jobType: JobType
  }>
  
  /** Anzahl erfolgreicher Jobs */
  successCount: number
  
  /** Fehlgeschlagene Items */
  failures: Array<{
    fileId: string
    fileName: string
    error: string
  }>
  
  /** Anzahl fehlgeschlagener Jobs */
  failureCount: number
  
  /** Batch-ID (wenn Batch-Modus) */
  batchId?: string
}

// =============================================================================
// HILFSFUNKTIONEN
// =============================================================================

/**
 * Erstellt Standard-Policies basierend auf forceOverride-Flag
 */
export function createDefaultPolicies(forceOverride: boolean = false): PipelinePolicies {
  const policy: PhasePolicy = forceOverride ? "force" : "do"
  return {
    extract: policy,
    metadata: policy,
    ingest: policy,
  }
}

/**
 * Erstellt Standard-PipelineConfig
 */
export function createDefaultConfig(overrides: Partial<PipelineConfig> = {}): PipelineConfig {
  return {
    phases: {
      extract: true,
      template: true,
      ingest: true,
    },
    policies: createDefaultPolicies(overrides.forceOverride),
    targetLanguage: "de",
    ...overrides,
  }
}

/**
 * Konvertiert PipelineConfig zu Job-Parametern
 */
export function configToJobParameters(config: PipelineConfig): Record<string, unknown> {
  return {
    targetLanguage: config.targetLanguage,
    template: config.templateName,
    phases: config.phases,
    policies: config.policies,
    generateCoverImage: config.generateCoverImage,
    coverImagePrompt: config.coverImagePrompt,
    // LLM-Modell für Template-Transformation
    llmModel: config.llmModel,
  }
}
