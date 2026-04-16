/**
 * @fileoverview Template-Files Modul für External Jobs
 * 
 * @description
 * Lädt Templates aus MongoDB für External Jobs.
 * Serialisiert Templates zu Markdown für Secretary Service Kompatibilität.
 * Zentralisiert die Template-Name-Auflösung (Job-Parameter → Library-Config → Default).
 * 
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { loadTemplateFromMongoDB, serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'
import { FileLogger } from '@/lib/debug/logger'

export interface PickTemplateArgs {
  repo: ExternalJobsRepository
  jobId: string
  libraryId: string
  userEmail: string
  /** Expliziter Template-Name — überschreibt Job-Parameter und Library-Config */
  preferredTemplateName?: string
  /** Job-Objekt — wenn übergeben, wird der Template-Name automatisch aufgelöst */
  job?: { parameters?: Record<string, unknown> }
}

export interface PickTemplateResult {
  templateContent: string
  templateName: string
  /** Gibt an, ob das Preferred Template gefunden wurde */
  isPreferred: boolean
}

/**
 * Löst den Template-Namen aus Job-Parametern und Library-Config auf.
 * 
 * Priorität:
 * 1. Job-Parameter (`job.parameters.template`)
 * 2. Library-Config (`library.config.secretaryService.template`)
 * 3. undefined (pickTemplate verwendet dann Default "pdfanalyse")
 */
export async function resolvePreferredTemplateName(
  job: { parameters?: Record<string, unknown> },
  libraryId: string,
  userEmail: string,
): Promise<string | undefined> {
  // Priorität 1: Template aus Job-Parametern
  const fromJobParams = job.parameters?.template as string | undefined
  if (fromJobParams) return fromJobParams

  // Priorität 2: Template aus Library-Config
  try {
    const { LibraryService } = await import('@/lib/services/library-service')
    const libraryService = LibraryService.getInstance()
    const library = await libraryService.getLibrary(userEmail, libraryId)
    const fromConfig = library?.config?.secretaryService?.template as string | undefined
    if (fromConfig) return fromConfig
  } catch {
    // Nicht kritisch — pickTemplate kann auch ohne Preferred Template arbeiten
  }

  return undefined
}

/**
 * Lädt ein Template aus MongoDB für External Jobs.
 * 
 * Template-Name-Auflösung:
 * 1. `preferredTemplateName` (explizit übergeben)
 * 2. `job.parameters.template` (wenn `job` übergeben)
 * 3. Library-Config `secretaryService.template` (wenn `job` übergeben)
 * 4. Default: "pdfanalyse"
 * 
 * @throws {Error} Wenn kein Template gefunden wird
 */
export async function pickTemplate(args: PickTemplateArgs): Promise<PickTemplateResult> {
  const { repo, jobId, libraryId, userEmail, job } = args

  // Template-Name auflösen: explizit > Job-Parameter > Library-Config > Default
  let preferredTemplateName = args.preferredTemplateName
  if (!preferredTemplateName && job) {
    preferredTemplateName = await resolvePreferredTemplateName(job, libraryId, userEmail)
    if (preferredTemplateName) {
      FileLogger.info('template-files', 'Template-Name aufgelöst', {
        jobId,
        libraryId,
        preferredTemplateName,
        source: job.parameters?.template ? 'job_parameters' : 'library_config',
      })
    }
  }
  
  const templateName = preferredTemplateName || 'pdfanalyse'
  
  // Lade Template aus MongoDB
  let template = await loadTemplateFromMongoDB(templateName, libraryId, userEmail, false)
  
  // Fallback: Wenn Template nicht gefunden wurde, suche nach Name in allen Templates der Library
  // Dies kann passieren, wenn die _id nicht mit der generierten ID übereinstimmt
  if (!template) {
    const { listTemplatesFromMongoDB } = await import('@/lib/templates/template-service-mongodb')
    const allTemplates = await listTemplatesFromMongoDB(libraryId, userEmail, false)
    
    // Suche nach Template-Name (case-insensitive)
    template = allTemplates.find(t => 
      t.name.toLowerCase() === templateName.toLowerCase()
    ) || null
    
    if (template) {
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'template_found_by_name_fallback',
          attributes: {
            preferredTemplate: preferredTemplateName || '(nicht gesetzt)',
            foundTemplateId: template._id,
            foundTemplateName: template.name
          }
        })
      } catch {}
    }
  }
  
  if (!template) {
    const { listTemplatesFromMongoDB } = await import('@/lib/templates/template-service-mongodb')
    const allTemplates = await listTemplatesFromMongoDB(libraryId, userEmail, false)
    const availableNames = allTemplates.map(t => t.name)
    
    const errorMessage = preferredTemplateName
      ? `Template "${preferredTemplateName}" nicht gefunden in Library "${libraryId}". Verfügbare Templates: ${availableNames.join(', ') || 'keine'}`
      : `Kein Template gefunden. Verfügbare Templates: ${availableNames.join(', ') || 'keine'}`
    
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'template_not_found',
        attributes: {
          preferredTemplate: preferredTemplateName || '(nicht gesetzt)',
          availableTemplates: availableNames,
          error: errorMessage
        }
      })
    } catch {}
    
    throw new Error(errorMessage)
  }
  
  // Serialisiere Template zu Markdown (ohne creation-Block für Secretary Service)
  const templateContent = serializeTemplateToMarkdown(template, false)
  
  try {
    await repo.traceAddEvent(jobId, {
      spanId: 'template',
      name: 'template_selected',
      attributes: {
        preferred: preferredTemplateName || '(nicht gesetzt)',
        picked: true,
        templateName: template.name,
        isPreferred: !!preferredTemplateName && preferredTemplateName === template.name
      }
    })
  } catch {}
  
  return {
    templateContent,
    templateName: template.name,
    isPreferred: !!preferredTemplateName && preferredTemplateName === template.name
  }
}
