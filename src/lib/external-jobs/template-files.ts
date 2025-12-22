/**
 * @fileoverview Template-Files Modul für External Jobs
 * 
 * @description
 * Lädt Templates aus MongoDB für External Jobs.
 * Serialisiert Templates zu Markdown für Secretary Service Kompatibilität.
 * 
 * @module external-jobs
 */

import { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { loadTemplateFromMongoDB, serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'

export interface PickTemplateArgs {
  repo: ExternalJobsRepository
  jobId: string
  libraryId: string
  userEmail: string
  preferredTemplateName?: string
}

export interface PickTemplateResult {
  templateContent: string
  templateName: string
  /** Gibt an, ob das Preferred Template gefunden wurde */
  isPreferred: boolean
}

/**
 * Lädt ein Template aus MongoDB für External Jobs.
 * 
 * @throws {Error} Wenn kein Template gefunden wird
 */
export async function pickTemplate(args: PickTemplateArgs): Promise<PickTemplateResult> {
  const { repo, jobId, libraryId, userEmail, preferredTemplateName } = args
  
  // Wenn kein Preferred Template angegeben, verwende Default "pdfanalyse"
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
      // Template gefunden, aber mit anderer _id - logge Warnung
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
    // Versuche alle Templates zu laden, um verfügbare zu zeigen
    const { listTemplatesFromMongoDB } = await import('@/lib/templates/template-service-mongodb')
    const allTemplates = await listTemplatesFromMongoDB(libraryId, userEmail, false)
    const availableNames = allTemplates.map(t => t.name)
    
    const errorMessage = preferredTemplateName
      ? `Template "${preferredTemplateName}" nicht gefunden in Library "${libraryId}". Verfügbare Templates: ${availableNames.join(', ') || 'keine'}`
      : `Kein Template gefunden. Verfügbare Templates: ${availableNames.join(', ') || 'keine'}`
    
    // Trace-Event für Fehler
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
  
  // Trace-Event für Erfolg
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


