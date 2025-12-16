/**
 * @fileoverview Zentrale Template-Service Library
 * 
 * @description
 * Zentrale Library für Template-Verwaltung. Stellt sicher, dass Templates konsistent
 * aus den richtigen Quellen geladen werden:
 * - Server-seitig: Library-Config (secretaryService.pdfDefaults.template)
 * - Client-seitig: Jotai Atom (pdfOverridesAtom) mit Fallback auf Library-Config
 * 
 * WICHTIG: Keine Fallback-Logik - wenn kein Template gefunden wird, wird ein Fehler geworfen.
 * 
 * @module templates
 */

import type { ExternalJobsRepository } from '@/lib/external-jobs-repository'
import { parseTemplate } from './template-parser'
import type { ParsedTemplate, UxConfig, PromptConfig } from './template-types'
import { injectCreationIntoFrontmatter } from './template-frontmatter-utils'

export interface TemplateServiceProvider {
  listItemsById(parentId: string): Promise<Array<{ id: string; type: string; metadata?: { name?: string } }>>
  createFolder(parentId: string, name: string): Promise<{ id: string }>
  getBinary(itemId: string): Promise<{ blob: Blob; mimeType?: string }>
}

export interface LoadTemplateArgs {
  provider: TemplateServiceProvider
  preferredTemplateName?: string
  repo?: ExternalJobsRepository
  jobId?: string
}

export interface LoadTemplateResult {
  templateContent: string
  templateName: string
  /** Gibt an, ob das Preferred Template gefunden wurde */
  isPreferred: boolean
}

export class TemplateNotFoundError extends Error {
  constructor(
    message: string,
    public readonly preferredTemplate?: string,
    public readonly availableTemplates?: string[]
  ) {
    super(message)
    this.name = 'TemplateNotFoundError'
  }
}

/**
 * Stellt sicher, dass der Templates-Ordner existiert.
 * Erstellt ihn falls nötig.
 * 
 * WICHTIG: Sucht den Templates-Ordner immer im Root-Verzeichnis der Library.
 * Der Root-Ordner ist der Basis-Pfad der Library (z.B. "Archiv Peter").
 */
export async function ensureTemplatesFolderId(provider: TemplateServiceProvider): Promise<string> {
  try {
    const rootItems = await provider.listItemsById('root')
    const templatesFolder = rootItems.find(
      it => it.type === 'folder' && 
      (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates'
    )
    if (templatesFolder) return (templatesFolder as { id: string }).id
    const created = await provider.createFolder('root', 'templates')
    return created.id
  } catch (error) {
    // Fehler beim Zugriff auf Root-Ordner - möglicherweise Netzwerk- oder Berechtigungsproblem
    throw new Error(`Fehler beim Zugriff auf Templates-Ordner: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Lädt alle verfügbaren Templates aus dem /templates Ordner.
 */
export async function listAvailableTemplates(provider: TemplateServiceProvider): Promise<string[]> {
  try {
    const templatesFolderId = await ensureTemplatesFolderId(provider)
    const items = await provider.listItemsById(templatesFolderId)
    return items
      .filter(it => it.type === 'file' && (it as { metadata?: { name?: string } }).metadata?.name?.endsWith('.md'))
      .map(it => ((it as { metadata?: { name?: string } }).metadata?.name || '').replace(/\.md$/, ''))
      .filter(name => name.length > 0)
  } catch {
    return []
  }
}

/**
 * Lädt ein Template aus dem /templates Ordner.
 * 
 * @throws {TemplateNotFoundError} Wenn kein Template gefunden wird
 */
export async function loadTemplate(args: LoadTemplateArgs): Promise<LoadTemplateResult> {
  const { provider, preferredTemplateName, repo, jobId } = args
  
  const templatesFolderId = await ensureTemplatesFolderId(provider)
  const tplItems = await provider.listItemsById(templatesFolderId)
  
  const preferredTemplate = (preferredTemplateName || '').trim()
  const pickByName = (name: string) => 
    tplItems.find(
      it => it.type === 'file' && 
      (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()
    )
  
  // Normalisiere Template-Name (füge .md hinzu falls nicht vorhanden)
  const chosenName = preferredTemplate 
    ? (preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`)
    : ''
  
  // 1. Versuche Preferred Template zu finden
  let chosen = chosenName ? pickByName(chosenName) : undefined
  const isPreferred = !!chosen
  
  // 2. Wenn kein Preferred Template gefunden wurde:
  //    - Wenn Preferred Template angegeben war: Fehler werfen
  //    - Wenn kein Preferred Template angegeben: Versuche Default-Template (pdfanalyse) oder erstes verfügbares Template
  if (!chosen) {
    const availableTemplates = tplItems
      .filter(it => it.type === 'file' && (it as { metadata?: { name?: string } }).metadata?.name?.endsWith('.md'))
      .map(it => ((it as { metadata?: { name?: string } }).metadata?.name || '').replace(/\.md$/, ''))
      .filter(name => name.length > 0)
    
    // Wenn Preferred Template angegeben war, aber nicht gefunden wurde: Fehler werfen
    if (preferredTemplate) {
      const errorMessage = `Template "${preferredTemplate}" nicht gefunden. Verfügbare Templates: ${availableTemplates.length > 0 ? availableTemplates.join(', ') : '(keine)'}`
      
      // Trace-Event für Fehler (falls repo verfügbar)
      if (repo && jobId) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_not_found',
            attributes: {
              preferredTemplate,
              availableTemplates,
              error: errorMessage
            }
          })
        } catch {}
      }
      
      throw new TemplateNotFoundError(errorMessage, preferredTemplate, availableTemplates)
    }
    
    // Wenn kein Preferred Template angegeben: Versuche Default-Template (pdfanalyse) oder erstes verfügbares Template
    if (availableTemplates.length === 0) {
      const errorMessage = `Kein Template angegeben und keine Templates im Templates-Ordner gefunden.`
      
      // Trace-Event für Fehler (falls repo verfügbar)
      if (repo && jobId) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_not_found',
            attributes: {
              preferredTemplate: '(nicht gesetzt)',
              availableTemplates: [],
              error: errorMessage
            }
          })
        } catch {}
      }
      
      throw new TemplateNotFoundError(errorMessage, undefined, [])
    }
    
    // Versuche Default-Template "pdfanalyse" zu finden
    const defaultTemplate = availableTemplates.find(name => name.toLowerCase() === 'pdfanalyse')
    if (defaultTemplate) {
      chosen = pickByName(`${defaultTemplate}.md`)
      if (repo && jobId) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_default_used',
            attributes: {
              preferredTemplate: '(nicht gesetzt)',
              usedTemplate: defaultTemplate,
              availableTemplates
            }
          })
        } catch {}
      }
    } else {
      // Verwende erstes verfügbares Template als Fallback
      const firstTemplate = availableTemplates[0]
      chosen = pickByName(`${firstTemplate}.md`)
      if (repo && jobId) {
        try {
          await repo.traceAddEvent(jobId, {
            spanId: 'template',
            name: 'template_fallback_used',
            attributes: {
              preferredTemplate: '(nicht gesetzt)',
              usedTemplate: firstTemplate,
              availableTemplates
            }
          })
        } catch {}
      }
    }
    
    // Wenn immer noch kein Template gefunden wurde (sollte nicht passieren), Fehler werfen
    if (!chosen) {
      const errorMessage = `Kein Template angegeben und kein Template gefunden. Verfügbare Templates: ${availableTemplates.join(', ')}`
      throw new TemplateNotFoundError(errorMessage, undefined, availableTemplates)
    }
  }
  
  // Template-Inhalt laden
  const bin = await provider.getBinary((chosen as { id: string }).id)
  const templateContent = await bin.blob.text()
  const selectedName = ((chosen as unknown as { metadata?: { name?: string } })?.metadata?.name || 'pdfanalyse.md').replace(/\.md$/, '')
  
  // Trace-Event für Erfolg (falls repo verfügbar)
  if (repo && jobId) {
    try {
      await repo.traceAddEvent(jobId, {
        spanId: 'template',
        name: 'template_selected',
        attributes: {
          preferred: preferredTemplate,
          picked: true,
          templateName: selectedName,
          isPreferred
        }
      })
    } catch {}
  }
  
  return {
    templateContent,
    templateName: selectedName,
    isPreferred
  }
}

