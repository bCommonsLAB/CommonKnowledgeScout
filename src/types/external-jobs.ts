// Zentrale Typen für modulare External-Job-Orchestrierung
// Beachte: Bestehende DB-Typen leben in `src/types/external-job.ts`.
// Diese Datei ergänzt modul-spezifische Schnittstellen und strengere Signaturen.

import type { NextRequest } from 'next/server'
import type { ExternalJob } from '@/types/external-job'

// --- Frontmatter & Kapitel ---
export interface ChapterMeta {
  title?: string
  order?: number
  level?: number
  startPage?: number
  endPage?: number
  pageCount?: number
  summary?: string
  keywords?: string[]
}

export interface Frontmatter {
  pages?: number
  chapters?: ChapterMeta[]
  [key: string]: unknown
}

// --- Context & Body ---
export interface ExternalCallbackBody {
  phase?: string
  data?: Record<string, unknown>
  process?: { id?: string } | undefined
  callback_token?: string | undefined
}

export interface RequestContext {
  request: NextRequest
  jobId: string
  job: ExternalJob
  body: ExternalCallbackBody
  callbackToken?: string
  internalBypass: boolean
}

// --- Fehler ---
export interface ExternalJobError extends Error {
  code: string
  status: number
  details?: Record<string, unknown>
}

export function createExternalJobError(code: string, message: string, status: number, details?: Record<string, unknown>): ExternalJobError {
  const err = new Error(message) as ExternalJobError
  err.code = code
  err.status = status
  if (details) err.details = details
  return err
}

// --- Policies ---
export interface PhasePolicies {
  // metadata: 'force' | 'skip' | 'auto'
  metadata: string
  // ingest: 'ignore' | 'enqueue' | 'upsert'
  ingest: string
}

// --- Decisions ---
export interface TemplateDecisionArgs {
  ctx: RequestContext
  policies: PhasePolicies
  isFrontmatterCompleteFromBody: boolean
  templateGateExists: boolean
  autoSkip: boolean
  isTemplateCompletedCallback: boolean
}

export interface TemplateDecisionResult {
  shouldRun: boolean
  gateExists: boolean
  isCallback: boolean
  needsRepair: boolean
  reason: string
}

// --- Template Run ---
export interface TemplateRunArgs {
  ctx: RequestContext
  extractedText: string
  templateContent: string
  targetLanguage: string
  /** Optional: LLM-Modell-ID für Template-Transformation (z.B. 'google/gemini-2.5-flash') */
  llmModel?: string
}

/** 
 * Template Run Ergebnis.
 * Bei Erfolg: meta ist gesetzt
 * Bei Fehler: meta=null/undefined und optionale Fehlerdetails
 */
export interface TemplateRunResult {
  meta?: Frontmatter | null
  /** Legacy: metadata wird als Alias für meta verwendet (Rückwärtskompatibilität) */
  metadata?: null
  /** HTTP-Status bei Fehler */
  status?: number
  /** HTTP-Statustext bei Fehler */
  statusText?: string
  /** Fehlermeldung */
  error?: string
}

// --- Kapitelanalyse ---
export interface ChaptersArgs {
  ctx: RequestContext
  baseMeta: Frontmatter
  textForAnalysis: string
  existingChapters?: ChapterMeta[]
}

export interface ChaptersResult {
  mergedMeta: Frontmatter
}

// --- Storage ---
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

export interface SaveMarkdownArgs {
  ctx: RequestContext
  parentId: string
  fileName: string
  markdown: string
  artifactKey?: ArtifactKey // Optional: Expliziter ArtifactKey für zentrale Logik (verhindert Parsing aus Dateinamen)
  /** Optional: ZIP-Daten für direkten Upload nach Azure (ohne Filesystem) */
  zipArchives?: Array<{ base64Data: string; fileName: string }>
  /** Optional: Job-ID für Logging */
  jobId?: string
}

export interface SaveMarkdownResult {
  savedItemId: string
}

// --- Images ---
export interface ImagesArgs {
  ctx: RequestContext
  parentId: string
  imagesZipUrl?: string
  extractedText?: string
  lang: string
}

export interface ImagesResult {
  savedItemIds: string[]
}

// --- Ingestion ---
export interface IngestArgs {
  ctx: RequestContext
  savedItemId: string
  fileName: string
  markdown: string
  meta?: Frontmatter
  provider?: import('@/lib/storage/types').StorageProvider
  shadowTwinFolderId?: string
}

export interface IngestResult {
  chunksUpserted: number
  docUpserted: boolean
  index: string
}

// --- Completion ---
export interface CompleteArgs {
  ctx: RequestContext
  result: { savedItemId?: string }
}

export interface JobResult {
  status: 'ok'
  jobId: string
}

// --- Utilities ---
export function isFrontmatterComplete(meta: Frontmatter): boolean {
  if (!meta || typeof meta !== 'object') return false
  const hasPages = typeof meta.pages === 'number' && meta.pages > 0
  const chapters = Array.isArray(meta.chapters) ? meta.chapters : []
  const hasChapters = chapters.length > 0
  return hasPages && hasChapters
}


