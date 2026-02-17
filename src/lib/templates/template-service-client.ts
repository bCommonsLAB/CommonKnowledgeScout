/**
 * @fileoverview Client-side Template Service für MongoDB-Templates
 * 
 * @description
 * Zentrale Client-Library für den Zugriff auf Templates aus MongoDB.
 * Alle Client-Komponenten sollten diese Funktionen verwenden statt direkter File-System-Zugriffe.
 * 
 * Diese Datei ist Client-seitig sicher (keine MongoDB-Imports).
 */

import type { TemplateDocument } from './template-types'

/**
 * Lädt alle verfügbaren Template-Namen aus MongoDB für eine Library.
 * 
 * @param libraryId Library-ID
 * @returns Array von Template-Namen
 */
export async function listAvailableTemplates(libraryId: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/templates?libraryId=${encodeURIComponent(libraryId)}`)
    if (!response.ok) {
      // 404: Clerk maskiert geschützte Routen für anonyme Nutzer als 404.
      // 401: Nicht authentifiziert. In beiden Fällen: leere Liste zurückgeben statt werfen.
      if (response.status === 404 || response.status === 401) {
        return []
      }
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    const templates = data.templates || []
    return templates.map((t: { name: string }) => t.name)
  } catch (error) {
    console.error('Fehler beim Laden der Templates:', error)
    return []
  }
}

/**
 * Lädt ein Template als strukturiertes Objekt (inkl. creation-Block) aus MongoDB.
 * 
 * @param templateId Template-ID
 * @param libraryId Library-ID
 * @returns TemplateDocument oder null wenn nicht gefunden
 */
export async function loadTemplateConfig(
  templateId: string,
  libraryId: string
): Promise<TemplateDocument | null> {
  try {
    const response = await fetch(
      `/api/templates/${encodeURIComponent(templateId)}/config?libraryId=${encodeURIComponent(libraryId)}`
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    return data.template || null
  } catch (error) {
    console.error('Fehler beim Laden der Template-Config:', error)
    return null
  }
}

/**
 * Lädt ein Template aus MongoDB und gibt es als Markdown-String zurück.
 * 
 * @param args Template-Lade-Argumente
 * @returns Template-Content als Markdown-String und Template-Name
 * @throws Error wenn Template nicht gefunden wird
 */
export async function loadTemplate(args: {
  libraryId: string
  preferredTemplateName?: string
}): Promise<{
  templateContent: string
  templateName: string
  isPreferred: boolean
}> {
  const { libraryId, preferredTemplateName } = args
  
  // Lade alle Templates, um verfügbare zu finden
  const allTemplates = await listAvailableTemplates(libraryId)
  
  // Wenn kein Preferred Template angegeben, verwende Default "pdfanalyse" oder erstes Template
  const templateName = preferredTemplateName || (allTemplates.find(n => n.toLowerCase() === 'pdfanalyse') || allTemplates[0])
  
  if (!templateName) {
    throw new Error(`Kein Template gefunden. Verfügbare Templates: ${allTemplates.length > 0 ? allTemplates.join(', ') : 'keine'}`)
  }
  
  // Lade Template-Content als Markdown von API
  const response = await fetch(
    `/api/templates/${encodeURIComponent(templateName)}/download?libraryId=${encodeURIComponent(libraryId)}`
  )
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Template "${templateName}" nicht gefunden. Verfügbare Templates: ${allTemplates.join(', ') || 'keine'}`)
    }
    throw new Error(`Fehler beim Laden des Templates: HTTP ${response.status}`)
  }
  
  const templateContent = await response.text()
  
  return {
    templateContent,
    templateName,
    isPreferred: !!preferredTemplateName && preferredTemplateName === templateName
  }
}

