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
 * Schema-Knoten: entweder eine Typ-Beschreibung (Blatt) oder ein
 * verschachteltes Objekt (Branch fuer Dot-Notation-Keys).
 */
type SchemaNode = string | SchemaTree
interface SchemaTree {
  [key: string]: SchemaNode
}

/**
 * Leitet die Typ-Beschreibung eines Feldes aus rawValue/description ab.
 *
 * Reihenfolge: Array → Boolean → Number → String-mit-Hinweis → String.
 */
function determineFieldType(field: TemplateMetadataField): string {
  const raw = field.rawValue || ''
  const desc = field.description || ''
  const lowerDesc = desc.toLowerCase()

  if (raw.includes('[]') || lowerDesc.includes('array')) {
    return 'string[]'
  }
  if (raw.includes('boolean') || lowerDesc.includes('boolean')) {
    return 'boolean'
  }
  if (raw.includes('number') || lowerDesc.includes('zahl') || lowerDesc.includes('nummer')) {
    return 'number | null'
  }
  if (desc) {
    // WICHTIG: Limit auf 200 Zeichen, damit präzise Enum-Werte und
    // Formatvorgaben (z.B. "matte | semi_gloss | glossy") nicht abgeschnitten werden.
    const shortDesc = desc.length > 200 ? desc.substring(0, 197) + '...' : desc
    return `string (${shortDesc})`
  }
  return 'string'
}

/**
 * Fuegt einen Dot-Notation-Key (z.B. "dominantColor.hex") als verschachteltes
 * Blatt in den Schema-Baum ein. Branches werden bei Bedarf angelegt.
 */
function setNestedSchemaLeaf(root: SchemaTree, dottedKey: string, typeDesc: string): void {
  const segments = dottedKey.split('.')
  let cursor = root
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!
    const existing = cursor[seg]
    if (existing === undefined || typeof existing === 'string') {
      // Neuen Branch anlegen (bzw. kollidierendes Skalar-Blatt ersetzen).
      const branch: SchemaTree = {}
      cursor[seg] = branch
      cursor = branch
    } else {
      cursor = existing
    }
  }
  cursor[segments[segments.length - 1]!] = typeDesc
}

/** Serialisiert den Schema-Baum rekursiv als eingerueckten Prosa-JSON-Block. */
function serializeSchemaTree(node: SchemaTree, depth: number): string {
  const indent = '  '.repeat(depth + 1)
  const closingIndent = '  '.repeat(depth)
  const lines = Object.entries(node).map(([key, value]) =>
    typeof value === 'string'
      ? `${indent}"${key}": "${value}"`
      : `${indent}"${key}": ${serializeSchemaTree(value, depth + 1)}`,
  )
  return `{\n${lines.join(',\n')}\n${closingIndent}}`
}

/**
 * Generiert ein JSON-Schema-Objekt aus Template-Metadaten-Feldern.
 *
 * Das Schema wird als Prosa-Block formatiert, damit das LLM die erwartete
 * Struktur der Antwort kennt. Dot-Notation-Keys (z.B. "dominantColor.hex")
 * werden in verschachtelte Objekte aufgeloest.
 *
 * @param fields Template-Metadaten-Felder
 * @returns Formatiertes Schema als String
 */
function generateResponseSchemaFromFields(fields: TemplateMetadataField[]): string {
  const root: SchemaTree = {}

  for (const field of fields) {
    // Hardcodierte Felder (ohne {{}} Placeholder) NICHT ins LLM-Schema aufnehmen.
    // Diese haben description === '' und sind System-Parameter (z.B. detailViewType, docType
    // ohne Placeholder), die das LLM nicht ausfüllen soll.
    // Ohne diesen Filter wird z.B. detailViewType als nacktes "string"-Feld gesendet
    // und das LLM ändert "session" eigenmächtig zu "video".
    if (!field.description || field.description.trim() === '') {
      continue
    }

    // Verwende variable als Key (oder key als Fallback)
    const key = field.variable || field.key
    setNestedSchemaLeaf(root, key, determineFieldType(field))
  }

  return serializeSchemaTree(root, 0)
}

/**
 * Prüft ob der Systemprompt bereits ein handgeschriebenes Response-Schema enthält.
 * 
 * Erkennt typische Marker wie "Antwortschema", "Response Schema" oder
 * JSON-Bloecke mit geschweiften Klammern nach Schema-Ueberschriften.
 * 
 * @param systemprompt Systemprompt-Text
 * @returns true wenn ein handgeschriebenes Schema erkannt wurde
 */
function hasHandwrittenResponseSchema(systemprompt: string): boolean {
  if (!systemprompt) return false
  const lower = systemprompt.toLowerCase()
  // Typische Schema-Marker in Templates (deutsch und englisch)
  return (
    lower.includes('antwortschema') ||
    lower.includes('response schema') ||
    lower.includes('response format')
  )
}

/**
 * Fuegt das automatisch generierte Antwortschema zum Systemprompt hinzu,
 * ABER NUR wenn der Systemprompt kein handgeschriebenes Schema enthaelt.
 * 
 * Templates mit praezisem, handgeschriebenem Schema (z.B. verschachtelte
 * chapters-Struktur, Enum-Typen) behalten ihr Schema unveraendert.
 * Templates ohne Schema bekommen eines aus den Frontmatter-Feldern generiert.
 * 
 * @param systemprompt Original-Systemprompt (wird nicht verändert)
 * @param fields Template-Metadaten-Felder
 * @returns Systemprompt, ggf. mit generiertem Schema am Ende
 */
function appendGeneratedResponseSchema(
  systemprompt: string,
  fields: TemplateMetadataField[]
): string {
  if (!systemprompt || fields.length === 0) {
    return systemprompt
  }
  
  // Wenn der Systemprompt bereits ein handgeschriebenes Schema enthaelt,
  // dieses respektieren und KEIN auto-generiertes anhaengen.
  // Grund: Handgeschriebene Schemas koennen verschachtelte Typen (z.B. chapters),
  // praezise Enums und Union-Types enthalten, die das auto-generierte Schema
  // nicht abbilden kann und sonst widersprüchlich ueberschreiben wuerde.
  if (hasHandwrittenResponseSchema(systemprompt)) {
    return systemprompt
  }
  
  // Kein handgeschriebenes Schema vorhanden: auto-generieren aus Frontmatter-Feldern
  const generatedSchema = generateResponseSchemaFromFields(fields)
  
  const schemaSection = `

---
IMPORTANT - Binding response schema (auto-generated from template metadata):
Use AT LEAST these field names in your JSON response.
If REQUIRED FIELDS contains additional template variables (e.g. from markdown body),
include them as well:

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









