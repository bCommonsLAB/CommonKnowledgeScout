/**
 * @fileoverview Phase-spezifischer Preprocessor für Phase 1 (Extract)
 *
 * @description
 * Thin-Wrapper um den bestehenden, monolithischen `preprocess`-Analyzer.
 * Diese Funktion fokussiert sich rein auf die Fragen der Extract-Phase:
 * - Existiert bereits ein (relevantes) Markdown?
 * - Muss Extract überhaupt noch laufen?
 *
 * Die eigentliche Logik bleibt in `preprocess` gekapselt, um keine
 * bestehenden Semantiken zu brechen. Ziel ist primär eine klarere
 * Phasen-Schnittstelle.
 *
 * @module external-jobs
 */

import type { RequestContext } from '@/types/external-jobs'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { buildProvider } from '@/lib/external-jobs/provider'
import { findPdfMarkdown, decideNeedExtract } from '@/lib/external-jobs/preprocess-core'

export interface PreprocessPdfExtractResult {
  hasMarkdown: boolean
  markdownFileId?: string
  markdownFileName?: string
  needExtract: boolean
  reasons: string[]
  /** Optionale Debug-Informationen */
  internal?: Record<string, unknown>
}

/**
 * Preprocessor für Phase 1 (Extract).
 *
 * Aktuell:
 * - nutzt interne Core-Helfer (`preprocess-core`)
 * - leitet nur die für Extract relevante Sicht weiter
 */
export async function preprocessorPdfExtract(
  ctx: RequestContext
): Promise<PreprocessPdfExtractResult> {
  const { jobId, job } = ctx
  const userEmail = job.userEmail
  const libraryId = job.libraryId
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const parentId = job.correlation?.source?.parentId || 'root'

  const repo = new ExternalJobsRepository()
  const provider = await buildProvider({ userEmail, libraryId, jobId, repo })

  const found = await findPdfMarkdown(provider, parentId, baseName, lang)
  const needExtract = decideNeedExtract(found.hasMarkdown)

  return {
    hasMarkdown: found.hasMarkdown,
    markdownFileId: found.fileId,
    markdownFileName: found.fileName,
    needExtract,
    reasons: [],
    internal: {
      baseName,
      lang,
    },
  }
}


