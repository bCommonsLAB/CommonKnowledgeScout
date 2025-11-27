/**
 * @fileoverview Trace-Event-Helper für External Jobs
 *
 * @description
 * Standardisiertes Erstellen von Trace-Events aus Preprozessor-Ergebnissen.
 *
 * @module external-jobs
 */

import type { PreprocessPdfExtractResult } from '@/lib/external-jobs/preprocessor-pdf-extract'
import type { PreprocessTransformTemplateResult } from '@/lib/external-jobs/preprocessor-transform-template'
import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

/**
 * Erstellt standardisierte Preprocess-Trace-Events aus Preprozessor-Ergebnissen.
 *
 * @param jobId Job-ID
 * @param preExtractResult Ergebnis des Extract-Preprozessors
 * @param preTemplateResult Ergebnis des Template-Preprozessors
 * @param repo External-Jobs-Repository
 */
export async function tracePreprocessEvents(
  jobId: string,
  preExtractResult: PreprocessPdfExtractResult | null | undefined,
  preTemplateResult: PreprocessTransformTemplateResult | null | undefined,
  repo: ExternalJobsRepository
): Promise<void> {
  if (!preTemplateResult) {
    return
  }

  try {
    await repo.traceStartSpan(jobId, { spanId: 'preprocess', parentSpanId: 'job', name: 'preprocess' })
  } catch {
    // Span könnte bereits existieren
  }

  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'preprocess',
      name: 'preprocess_found_markdown',
      attributes: {
        expectedFileName: preTemplateResult.markdownFileName,
        existingFileId: preTemplateResult.markdownFileId,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'preprocess',
      name: 'preprocess_frontmatter_valid',
      attributes: {
        hasFrontmatter: preTemplateResult.hasFrontmatter,
        valid: preTemplateResult.frontmatterValid,
        expectedFileName: preTemplateResult.markdownFileName,
        existingFileId: preTemplateResult.markdownFileId,
        hasMarkdown: preTemplateResult.hasMarkdown,
        metaKeys: preTemplateResult.meta ? Object.keys(preTemplateResult.meta) : [],
        reasons: preTemplateResult.reasons,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'preprocess',
      name: 'preprocess_summary',
      attributes: {
        hasMarkdown: preTemplateResult.hasMarkdown,
        hasFrontmatter: preTemplateResult.hasFrontmatter,
        frontmatterValid: preTemplateResult.frontmatterValid,
      },
    })
  } catch {
    // Trace-Fehler nicht kritisch
  }

  try {
    await repo.traceEndSpan(jobId, 'preprocess', 'completed', {})
  } catch {
    // Trace-Fehler nicht kritisch
  }
}





