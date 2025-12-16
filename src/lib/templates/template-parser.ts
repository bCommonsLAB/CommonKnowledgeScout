/**
 * @fileoverview Template-Parser
 * 
 * @description
 * Parser für Template-Dateien, die aus dem Storage geladen werden.
 * Extrahiert Frontmatter, Markdown Body, Systemprompt und optional den creation-Block.
 */

import type { ParsedTemplate, TemplateMetadataSchema, TemplateMetadataField, TemplateCreationConfig, TemplateValidationError, CreationFlowStepPreset } from './template-types'
import { extractCreationFromFrontmatter } from './template-frontmatter-utils'

/**
 * Parst ein Template aus rohem Markdown-Content
 * 
 * @param content Roher Template-Content (Markdown mit Frontmatter)
 * @param name Template-Name (Dateiname ohne .md)
 * @returns Parsed Template oder Fehler
 */
export function parseTemplate(
  content: string,
  name: string
): { template: ParsedTemplate; errors: TemplateValidationError[] } {
  const errors: TemplateValidationError[] = []
  
  // 1. Teile Content in Bereiche auf
  const parts = content.split('--- systemprompt')
  const mainContent = parts[0]?.trim() || ''
  const systemPrompt = parts[1]?.trim() || ''
  
  // 2. Extrahiere Frontmatter
  const frontmatterMatch = mainContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  let rawFrontmatter = ''
  let markdownBody = ''
  
  if (frontmatterMatch) {
    rawFrontmatter = `---\n${frontmatterMatch[1]}\n---`
    markdownBody = frontmatterMatch[2]?.trim() || ''
  } else {
    // Kein Frontmatter gefunden - gesamter Content ist Body
    markdownBody = mainContent
  }
  
  // 3. Parse Frontmatter-Felder
  const metadataFields = parseFrontmatterFields(rawFrontmatter)
  const metadata: TemplateMetadataSchema = {
    fields: metadataFields,
    rawFrontmatter
  }
  
  // 4. Versuche creation-Block aus Frontmatter zu extrahieren
  let creation: TemplateCreationConfig | undefined
  try {
    creation = extractCreationFromFrontmatter(rawFrontmatter) ?? undefined
  } catch (error) {
    errors.push({
      field: 'creation',
      message: `Fehler beim Parsen des creation-Blocks: ${error instanceof Error ? error.message : String(error)}`
    })
  }
  
  const template: ParsedTemplate = {
    name,
    metadata,
    systemprompt: systemPrompt,
    markdownBody,
    creation,
    rawContent: content
  }
  
  return { template, errors }
}

/**
 * Parst Frontmatter-Felder aus YAML-String
 * Überspringt den creation-Block, da dieser verschachtelt ist
 */
function parseFrontmatterFields(frontmatter: string): TemplateMetadataField[] {
  const fields: TemplateMetadataField[] = []
  
  if (!frontmatter || !frontmatter.trim()) {
    return fields
  }
  
  // Entferne --- Marker (unterstützt sowohl \n als auch \r\n)
  const yamlContent = frontmatter.replace(/^---\r?\n/, '').replace(/\r?\n---$/, '')
  const lines = yamlContent.split(/\r?\n/)
  
  let inCreationBlock = false
  let creationIndent = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    
    // Prüfe, ob wir den creation-Block erreichen
    if (trimmed === 'creation:' || trimmed.startsWith('creation:')) {
      inCreationBlock = true
      creationIndent = line.length - line.trimStart().length
      continue
    }
    
    // Wenn wir im creation-Block sind, überspringe alle eingerückten Zeilen
    if (inCreationBlock) {
      const currentIndent = line.length - line.trimStart().length
      // Wenn Einrückung zurückgeht (gleich oder weniger), sind wir aus dem Block raus
      if (trimmed && currentIndent <= creationIndent) {
        inCreationBlock = false
        // Fallthrough zur normalen Verarbeitung
      } else {
        // Immer noch im creation-Block (eingerückt oder leer), überspringe
        continue
      }
    }
    
    // Leere Zeilen überspringen
    if (!trimmed) continue
    
    // Suche nach Felddefinitionen mit Variable-Token: `key: {{variable|description}}`
    const fieldMatch = line.match(/^(\w+):\s*(.+)$/)
    if (!fieldMatch) continue
    
    const key = fieldMatch[1].trim()
    const value = fieldMatch[2].trim()
    
    // Prüfe auf Variable-Token
    const varMatch = value.match(/\{\{([^}|]+)\|([^}]+)\}\}/)
    if (varMatch) {
      const variable = varMatch[1].trim()
      const description = varMatch[2].trim()
      
      fields.push({
        key,
        variable,
        description,
        rawValue: value
      })
    } else {
      // Feld ohne Variable-Token (einfacher Wert)
      fields.push({
        key,
        variable: key,
        description: '',
        rawValue: value
      })
    }
  }
  
  return fields
}

