/**
 * @fileoverview Template-Files Modul für External Jobs
 * 
 * @description
 * Wrapper um die zentrale Template-Service Library für External Jobs.
 * Verwendet die zentrale Template-Service Library ohne Fallback-Logik.
 * 
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { loadTemplate, type TemplateServiceProvider } from '@/lib/templates/template-service'

export interface PickTemplateArgs {
  provider: TemplateServiceProvider
  repo: ExternalJobsRepository
  jobId: string
  preferredTemplateName?: string
}

export interface PickTemplateResult {
  templateContent: string
  templateName: string
  /** Gibt an, ob das Preferred Template gefunden wurde */
  isPreferred: boolean
}

/**
 * Lädt ein Template für External Jobs.
 * 
 * @throws {TemplateNotFoundError} Wenn kein Template gefunden wird
 */
export async function pickTemplate(args: PickTemplateArgs): Promise<PickTemplateResult> {
  const { provider, repo, jobId, preferredTemplateName } = args
  
  // Verwende zentrale Template-Service Library
  return await loadTemplate({
    provider,
    preferredTemplateName,
    repo,
    jobId
  })
}


