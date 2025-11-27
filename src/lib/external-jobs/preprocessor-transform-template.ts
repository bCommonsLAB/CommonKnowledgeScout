/**
 * @fileoverview Phase-spezifischer Preprocessor für Phase 2 (Template / Transform)
 *
 * @description
 * Thin-Wrapper um den bestehenden, monolithischen `preprocess`-Analyzer.
 * Diese Funktion fokussiert sich auf die Fragen der Template-Phase:
 * - Gibt es ein Markdown?
 * - Hat es Frontmatter?
 * - Ist das Frontmatter valide (Core-Felder + Facetten)?
 * - Muss Template laufen (Reparatur / Neu-Berechnung)?
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
  decideNeedTemplate,
} from '@/lib/external-jobs/preprocess-core'

export interface PreprocessTransformTemplateResult {
  hasMarkdown: boolean
  hasFrontmatter: boolean
  frontmatterValid: boolean
  markdownFileId?: string
  markdownFileName?: string
  body?: string
  meta?: Record<string, unknown>
  needTemplate: boolean
  reasons: string[]
  internal?: Record<string, unknown>
}

/**
 * Preprocessor für Phase 2 (Template / Transform).
 *
 * Aktuell:
 * - nutzt interne Core-Helfer (`preprocess-core`)
 * - leitet nur die für Template relevante Sicht weiter
 */
export async function preprocessorTransformTemplate(
  ctx: RequestContext
): Promise<PreprocessTransformTemplateResult> {
  const { jobId, job } = ctx
  const userEmail = job.userEmail
  const libraryId = job.libraryId
  const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de'
  const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '')
  const parentId = job.correlation?.source?.parentId || 'root'

  const repo = new ExternalJobsRepository()
  const provider = await buildProvider({ userEmail, libraryId, jobId, repo })

  const found = await findPdfMarkdown(provider, parentId, baseName, lang)

  if (!found.hasMarkdown || !found.text) {
    return {
      hasMarkdown: false,
      hasFrontmatter: false,
      frontmatterValid: false,
      markdownFileId: found.fileId,
      markdownFileName: found.fileName,
      body: undefined,
      meta: {},
      needTemplate: true,
      reasons: ['no_markdown_found'],
      internal: { baseName, lang },
    }
  }

  const analysis = analyzeFrontmatter(found.text)
  const validation = await validateFrontmatter(analysis.meta, userEmail, libraryId)
  const needTemplate = decideNeedTemplate(analysis.hasFrontmatter, validation.frontmatterValid)

  return {
    hasMarkdown: found.hasMarkdown,
    hasFrontmatter: analysis.hasFrontmatter,
    frontmatterValid: validation.frontmatterValid,
    markdownFileId: found.fileId,
    markdownFileName: found.fileName,
    body: analysis.body,
    meta: analysis.meta,
    needTemplate,
    reasons: validation.reasons,
    internal: {
      baseName,
      lang,
    },
  }
}


