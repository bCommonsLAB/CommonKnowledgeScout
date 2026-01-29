/**
 * @fileoverview Pipeline Runner - Funktionen zum Starten von Verarbeitungs-Pipelines
 * 
 * @description
 * Zentraler Einstiegspunkt für alle Pipeline-Operationen. Verwendet den
 * Unified Endpoint `/api/pipeline/process` für alle Medientypen.
 * 
 * @example
 * // Einzeldatei verarbeiten
 * const { jobId } = await runPipelineForFile({
 *   libraryId: 'xxx',
 *   sourceFile: file,
 *   parentId: 'yyy',
 *   kind: 'pdf',
 *   targetLanguage: 'de',
 *   policies: { extract: 'do', metadata: 'do', ingest: 'do' }
 * })
 * 
 * // Batch-Verarbeitung erfolgt direkt über /api/pipeline/process mit items[]
 * 
 * @module pipeline
 */

import type { StorageItem } from "@/lib/storage/types"
import { FileLogger } from "@/lib/debug/logger"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import type { TargetLanguage } from "@/lib/chat/constants"
import type { PipelinePolicies } from "@/lib/pipeline/pipeline-config"
import type { PipelineRequest, PipelineResponse, PipelineConfig } from "@/lib/pipeline/pipeline-config"
// Zentrale Medientyp-Definitionen - Re-Export für Rückwärtskompatibilität
export { type MediaKind, getMediaKind } from "@/lib/media-types"
import { type MediaKind } from "@/lib/media-types"

// =============================================================================
// UNIFIED PIPELINE ENDPOINT
// =============================================================================

/**
 * Startet eine Pipeline über den Unified Endpoint
 * 
 * Dieser Endpoint unterstützt alle Medientypen (PDF, Audio, Video, Markdown)
 * und kann sowohl Einzeldateien als auch Batches verarbeiten.
 * 
 * @param args Pipeline-Konfiguration
 * @returns Job-ID und erkannter Medientyp
 */
export async function runPipelineUnified(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  config: PipelineConfig
  /** PDF-spezifische Optionen */
  extractionMethod?: string
  includeOcrImages?: boolean
  includePageImages?: boolean
  useCache?: boolean
}): Promise<{ jobId: string; mediaKind: MediaKind }> {
  const { libraryId, sourceFile, parentId, config } = args

  if (sourceFile.type !== "file") {
    throw new Error("Quelle ist keine Datei")
  }

  const request: PipelineRequest = {
    libraryId,
    item: {
      fileId: sourceFile.id,
      parentId,
      name: sourceFile.metadata.name,
      mimeType: sourceFile.metadata.mimeType,
    },
    config,
    extractionMethod: args.extractionMethod,
    includeOcrImages: args.includeOcrImages,
    includePageImages: args.includePageImages,
    useCache: args.useCache,
  }

  const res = await fetch("/api/pipeline/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as PipelineResponse
  
  if (!res.ok) {
    const errorMsg = (json as { error?: string }).error || `HTTP ${res.status}`
    throw new Error(errorMsg)
  }

  if (json.failureCount > 0 && json.failures?.length > 0) {
    throw new Error(json.failures[0].error)
  }

  if (json.successCount === 0 || !json.jobs?.length) {
    throw new Error("Keine Jobs erstellt")
  }

  return {
    jobId: json.jobs[0].jobId,
    mediaKind: json.jobs[0].mediaKind,
  }
}

// =============================================================================
// CONVENIENCE WRAPPER
// =============================================================================

/**
 * Startet eine Pipeline für eine einzelne Datei
 * 
 * Diese Funktion ist ein Wrapper um runPipelineUnified() mit einer
 * vereinfachten API, die Legacy-Parameter akzeptiert und in das
 * PipelineConfig-Format konvertiert.
 * 
 * @param args Datei und Verarbeitungsoptionen
 * @returns Job-ID des erstellten Jobs
 * @throws Error wenn die Pipeline nicht gestartet werden kann
 */
export async function runPipelineForFile(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  kind: MediaKind
  targetLanguage: string
  templateName?: string
  policies: PipelinePolicies
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
  /** Cover-Bild automatisch generieren */
  generateCoverImage?: boolean
  /** Optionaler Prompt für Cover-Bild-Generierung */
  coverImagePrompt?: string
}): Promise<{ jobId: string }> {
  const { libraryId, sourceFile, parentId, kind, targetLanguage, templateName, policies, generateCoverImage, coverImagePrompt } = args

  if (sourceFile.type !== "file") {
    throw new Error("Quelle ist keine Datei")
  }

  // Unified Endpoint für alle Medientypen
  // Konvertiere Legacy-Parameter in PipelineConfig-Format
  const config: PipelineConfig = {
    targetLanguage: targetLanguage as TargetLanguage,
    templateName,
    phases: {
      // Bei Markdown ist Extract immer deaktiviert
      extract: kind !== "markdown",
      template: policies.metadata !== "ignore",
      ingest: policies.ingest !== "ignore",
    },
    policies: {
      extract: kind === "markdown" ? "ignore" : policies.extract,
      metadata: policies.metadata,
      ingest: policies.ingest,
    },
    generateCoverImage,
    coverImagePrompt,
  }

  FileLogger.info('run-pipeline', 'Pipeline starten (Unified Endpoint)', {
    libraryId,
    fileName: sourceFile.metadata.name,
    kind,
    config,
  })

  // PDF-spezifische Optionen
  let extractionMethod: string | undefined
  let includeOcrImages: boolean | undefined
  let includePageImages: boolean | undefined
  let useCache: boolean | undefined

  if (kind === "pdf") {
    const defaults = getEffectivePdfDefaults(
      libraryId,
      loadPdfDefaults(libraryId),
      {},
      args.libraryConfigChatTargetLanguage,
      args.libraryConfigPdfTemplate
    )
    extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
    const isMistralOcr = extractionMethod === 'mistral_ocr'
    if (isMistralOcr) {
      includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
      includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    }
    useCache = defaults.useCache ?? true
  }

  const result = await runPipelineUnified({
    libraryId,
    sourceFile,
    parentId,
    config,
    extractionMethod,
    includeOcrImages,
    includePageImages,
    useCache,
  })

  // Worker-Tick triggern für sofortige Verarbeitung (best-effort, kein Fehler bei Misserfolg)
  try {
    void fetch("/api/external/jobs/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tick" }),
    })
  } catch {
    // Worker-Trigger ist optional - Fehler ignorieren
  }

  return { jobId: result.jobId }
}
