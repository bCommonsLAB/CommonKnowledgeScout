/**
 * @fileoverview Phase-spezifischer Preprocessor für Phase 3 (Ingestion)
 *
 * @description
 * Thin-Wrapper um den bestehenden, monolithischen `preprocess`-Analyzer.
 * Diese Funktion fokussiert sich auf die Fragen der Ingestion-Phase:
 * - Gibt es (transformiertes) Markdown?
 * - Ist das Frontmatter valide genug für RAG/Ingestion?
 * - Muss Ingestion laufen?
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
import {
  findPdfMarkdown,
  analyzeFrontmatter,
  validateFrontmatter,
  decideNeedIngest,
} from '@/lib/external-jobs/preprocess-core'
import { FileLogger } from '@/lib/debug/logger'

export interface PreprocessIngestResult {
  hasMarkdown: boolean
  hasFrontmatter: boolean
  frontmatterValid: boolean
  markdownFileId?: string
  markdownFileName?: string
  needIngest: boolean
  reasons: string[]
  internal?: Record<string, unknown>
}

/**
 * Preprocessor für Phase 3 (Ingestion).
 *
 * Aktuell:
 * - nutzt interne Core-Helfer (`preprocess-core`)
 * - leitet nur die für Ingestion relevante Sicht weiter
 */
export async function preprocessorIngest(
  ctx: RequestContext
): Promise<PreprocessIngestResult> {
  const { jobId, job } = ctx
  const userEmail = job.userEmail
  const libraryId = job.libraryId
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const parentId = job.correlation?.source?.parentId || 'root'

  const repo = new ExternalJobsRepository()
  const provider = await buildProvider({ userEmail, libraryId, jobId, repo })

  // Versuche zuerst mit der angeforderten Sprache
  let found = await findPdfMarkdown(provider, parentId, baseName, lang)

  // Wenn nicht gefunden und shadowTwinState verfügbar: Versuche die tatsächlich vorhandene Datei zu finden
  if (!found.hasMarkdown && job.shadowTwinState?.transformed?.id) {
    const transformedFileId = job.shadowTwinState.transformed.id
    const transformedFileName = (job.shadowTwinState.transformed.metadata?.name as string) || ''
    
    // Extrahiere Sprache aus Dateinamen (z.B. "file.de.md" → "de")
    const langMatch = transformedFileName.match(/\.([a-z]{2})\.md$/i)
    const actualLang = langMatch ? langMatch[1] : lang
    
    // Wenn die Sprache anders ist als angefordert, versuche mit der tatsächlichen Sprache
    if (actualLang !== lang) {
      FileLogger.info('preprocessor-ingest', 'Datei mit anderer Sprache gefunden, versuche mit tatsächlicher Sprache', {
        jobId,
        requestedLang: lang,
        actualLang,
        transformedFileName,
      })
      found = await findPdfMarkdown(provider, parentId, baseName, actualLang)
    }
    
    // Fallback: Versuche direkt die Datei aus shadowTwinState zu laden
    if (!found.hasMarkdown && transformedFileId) {
      try {
        const bin = await provider.getBinary(transformedFileId)
        const text = await bin.blob.text()
        found = {
          hasMarkdown: true,
          fileId: transformedFileId,
          fileName: transformedFileName,
          text,
        }
        FileLogger.info('preprocessor-ingest', 'Markdown aus shadowTwinState geladen', {
          jobId,
          fileId: transformedFileId,
          fileName: transformedFileName,
        })
      } catch (error) {
        FileLogger.warn('preprocessor-ingest', 'Fehler beim Laden der Datei aus shadowTwinState', {
          jobId,
          fileId: transformedFileId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (!found.hasMarkdown || !found.text) {
    const needIngest = decideNeedIngest(false, false)
    return {
      hasMarkdown: false,
      hasFrontmatter: false,
      frontmatterValid: false,
      markdownFileId: found.fileId,
      markdownFileName: found.fileName,
      needIngest,
      reasons: ['no_markdown_found'],
      internal: { baseName, lang },
    }
  }

  const analysis = analyzeFrontmatter(found.text)
  const validation = await validateFrontmatter(analysis.meta, userEmail, libraryId)
  const needIngest = decideNeedIngest(analysis.hasFrontmatter, validation.frontmatterValid)

  return {
    hasMarkdown: found.hasMarkdown,
    hasFrontmatter: analysis.hasFrontmatter,
    frontmatterValid: validation.frontmatterValid,
    markdownFileId: found.fileId,
    markdownFileName: found.fileName,
    needIngest,
    reasons: validation.reasons,
    internal: { baseName, lang },
  }
}