/**
 * Parst ein Template aus rohem Content
 * 
 * @param content Roher Template-Content
 * @param name Template-Name
 * @returns Parsed Template mit Validierungsfehlern
 */
export function parseTemplateContent(
  content: string,
  name: string
): { template: ParsedTemplate; errors: Array<{ field: string; message: string; line?: number }> } {
  return parseTemplate(content, name)
}

/**
 * Lädt und parst ein Template
 * 
 * @param args Template-Loading-Argumente
 * @returns Parsed Template
 * @throws {TemplateNotFoundError} Wenn Template nicht gefunden wird
 */
export async function loadAndParseTemplate(args: LoadTemplateArgs): Promise<{
  template: ParsedTemplate
  errors: Array<{ field: string; message: string; line?: number }>
}> {
  const { templateContent, templateName } = await loadTemplate(args)
  const { template, errors } = parseTemplate(templateContent, templateName)
  return { template, errors }
}

/**
 * Erstellt eine UX-Config View für den Creation-Wizard
 * 
 * @param template Parsed Template
 * @returns UX-Config oder null, wenn Template keinen creation-Block hat
 */
export function getUxConfig(template: ParsedTemplate): UxConfig | null {
  if (!template.creation) {
    return null
  }
  
  return {
    templateId: template.name,
    creation: template.creation,
    availableFields: template.metadata.fields.map(f => f.variable)
  }
}

/**
 * Erstellt eine Prompt-Config View für LLM/Secretary
 * 
 * Enthält KEINE UX-spezifischen Daten (kein creation-Block).
 * 
 * @param template Parsed Template
 * @returns Prompt-Config
 */
export function getPromptConfig(template: ParsedTemplate): PromptConfig {
  return {
    templateId: template.name,
    metadata: template.metadata,
    systemprompt: template.systemprompt,
    markdownBody: template.markdownBody
  }
}

/**
 * Serialisiert ein Template ohne creation-Block für den Secretary Service
 * 
 * Entfernt den creation-Block aus dem Frontmatter, bevor das Template
 * an den Secretary Service gesendet wird (der nur flaches YAML unterstützt).
 * 
 * @param templateContent Roher Template-Content (Markdown mit Frontmatter)
 * @returns Template-Content ohne creation-Block
 */
export function serializeTemplateWithoutCreation(templateContent: string): string {
  // Teile Content in Frontmatter und Body auf
  const parts = templateContent.split('--- systemprompt')
  const mainContent = parts[0]?.trim() || ''
  const systemPrompt = parts[1]?.trim() || ''
  
  // Extrahiere Frontmatter
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
  
  // Entferne creation-Block aus Frontmatter
  const frontmatterWithoutCreation = injectCreationIntoFrontmatter(rawFrontmatter, null)
  
  // Baue Template wieder zusammen
  const systemPromptPart = systemPrompt ? `\n\n--- systemprompt\n${systemPrompt}` : ''
  return `${frontmatterWithoutCreation}\n${markdownBody}${systemPromptPart}`
}


