/**
 * @fileoverview Filter- und Sortier-Regel der Dateiliste — als reine Funktion.
 *
 * @description
 * Die kanonische Logik hinter der Dateiliste: Basis-Filter (versteckte Dateien,
 * Twins, Namenssuche), DIVA-/Annotations-Filter, Kategorie-Filter, Sortierung.
 *
 * Bewusst ohne Jotai: Bis zu dieser Welle steckte dieselbe Regel in einem
 * abgeleiteten Atom, das die aktive Bibliothek mitlas. Die Auswahl der
 * Bibliothek wandert nach `@ks/shell` und ist dort nur noch ueber Hooks
 * erreichbar — ein Atom kann sie nicht mehr lesen. Als reine Funktion bleibt
 * die Regel an einer Stelle und direkt testbar.
 */

import { StorageItem } from '@/lib/storage/types'
import { getFileCategory, type FileCategory } from '@/atoms/transcription-options'
import { isBasecolorFileName } from '@/lib/diva-texture/preprocess-folder'

export type FileListSortField = 'name' | 'size' | 'date' | 'type'
export type FileListSortOrder = 'asc' | 'desc'
export type FileListAnnotationFilter = 'all' | 'with' | 'without'

/** Alles, was die Regel braucht — nichts davon liest sie sich selbst. */
export interface FileListFilterInput {
  files: StorageItem[]
  searchTerm: string
  sortField: FileListSortField
  sortOrder: FileListSortOrder
  categoryFilter: FileCategory
  annotationFilter: FileListAnnotationFilter
  annotations: Map<string, Record<string, unknown>>
  /** `config.analyzeDivaTextureInfo` der aktiven Bibliothek. */
  divaEnabled: boolean
}

export function filterAndSortFiles({
  files,
  searchTerm,
  sortField,
  sortOrder,
  categoryFilter,
  annotationFilter,
  annotations,
  divaEnabled,
}: FileListFilterInput): StorageItem[] {
  const needle = searchTerm.toLowerCase()

  const filtered = files.filter(item => {
    // Basis-Filter
    const basicFilter = !item.metadata.name.startsWith('.') &&
      !item.metadata.isTwin &&
      (needle === '' || item.metadata.name.toLowerCase().includes(needle))

    if (!basicFilter) return false

    // DIVA-Filter: immer nur *_basecolor, dann alle / mit / ohne Sidecar-Treffer.
    if (divaEnabled) {
      if (!isBasecolorFileName(item.metadata.name)) return false
      const hasAnnotation = annotations.has(item.metadata.name)
      if (annotationFilter === 'with' && !hasAnnotation) return false
      if (annotationFilter === 'without' && hasAnnotation) return false
    } else if (annotationFilter !== 'all') {
      // Generischer Annotation-Filter ohne DIVA (kein Basecolor-Zwang).
      const hasAnnotation = annotations.has(item.metadata.name)
      if (annotationFilter === 'with' && !hasAnnotation) return false
      if (annotationFilter === 'without' && hasAnnotation) return false
    }

    // Kategorie-Filter
    if (categoryFilter === 'all') return true

    const itemCategory = getFileCategory(item)
    return itemCategory === categoryFilter
  })

  return filtered.sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'type':
        cmp = (a.metadata.mimeType || '').localeCompare(b.metadata.mimeType || '')
        break
      case 'name':
        cmp = a.metadata.name.localeCompare(b.metadata.name)
        break
      case 'size':
        cmp = (a.metadata.size || 0) - (b.metadata.size || 0)
        break
      case 'date':
        cmp = new Date(a.metadata.modifiedAt ?? 0).getTime() - new Date(b.metadata.modifiedAt ?? 0).getTime()
        break
    }
    return sortOrder === 'asc' ? cmp : -cmp
  })
}
