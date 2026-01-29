/**
 * @fileoverview Pipeline Runner - Wiederverwendbare Funktionen zum Starten von Verarbeitungs-Pipelines
 * 
 * @description
 * Extrahiert die Pipeline-Start-Logik aus FlowActions, damit sie sowohl im Story Creator
 * als auch im Preview-Mode verwendet werden kann.
 * 
 * Unterstützt zwei Modi:
 * 1. Legacy-Modus: Einzelne Endpoints pro Medientyp (process-pdf, process-audio, etc.)
 * 2. Unified-Modus: Zentraler /api/pipeline/process Endpoint für alle Medientypen
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
import { type MediaKind, getMediaKind } from "@/lib/media-types"

// =============================================================================
// UNIFIED ENDPOINT (NEU)
// =============================================================================

/**
 * Startet eine Pipeline über den Unified Endpoint
 * 
 * @param args Pipeline-Konfiguration
 * @returns Job-ID des erstellten Jobs
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
// LEGACY ENDPOINTS (für Rückwärtskompatibilität)
// =============================================================================

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

/**
 * Enqueued einen PDF-Verarbeitungs-Job
 */
async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: PipelinePolicies
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
  generateCoverImage?: boolean
  coverImagePrompt?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))
  // Cover-Bild-Generierung (als Job-Parameter)
  if (args.generateCoverImage) fd.append("generateCoverImage", "true")
  if (isNonEmptyString(args.coverImagePrompt)) fd.append("coverImagePrompt", args.coverImagePrompt)

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

/**
 * Enqueued einen Audio- oder Video-Verarbeitungs-Job
 */
async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: PipelinePolicies
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

/**
 * Enqueued einen Text/Markdown-Verarbeitungs-Job
 */
async function enqueueTextJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: PipelinePolicies
  generateCoverImage?: boolean
  coverImagePrompt?: string
}): Promise<string> {
  const res = await fetch("/api/secretary/process-text/job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
      // Cover-Bild-Generierung
      ...(args.generateCoverImage ? { generateCoverImage: true } : {}),
      ...(isNonEmptyString(args.coverImagePrompt) ? { coverImagePrompt: args.coverImagePrompt } : {}),
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

/**
 * Startet eine Pipeline für eine Datei basierend auf deren Typ
 * 
 * @returns Job-ID des enqueued Jobs
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
  const { libraryId, sourceFile, parentId, kind, targetLanguage, templateName, policies, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate, generateCoverImage, coverImagePrompt } = args

  if (sourceFile.type !== "file") {
    throw new Error("Quelle ist keine Datei")
  }

  let jobId = ""
  if (kind === "pdf") {
    jobId = await enqueuePdfJob({
      libraryId,
      sourceFile,
      parentId,
      targetLanguage,
      templateName,
      policies,
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate,
      generateCoverImage,
      coverImagePrompt,
    })
  } else if (kind === "audio") {
    jobId = await enqueueMediaJob({
      endpoint: "/api/secretary/process-audio/job",
      libraryId,
      sourceFile,
      parentId,
      targetLanguage,
      templateName,
      policies,
    })
  } else if (kind === "video") {
    jobId = await enqueueMediaJob({
      endpoint: "/api/secretary/process-video/job",
      libraryId,
      sourceFile,
      parentId,
      targetLanguage,
      templateName,
      policies,
    })
  } else if (kind === "markdown") {
    // Bei Markdown: extract immer "ignore" erzwingen (Textquelle bereits vorhanden)
    const markdownPolicies: PipelinePolicies = {
      ...policies,
      extract: "ignore",
    }
    jobId = await enqueueTextJob({
      libraryId,
      sourceFile,
      parentId,
      targetLanguage,
      templateName,
      policies: markdownPolicies,
      generateCoverImage,
      coverImagePrompt,
    })
  } else {
    throw new Error(`Flow Actions sind aktuell nur für PDF/Audio/Video/Markdown vorgesehen (Dateityp: ${kind}).`)
  }

  // Worker-Tick triggern fuer sofortige Verarbeitung (best-effort, kein Fehler bei Misserfolg)
  try {
    void fetch("/api/external/jobs/worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "tick" }),
    })
  } catch {
    // Worker-Trigger ist optional - Fehler ignorieren
  }

  return { jobId }
}
