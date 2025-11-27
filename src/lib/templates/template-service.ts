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
  const chosen = chosenName ? pickByName(chosenName) : undefined
  const isPreferred = !!chosen
  
  // 2. KEIN FALLBACK - Wenn kein Template gefunden wurde, Fehler werfen
  if (!chosen) {
    const availableTemplates = tplItems
      .filter(it => it.type === 'file' && (it as { metadata?: { name?: string } }).metadata?.name?.endsWith('.md'))
      .map(it => ((it as { metadata?: { name?: string } }).metadata?.name || '').replace(/\.md$/, ''))
      .filter(name => name.length > 0)
    
    const errorMessage = preferredTemplate
      ? `Template "${preferredTemplate}" nicht gefunden. Verfügbare Templates: ${availableTemplates.length > 0 ? availableTemplates.join(', ') : '(keine)'}`
      : `Kein Template angegeben. Verfügbare Templates: ${availableTemplates.length > 0 ? availableTemplates.join(', ') : '(keine)'}`
    
    // Trace-Event für Fehler (falls repo verfügbar)
    if (repo && jobId) {
      try {
        await repo.traceAddEvent(jobId, {
          spanId: 'template',
          name: 'template_not_found',
          attributes: {
            preferredTemplate: preferredTemplate || '(nicht gesetzt)',
            availableTemplates,
            error: errorMessage
          }
        })
      } catch {}
    }
    
    throw new TemplateNotFoundError(errorMessage, preferredTemplate, availableTemplates)
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

