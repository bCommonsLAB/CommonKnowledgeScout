/**
 * @fileoverview Library Creation-Konfiguration
 * 
 * @description
 * Hilfsfunktionen zum Laden und Validieren der Creation-Konfiguration.
 * Creation-Typen werden direkt aus MongoDB-Templates abgeleitet (Templates mit creation-Block).
 */

import type { ParsedTemplate, TemplateDocument } from './template-types'

/**
 * Creation-Typ-Definition aus Template
 */
export interface LibraryCreationType {
  id: string
  label: string
  description: string
  templateId: string
  icon?: string
}

/**
 * Leitet einen Anzeigenamen aus dem Template-Namen ab.
 * 
 * Beispiele:
 * - "Session_analyze_en" → "Session"
 * - "Event_Create" → "Event"
 * - "testimonial_template" → "Testimonial"
 */
function deriveDisplayNameFromTemplateName(templateName: string): string {
  // Entferne Suffixe wie "_analyze_en", "_template", "_create"
  const name = templateName
    .replace(/_(analyze|template|create|en|de)$/i, '')
    .replace(/_/g, ' ')
  
  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/**
 * Leitet ein Icon aus dem Template-Namen ab.
 * 
 * Beispiele:
 * - "Session_*" → "FileText"
 * - "Event_*" → "Calendar"
 * - "Testimonial_*" → "MessageSquare"
 * - "Job_*" → "Briefcase"
 */
function deriveIconFromTemplateName(templateName: string): string | undefined {
  const lowerName = templateName.toLowerCase()
  
  // Pattern-Matching für bekannte Typen
  if (lowerName.includes('session') || lowerName.includes('talk') || lowerName.includes('presentation')) {
    return 'FileText'
  }
  if (lowerName.includes('event') || lowerName.includes('conference') || lowerName.includes('meeting')) {
    return 'Calendar'
  }
  if (lowerName.includes('testimonial') || lowerName.includes('review') || lowerName.includes('quote')) {
    return 'MessageSquare'
  }
  if (lowerName.includes('job') || lowerName.includes('position') || lowerName.includes('career')) {
    return 'Briefcase'
  }
  if (lowerName.includes('book') || lowerName.includes('article') || lowerName.includes('document')) {
    return 'BookOpen'
  }
  
  // Default: FileText
  return 'FileText'
}

/**
 * Lädt die Creation-Typen direkt aus MongoDB-Templates.
 * Filtert Templates mit creation-Block und konvertiert sie zu Creation-Typen.
 * 
 * @param libraryId Library-ID
 * @returns Array von Creation-Typen
 */
export async function getLibraryCreationConfig(libraryId: string): Promise<LibraryCreationType[]> {
  try {
    // Lade alle Templates der Library
    const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(libraryId)}`)
    if (!response.ok) {
      console.error('[getLibraryCreationConfig] Fehler beim Laden der Templates:', response.status)
      return []
    }
    
    const data = await response.json()
    const templates: TemplateDocument[] = data.templates || []
    
    // Filtere Templates mit creation-Block und konvertiere zu Creation-Typen
    const creationTypes: LibraryCreationType[] = templates
      .filter(template => 
        template.creation && 
        template.creation.supportedSources.length > 0 &&
        template.creation.flow.steps.length > 0
      )
      .map(template => {
        const templateName = template.name
        const creation = template.creation!
        const firstStep = creation.flow.steps[0]
        
        // UI-Metadaten aus creation.ui oder Fallbacks
        const displayName = creation.ui?.displayName || firstStep?.title || deriveDisplayNameFromTemplateName(templateName)
        const description = creation.ui?.description || firstStep?.description || `Erstelle ${displayName} mit diesem Template`
        const icon = creation.ui?.icon || deriveIconFromTemplateName(templateName)
        
        return {
          id: templateName.toLowerCase().replace(/[^a-z0-9]/g, '-'), // Slug-ähnliche ID
          label: displayName,
          description: description,
          templateId: templateName,
          icon: icon,
        }
      })
    
    return creationTypes
  } catch (error) {
    console.error('[getLibraryCreationConfig] Fehler:', error)
    return []
  }
}

/**
 * Validiert, ob ein Template für einen Creation-Typ verwendet werden kann
 * (Template muss einen creation-Block haben)
 */
export function isTemplateCreationReady(template: ParsedTemplate | TemplateDocument): boolean {
  return !!template.creation && 
         template.creation.supportedSources.length > 0 &&
         template.creation.flow.steps.length > 0
}

/**
 * Findet einen Creation-Typ in den Templates einer Library
 */
export async function findCreationType(
  libraryId: string,
  typeId: string
): Promise<LibraryCreationType | undefined> {
  const types = await getLibraryCreationConfig(libraryId)
  return types.find(t => t.id === typeId)
}

/**
 * Validiert eine Creation-Typ-Konfiguration
 */
export function validateCreationType(type: LibraryCreationType): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!type.id || type.id.trim().length === 0) {
    errors.push('ID ist erforderlich')
  }
  
  if (!type.label || type.label.trim().length === 0) {
    errors.push('Label ist erforderlich')
  }
  
  if (!type.templateId || type.templateId.trim().length === 0) {
    errors.push('Template-ID ist erforderlich')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Lädt ein Template-Dokument für einen Creation-Typ
 * 
 * @param libraryId Library-ID
 * @param typeId Creation-Typ-ID
 * @returns TemplateDocument oder null wenn nicht gefunden
 */
export async function loadCreationTypeTemplate(
  libraryId: string,
  typeId: string
): Promise<TemplateDocument | null> {
  try {
    const creationType = await findCreationType(libraryId, typeId)
    if (!creationType) {
      return null
    }
    
    // Lade Template-Config über API
    const response = await fetch(
      `/api/templates/${encodeURIComponent(creationType.templateId)}/config?libraryId=${encodeURIComponent(libraryId)}`
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.template || null
  } catch (error) {
    console.error('[loadCreationTypeTemplate] Fehler:', error)
    return null
  }
}

