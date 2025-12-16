/**
 * Utility-Funktionen zum Parsen von Creation-Resume-Metadaten aus Frontmatter
 */

export interface CreationResumeMeta {
  creationTypeId: string
  creationTemplateId: string
  creationDetailViewType: 'book' | 'session' | 'testimonial'
  textSources?: string[]
  templateName?: string
}

/**
 * Parst Creation-Resume-Metadaten aus Frontmatter.
 * 
 * @param meta Frontmatter-Metadaten als Record
 * @returns Parsed Resume-Metadaten oder null, wenn nicht resume-fähig
 */
export function parseCreationResumeMeta(meta: Record<string, unknown>): CreationResumeMeta | null {
  // Prüfe, ob alle erforderlichen Felder vorhanden sind
  const creationTypeId = typeof meta.creationTypeId === 'string' ? meta.creationTypeId.trim() : undefined
  const creationTemplateId = typeof meta.creationTemplateId === 'string' ? meta.creationTemplateId.trim() : undefined
  const creationDetailViewType = typeof meta.creationDetailViewType === 'string' 
    ? (meta.creationDetailViewType as 'book' | 'session' | 'testimonial')
    : undefined
  
  // Wenn creationTypeId fehlt, ist es nicht resume-fähig (Backward Compatibility)
  if (!creationTypeId || !creationTemplateId || !creationDetailViewType) {
    return null
  }
  
  // Validiere creationDetailViewType
  if (!['book', 'session', 'testimonial'].includes(creationDetailViewType)) {
    return null
  }
  
  // Parse textSources (muss Array von Strings sein)
  let textSources: string[] | undefined
  if (Array.isArray(meta.textSources)) {
    textSources = meta.textSources
      .map(item => typeof item === 'string' ? item : String(item))
      .filter(item => item.trim().length > 0)
    if (textSources.length === 0) {
      textSources = undefined
    }
  }
  
  // Optional: templateName
  const templateName = typeof meta.templateName === 'string' && meta.templateName.trim().length > 0
    ? meta.templateName.trim()
    : undefined
  
  return {
    creationTypeId,
    creationTemplateId,
    creationDetailViewType,
    textSources,
    templateName,
  }
}

