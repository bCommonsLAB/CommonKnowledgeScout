/**
 * @fileoverview MongoDB Template Service - Server-side only
 * 
 * @description
 * Server-side MongoDB operations for templates.
 * Diese Datei darf NICHT in Client-Komponenten importiert werden!
 * Verwende stattdessen die API-Routes (/api/templates).
 */

import type { TemplateDocument } from './template-types'
import { TemplateRepository } from '@/lib/repositories/template-repo'
import { parseTemplate } from './template-parser'
import { injectCreationIntoFrontmatter } from './template-frontmatter-utils'

/**
 * Lädt alle Templates einer Library aus MongoDB
 * 
 * @param libraryId Library-ID
 * @param userEmail User-Email für Berechtigungsprüfung
 * @param isAdmin Optional: Ob User Admin ist
 * @returns Array von Template-Dokumenten
 */
export async function listTemplatesFromMongoDB(
  libraryId: string,
  userEmail: string,
  isAdmin?: boolean
): Promise<TemplateDocument[]> {
  return await TemplateRepository.findByLibraryId(libraryId, userEmail, isAdmin)
}

/**
 * Lädt ein Template aus MongoDB
 * 
 * @param templateId Template-ID
 * @param libraryId Library-ID
 * @param userEmail User-Email für Berechtigungsprüfung
 * @param isAdmin Optional: Ob User Admin ist
 * @returns Template-Dokument oder null
 */
export async function loadTemplateFromMongoDB(
  templateId: string,
  libraryId: string,
  userEmail: string,
  isAdmin?: boolean
): Promise<TemplateDocument | null> {
  return await TemplateRepository.findById(templateId, libraryId, userEmail, isAdmin)
}

/**
 * Speichert ein Template in MongoDB
 * 
 * @param template Template-Dokument (ohne _id, createdAt, updatedAt, version)
 * @returns Erstelltes Template-Dokument
 */
export async function saveTemplateToMongoDB(
  template: Omit<TemplateDocument, '_id' | 'createdAt' | 'updatedAt' | 'version'>
): Promise<TemplateDocument> {
  return await TemplateRepository.create(template)
}

/**
 * Aktualisiert ein Template in MongoDB
 * 
 * @param templateId Template-ID
 * @param libraryId Library-ID
 * @param updates Teilweise Updates
 * @param userEmail User-Email für Berechtigungsprüfung
 * @param isAdmin Optional: Ob User Admin ist
 * @returns Aktualisiertes Template oder null
 */
export async function updateTemplateInMongoDB(
  templateId: string,
  libraryId: string,
  updates: Partial<Omit<TemplateDocument, '_id' | 'createdAt' | 'version'>>,
  userEmail: string,
  isAdmin?: boolean
): Promise<TemplateDocument | null> {
  return await TemplateRepository.update(templateId, libraryId, updates, userEmail, isAdmin)
}

/**
 * Löscht ein Template aus MongoDB
 * 
 * @param templateId Template-ID
 * @param libraryId Library-ID
 * @param userEmail User-Email für Berechtigungsprüfung
 * @param isAdmin Optional: Ob User Admin ist
 * @returns true wenn gelöscht
 */
export async function deleteTemplateFromMongoDB(
  templateId: string,
  libraryId: string,
  userEmail: string,
  isAdmin?: boolean
): Promise<boolean> {
  return await TemplateRepository.delete(templateId, libraryId, userEmail, isAdmin)
}

/**
 * Serialisiert ein Template-Dokument zu Markdown/YAML-Format
 * 
 * Konvertiert ein TemplateDocument zurück in das Markdown-Format für:
 * - Export zu Storage
 * - Secretary Service Kompatibilität
 * 
 * @param template Template-Dokument
 * @param includeCreation Ob creation-Block enthalten sein soll (false für Secretary Service)
 * @returns Markdown-String
 */
export function serializeTemplateToMarkdown(
  template: TemplateDocument,
  includeCreation: boolean = true
): string {
  // 1. Frontmatter aus metadata.fields generieren
  const frontmatterLines: string[] = []
  for (const field of template.metadata.fields) {
    // Verwende rawValue wenn vorhanden, sonst generiere aus variable und description
    if (field.rawValue) {
      frontmatterLines.push(`${field.key}: ${field.rawValue}`)
    } else {
      frontmatterLines.push(`${field.key}: {{${field.variable}|${field.description}}}`)
    }
  }
  
  // 1.5. detailViewType hinzufügen (falls gesetzt)
  if (template.metadata.detailViewType) {
    frontmatterLines.push(`detailViewType: ${template.metadata.detailViewType}`)
  }
  
  let frontmatter = `---\n${frontmatterLines.join('\n')}\n---`
  
  // 2. creation-Block hinzufügen (falls gewünscht und vorhanden)
  if (includeCreation && template.creation) {
    frontmatter = injectCreationIntoFrontmatter(frontmatter, template.creation)
  } else if (!includeCreation) {
    // Entferne creation-Block explizit (für Secretary Service)
    frontmatter = injectCreationIntoFrontmatter(frontmatter, null)
  }
  
  // 3. Markdown-Body anhängen (kann leer sein)
  // 4. systemprompt-Block anhängen
  const systemPromptPart = template.systemprompt ? `\n\n--- systemprompt\n${template.systemprompt}` : ''
  // Wenn markdownBody leer ist, füge trotzdem eine leere Zeile hinzu für korrekte Formatierung
  const bodyPart = template.markdownBody || ''
  return `${frontmatter}\n\n${bodyPart}${systemPromptPart}`
}

/**
 * Deserialisiert ein Template aus Markdown/YAML zu TemplateDocument
 * 
 * Konvertiert ein Markdown-Template in ein TemplateDocument für MongoDB-Storage.
 * 
 * @param content Markdown-Content
 * @param name Template-Name
 * @param libraryId Library-ID
 * @param userEmail User-Email
 * @returns Template-Dokument
 */
export function deserializeTemplateFromMarkdown(
  content: string,
  name: string,
  libraryId: string,
  userEmail: string
): TemplateDocument {
  // Nutzt bestehenden parseTemplate()
  const { template, errors } = parseTemplate(content, name)
  
  if (errors.length > 0) {
    console.warn('[deserializeTemplateFromMarkdown] Parsing-Fehler:', errors)
  }
  
  const now = new Date()
  
  // Generiere kombinierte _id aus libraryId und name (konsistent mit TemplateRepository)
  const templateId = `${libraryId}:${template.name}`
  
  return {
    _id: templateId, // Kombiniere libraryId und name für eindeutige _id
    name: template.name,
    libraryId,
    user: userEmail,
    metadata: template.metadata,
    systemprompt: template.systemprompt,
    markdownBody: template.markdownBody,
    creation: template.creation,
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}









