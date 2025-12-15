/**
 * @fileoverview Template Import/Export Utilities
 * 
 * @description
 * Funktionen zum Importieren von Templates aus Storage nach MongoDB
 * und Exportieren von Templates aus MongoDB nach Storage.
 */

import type { TemplateServiceProvider } from './template-service'
import { ensureTemplatesFolderId } from './template-service'
import { deserializeTemplateFromMarkdown, saveTemplateToMongoDB, loadTemplateFromMongoDB } from './template-service-mongodb'
import { TemplateRepository } from '@/lib/repositories/template-repo'

/**
 * Importiert ein Template aus Storage nach MongoDB
 * 
 * @param provider Storage Provider
 * @param fileName Template-Dateiname (z.B. "Session_analyze_en.md")
 * @param libraryId Library-ID
 * @param userEmail User-Email
 * @returns Importiertes Template-Dokument
 * @throws Error wenn Template nicht gefunden oder bereits existiert
 */
export async function importTemplateFromStorage(
  provider: TemplateServiceProvider,
  fileName: string,
  libraryId: string,
  userEmail: string
): Promise<{ template: import('@/lib/templates/template-types').TemplateDocument; imported: boolean }> {
  // 1. Templates-Ordner finden
  const templatesFolderId = await ensureTemplatesFolderId(provider)
  
  // 2. Template-Datei finden
  const items = await provider.listItemsById(templatesFolderId)
  const templateFile = items.find(
    it => it.type === 'file' && 
    (it as { metadata?: { name?: string } }).metadata?.name === fileName
  )
  
  if (!templateFile) {
    throw new Error(`Template-Datei "${fileName}" nicht gefunden`)
  }
  
  // 3. Template-Content laden
  const { blob } = await provider.getBinary(templateFile.id)
  const content = await blob.text()
  
  // 4. Template-Name extrahieren (ohne .md)
  const templateName = fileName.replace(/\.md$/, '')
  
  // 5. Prüfe, ob Template bereits in MongoDB existiert
  const exists = await TemplateRepository.exists(templateName, libraryId)
  if (exists) {
    throw new Error(`Template "${templateName}" existiert bereits in MongoDB`)
  }
  
  // 6. Deserialisieren und in MongoDB speichern
  const templateDoc = deserializeTemplateFromMarkdown(content, templateName, libraryId, userEmail)
  const saved = await saveTemplateToMongoDB(templateDoc)
  
  return {
    template: saved,
    imported: true
  }
}

/**
 * Exportiert ein Template aus MongoDB nach Storage
 * 
 * @param provider Storage Provider
 * @param templateId Template-ID
 * @param libraryId Library-ID
 * @param userEmail User-Email
 * @param isAdmin Optional: Ob User Admin ist
 * @returns Exportiertes Template-Dokument
 * @throws Error wenn Template nicht gefunden
 */
export async function exportTemplateToStorage(
  provider: TemplateServiceProvider,
  templateId: string,
  libraryId: string,
  userEmail: string,
  isAdmin?: boolean
): Promise<{ template: import('@/lib/templates/template-types').TemplateDocument; exported: boolean }> {
  // 1. Template aus MongoDB laden
  const template = await loadTemplateFromMongoDB(templateId, libraryId, userEmail, isAdmin)
  if (!template) {
    throw new Error(`Template "${templateId}" nicht gefunden`)
  }
  
  // TODO: Export zu Storage ist aktuell nicht implementiert, da TemplateServiceProvider
  // kein uploadFile-Methode hat. Die Funktion sollte erweitert werden, um StorageProvider
  // direkt zu verwenden oder das TemplateServiceProvider-Interface zu erweitern.
  // 
  // Für zukünftige Implementierung:
  // 1. Zu Markdown serialisieren (mit creation-Block für Export)
  // const markdownContent = serializeTemplateToMarkdown(template, true)
  // 2. Templates-Ordner finden oder erstellen
  // const templatesFolderId = await ensureTemplatesFolderId(provider)
  // 3. Als .md Datei speichern und hochladen
  throw new Error('Export zu Storage ist aktuell nicht implementiert. Bitte verwenden Sie die MongoDB-API direkt.')
  
  // return {
  //   template,
  //   exported: true
  // }
}

/**
 * Listet alle verfügbaren Templates im Storage auf
 * 
 * @param provider Storage Provider
 * @returns Array von Template-Dateinamen
 */
export async function listTemplatesInStorage(provider: TemplateServiceProvider): Promise<string[]> {
  try {
    const templatesFolderId = await ensureTemplatesFolderId(provider)
    const items = await provider.listItemsById(templatesFolderId)
    return items
      .filter(it => it.type === 'file' && (it as { metadata?: { name?: string } }).metadata?.name?.endsWith('.md'))
      .map(it => ((it as { metadata?: { name?: string } }).metadata?.name || ''))
      .filter(name => name.length > 0)
  } catch {
    return []
  }
}

