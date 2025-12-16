/**
 * Utility-Funktionen zum Finden von Testimonials, die zu einem Dialograum gehören
 */

import type { StorageProvider } from '@/lib/storage/types'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import type { StorageItem } from '@/lib/storage/types'

export interface RelatedTestimonial {
  fileId: string
  fileName: string
  author_name?: string
  author_role?: string
  teaser?: string
  dialograum_id?: string
}

export interface DiscoveryOptions {
  /** Storage Provider */
  provider: StorageProvider
  /** File-ID der Dialograum-Datei */
  startFileId: string
  /** Optional: Explizite dialograum_id (wenn nicht aus startFileId geladen werden soll) */
  dialograumId?: string
  /** Optional: Scope-Ordner für Suche (Default: Ordner der startFileId) */
  scopeFolderId?: string
  /** Optional: Library-ID für Filterung */
  libraryId?: string
}

/**
 * Findet alle Testimonials, die zu einem Dialograum gehören.
 * 
 * Strategie:
 * 1. Lade Dialograum-Datei → parseFrontmatter → `dialograum_id`
 * 2. Scanne relevante Dateien (Default: Ordner der Dialograum-Datei)
 * 3. Parse Frontmatter jeder Markdown-Datei und filtere:
 *    - `creationTypeId` == Testimonial-Type ODER `creationDetailViewType == testimonial`
 *    - `dialograum_id` match
 * 
 * @param options Discovery-Optionen
 * @returns Array von gefundenen Testimonials
 */
export async function findRelatedTestimonials(
  options: DiscoveryOptions
): Promise<RelatedTestimonial[]> {
  const { provider, startFileId, dialograumId: explicitDialograumId, scopeFolderId, 
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    libraryId: _unused_libraryId } = options
  
  try {
    // 1. Lade Dialograum-Datei, um dialograum_id zu extrahieren
    let targetDialograumId: string | undefined = explicitDialograumId
    
    if (!targetDialograumId) {
      try {
        const dialograumItem = await provider.getItemById(startFileId)
        if (!dialograumItem) {
          console.warn('[findRelatedTestimonials] Dialograum-Datei nicht gefunden:', startFileId)
          return []
        }
        
        // Lade Content und parse Frontmatter
        const { blob } = await provider.getBinary(startFileId)
        const content = await blob.text()
        const { meta } = parseFrontmatter(content)
        
        targetDialograumId = typeof meta.dialograum_id === 'string' 
          ? meta.dialograum_id.trim() 
          : undefined
        
        if (!targetDialograumId) {
          console.warn('[findRelatedTestimonials] Keine dialograum_id in Dialograum-Datei gefunden')
          return []
        }
      } catch (error) {
        console.error('[findRelatedTestimonials] Fehler beim Laden der Dialograum-Datei:', error)
        return []
      }
    }
    
    // 2. Bestimme Scope-Ordner (Default: Ordner der Dialograum-Datei)
    let searchFolderId: string
    if (scopeFolderId) {
      searchFolderId = scopeFolderId
    } else {
      try {
        const dialograumItem = await provider.getItemById(startFileId)
        searchFolderId = dialograumItem?.parentId || 'root'
      } catch {
        searchFolderId = 'root'
      }
    }
    
    // 3. Scanne Dateien im Scope-Ordner (rekursiv: Ordner + direkte Unterordner)
    const itemsToScan: StorageItem[] = []
    
    async function scanFolder(folderId: string, depth: number = 0) {
      if (depth > 1) return // Max 1 Ebene tief (Ordner + direkte Unterordner)
      
      try {
        const items = await provider.listItemsById(folderId)
        for (const item of items) {
          if (item.type === 'file') {
            // Nur Markdown-Dateien scannen
            const name = item.metadata.name || ''
            if (name.toLowerCase().endsWith('.md') || name.toLowerCase().endsWith('.markdown')) {
              itemsToScan.push(item)
            }
          } else if (item.type === 'folder' && depth === 0) {
            // Rekursiv Unterordner scannen (nur eine Ebene tief)
            await scanFolder(item.id, depth + 1)
          }
        }
      } catch (error) {
        console.error(`[findRelatedTestimonials] Fehler beim Scannen von Ordner ${folderId}:`, error)
      }
    }
    
    await scanFolder(searchFolderId)
    
    // 4. Parse Frontmatter jeder Datei und filtere Testimonials
    const testimonials: RelatedTestimonial[] = []
    
    for (const item of itemsToScan) {
      // Überspringe die Dialograum-Datei selbst
      if (item.id === startFileId) continue
      
      try {
        const { blob } = await provider.getBinary(item.id)
        const content = await blob.text()
        const { meta } = parseFrontmatter(content)
        
        // Prüfe, ob es ein Testimonial ist
        const creationTypeId = typeof meta.creationTypeId === 'string' ? meta.creationTypeId.trim() : undefined
        const creationDetailViewType = typeof meta.creationDetailViewType === 'string' 
          ? meta.creationDetailViewType 
          : undefined
        const itemDialograumId = typeof meta.dialograum_id === 'string' ? meta.dialograum_id.trim() : undefined
        
        const isTestimonial = 
          creationDetailViewType === 'testimonial' ||
          creationTypeId === 'testimonial-creation-de' ||
          (typeof creationTypeId === 'string' && creationTypeId.includes('testimonial'))
        
        // Prüfe, ob dialograum_id matcht
        if (isTestimonial && itemDialograumId === targetDialograumId) {
          testimonials.push({
            fileId: item.id,
            fileName: item.metadata.name || 'unbekannt',
            author_name: typeof meta.author_name === 'string' ? meta.author_name : undefined,
            author_role: typeof meta.author_role === 'string' ? meta.author_role : undefined,
            teaser: typeof meta.teaser === 'string' ? meta.teaser : undefined,
            dialograum_id: itemDialograumId,
          })
        }
      } catch (error) {
        // Überspringe Dateien, die nicht geparst werden können
        console.debug(`[findRelatedTestimonials] Überspringe Datei ${item.id}:`, error)
      }
    }
    
    return testimonials
  } catch (error) {
    console.error('[findRelatedTestimonials] Fehler:', error)
    return []
  }
}

