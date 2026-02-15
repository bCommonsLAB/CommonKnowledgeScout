/**
 * @fileoverview MongoDB Template Service - Server-side only
 * 
 * @description
 * Server-side MongoDB operations for templates.
 * Diese Datei darf NICHT in Client-Komponenten importiert werden!
 * Verwende stattdessen die API-Routes (/api/templates).
 */

import type { TemplateDocument, TemplateMetadataField } from './template-types'
import { TemplateRepository } from '@/lib/repositories/template-repo'
import { parseTemplate } from './template-parser'
import { injectCreationIntoFrontmatter } from './template-frontmatter-utils'

// ═══════════════════════════════════════════════════════════════════════════════
// ANTWORTSCHEMA-GENERIERUNG
// 
// Das LLM verwendet das "Antwortschema:" im Systemprompt als Vorlage für die 
// JSON-Struktur. Früher wurde dieses manuell im Systemprompt gepflegt, was zu
// Inkonsistenzen führte (z.B. "handlungsfeld" im Schema, aber "category" in Metadata).
//
// Jetzt wird das Schema AUTOMATISCH aus den Metadaten-Feldern generiert und am
// Ende des Systemprompts eingefügt. Ein manuell geschriebenes Schema wird erkannt
// und entfernt, um Duplikate zu vermeiden.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generiert ein JSON-Schema-Objekt aus Template-Metadaten-Feldern.
 * 
 * Das Schema wird als Prosa-Block formatiert, damit das LLM die erwartete
 * Struktur der Antwort kennt.
 * 
 * @param fields Template-Metadaten-Felder
 * @returns Formatiertes Schema als String
 */
function generateResponseSchemaFromFields(fields: TemplateMetadataField[]): string {
  const schemaObj: Record<string, string> = {}
  
  for (const field of fields) {
    // Verwende variable als Key (oder key als Fallback)
    const key = field.variable || field.key
    
    // Bestimme Typ-Beschreibung basierend auf rawValue oder description
    let typeDesc = 'string'
    const raw = field.rawValue || ''
    const desc = field.description || ''
    
    // Spezialtypen erkennen
    if (raw.includes('[]') || desc.toLowerCase().includes('array')) {
      typeDesc = 'string[]'
    } else if (raw.includes('number') || desc.toLowerCase().includes('zahl') || desc.toLowerCase().includes('nummer')) {
      typeDesc = 'number | null'
    } else if (desc) {
      // Beschreibung als Typ-Hinweis verwenden
      // WICHTIG: Limit auf 200 Zeichen erhöht, damit präzise Enum-Werte und
      // Formatvorgaben (z.B. "preisliste | produktdatenblatt | ...") nicht abgeschnitten werden.
      // Das alte Limit von 60 Zeichen hat dazu geführt, dass der Secretary Service
      // weniger präzise Feldbeschreibungen bekam als im Template formuliert.
      const shortDesc = desc.length > 200 ? desc.substring(0, 197) + '...' : desc
      typeDesc = `string (${shortDesc})`
    }
    
    schemaObj[key] = typeDesc
  }
  
  // Formatiere als lesbaren JSON-String
  const lines = Object.entries(schemaObj).map(([key, type]) => `  "${key}": "${type}"`)
  return `{\n${lines.join(',\n')}\n}`
}

/**
 * Fügt das automatisch generierte Antwortschema zum Systemprompt hinzu.
 * 
 * Das generierte Schema wird am Ende des Systemprompts angehängt.
 * Der bestehende Systemprompt bleibt unverändert erhalten.
 * 
 * @param systemprompt Original-Systemprompt (wird nicht verändert)
 * @param fields Template-Metadaten-Felder
 * @returns Systemprompt mit automatisch generiertem Schema am Ende
 */
function appendGeneratedResponseSchema(
  systemprompt: string,
  fields: TemplateMetadataField[]
): string {
  if (!systemprompt || fields.length === 0) {
    return systemprompt
  }
  
  // Generiere Schema aus Feldern
  const generatedSchema = generateResponseSchemaFromFields(fields)
  
  // Hänge am Ende an mit klarer Kennzeichnung
  // WICHTIG: Diese Anweisung überschreibt ein evtl. manuell geschriebenes Schema,
  // da das LLM die letzte Anweisung priorisiert.
  const schemaSection = `

---
WICHTIG - Verbindliches Antwortschema (automatisch aus Template-Metadaten generiert):
Verwende EXAKT diese Feldnamen in deiner JSON-Antwort:

${generatedSchema}`
  
  return systemprompt + schemaSection
}

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
 * WICHTIG für Secretary Service (includeCreation=false):
 * Das Antwortschema wird AUTOMATISCH aus den Metadaten-Feldern generiert und
 * an den Systemprompt angehängt. Ein manuell geschriebenes Schema im Original-
 * Systemprompt wird dabei entfernt, um Inkonsistenzen zu vermeiden.
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
  const bodyPart = template.markdownBody || ''
  
  // 4. Systemprompt-Block anhängen
  // Für Secretary Service (includeCreation=false): Antwortschema automatisch generieren
  let systemPromptPart = ''
  if (template.systemprompt) {
    if (!includeCreation && template.metadata.fields.length > 0) {
      // Secretary Service Modus: Schema automatisch generieren und anhängen
      // Das entfernt manuell geschriebene Schemas und ersetzt sie durch das generierte
      const enhancedSystemprompt = appendGeneratedResponseSchema(
        template.systemprompt,
        template.metadata.fields
      )
      systemPromptPart = `\n\n--- systemprompt\n${enhancedSystemprompt}`
    } else {
      // Export-Modus: Original-Systemprompt beibehalten
      systemPromptPart = `\n\n--- systemprompt\n${template.systemprompt}`
    }
  }
  
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