/**
 * Parst creation-Block aus Frontmatter-Objekt
 * @deprecated Nicht verwendet - kann entfernt werden wenn nicht mehr benötigt
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unused_parseCreationConfig(
  creationObj: unknown,
  errors: TemplateValidationError[]
): TemplateCreationConfig | undefined {
  if (!creationObj || typeof creationObj !== 'object') {
    return undefined
  }
  
  const obj = creationObj as Record<string, unknown>
  
  // Parse supportedSources
  const supportedSources: TemplateCreationConfig['supportedSources'] = []
  if (Array.isArray(obj.supportedSources)) {
    for (const source of obj.supportedSources) {
      if (source && typeof source === 'object') {
        const src = source as Record<string, unknown>
        if (typeof src.id === 'string' && typeof src.type === 'string' && typeof src.label === 'string') {
          supportedSources.push({
            id: src.id,
            type: src.type as TemplateCreationConfig['supportedSources'][0]['type'],
            label: src.label,
            helpText: typeof src.helpText === 'string' ? src.helpText : undefined
          })
        } else {
          errors.push({
            field: 'creation.supportedSources',
            message: 'Ungültige Source-Definition: id, type und label sind erforderlich'
          })
        }
      }
    }
  }
  
  // Parse flow.steps
  const steps: TemplateCreationConfig['flow']['steps'] = []
  if (obj.flow && typeof obj.flow === 'object') {
    const flow = obj.flow as Record<string, unknown>
    if (Array.isArray(flow.steps)) {
      for (const step of flow.steps) {
        if (step && typeof step === 'object') {
          const stepObj = step as Record<string, unknown>
          if (typeof stepObj.id === 'string' && typeof stepObj.preset === 'string') {
            steps.push({
              id: stepObj.id,
              preset: stepObj.preset as CreationFlowStepPreset,
              fields: Array.isArray(stepObj.fields) 
                ? stepObj.fields.filter((f): f is string => typeof f === 'string')
                : undefined
            })
          } else {
            errors.push({
              field: 'creation.flow.steps',
              message: 'Ungültige Step-Definition: id und preset sind erforderlich'
            })
          }
        }
      }
    }
  }
  
  // Parse imageFields
  const imageFields: TemplateCreationConfig['imageFields'] = []
  if (Array.isArray(obj.imageFields)) {
    for (const field of obj.imageFields) {
      if (field && typeof field === 'object') {
        const f = field as Record<string, unknown>
        if (typeof f.key === 'string' && f.key.length > 0) {
          imageFields.push({
            key: f.key,
            label: typeof f.label === 'string' ? f.label : undefined,
            multiple: typeof f.multiple === 'boolean' ? f.multiple : undefined
          })
        } else {
          errors.push({
            field: 'creation.imageFields',
            message: 'Ungültige ImageField-Definition: key ist erforderlich'
          })
        }
      }
    }
  }
  
  const result: TemplateCreationConfig = {
    supportedSources,
    flow: { steps }
  }
  
  if (imageFields.length > 0) {
    result.imageFields = imageFields
  }
  
  return result
}

