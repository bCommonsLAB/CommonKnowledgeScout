'use client'

/**
 * @fileoverview Hooks fuer Suche, Sortierung, Dateiliste und Breadcrumb-Pfad.
 *
 * @description
 * Diese vier Werte haengen an der aktiven Bibliothek: Suche und Sortierung
 * werden je Bibliothek gemerkt, die Dateiliste kennt deren DIVA-Schalter, der
 * Pfad deren Namen. Bis zu dieser Welle waren es abgeleitete Atome, die die
 * Auswahl mitlasen.
 *
 * Die Auswahl wandert nach `@ks/shell` und ist dort nur ueber Hooks erreichbar
 * (Modul-Landkarte §6, Muster aus `@ks/i18n/react`) — ein Atom kann sie nicht
 * mehr lesen. Deshalb Hooks statt Atome; die Regeln selbst stehen als reine
 * Funktionen in `@/lib/file-list/`.
 */

import { useCallback, useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { StorageItem } from '@/lib/storage/types'
import {
  annotationFilterModeAtom,
  filesOnlyAtom,
  folderNavigationAtom,
  currentFolderIdAtom,
  itemAnnotationsAtom,
  librarySortFilterConfigAtom,
} from '@/atoms/library-atom'
import { useActiveLibrary, useActiveLibraryId } from '@ks/shell/react'
import { fileCategoryFilterAtom } from '@/atoms/transcription-options'
import { filterAndSortFiles, type FileListSortField, type FileListSortOrder } from '@/lib/file-list/filter-sort'
import { buildCurrentPath } from '@/lib/file-list/current-path'

/**
 * Suchbegriff der Dateiliste — je Bibliothek gemerkt.
 *
 * Ohne gewaehlte Bibliothek liefert der Hook '' und ignoriert Schreibzugriffe;
 * es gibt dann keinen Schluessel, unter dem der Wert gehoerte.
 */
export function useSearchTerm(): [string, (value: string) => void] {
  const libraryId = useActiveLibraryId()
  const [config, setConfig] = useAtom(librarySortFilterConfigAtom(libraryId))

  const setSearchTerm = useCallback((value: string) => {
    if (!libraryId) return
    setConfig(prev => ({ ...prev, searchTerm: value }))
  }, [libraryId, setConfig])

  return [libraryId ? config.searchTerm : '', setSearchTerm]
}

/** Sortierfeld der Dateiliste — je Bibliothek gemerkt. */
export function useSortField(): [FileListSortField, (value: FileListSortField) => void] {
  const libraryId = useActiveLibraryId()
  const [config, setConfig] = useAtom(librarySortFilterConfigAtom(libraryId))

  const setSortField = useCallback((value: FileListSortField) => {
    if (!libraryId) return
    setConfig(prev => ({ ...prev, sortField: value }))
  }, [libraryId, setConfig])

  return [libraryId ? config.sortField : 'name', setSortField]
}

/** Sortierrichtung der Dateiliste — je Bibliothek gemerkt. */
export function useSortOrder(): [FileListSortOrder, (value: FileListSortOrder) => void] {
  const libraryId = useActiveLibraryId()
  const [config, setConfig] = useAtom(librarySortFilterConfigAtom(libraryId))

  const setSortOrder = useCallback((value: FileListSortOrder) => {
    if (!libraryId) return
    setConfig(prev => ({ ...prev, sortOrder: value }))
  }, [libraryId, setConfig])

  return [libraryId ? config.sortOrder : 'asc', setSortOrder]
}

/** Die angezeigte Dateiliste: gefiltert und sortiert. */
export function useSortedFilteredFiles(): StorageItem[] {
  const files = useAtomValue(filesOnlyAtom)
  const [searchTerm] = useSearchTerm()
  const [sortField] = useSortField()
  const [sortOrder] = useSortOrder()
  const categoryFilter = useAtomValue(fileCategoryFilterAtom)
  const annotationFilter = useAtomValue(annotationFilterModeAtom)
  const annotations = useAtomValue(itemAnnotationsAtom)
  const activeLibrary = useActiveLibrary()
  const divaEnabled = activeLibrary?.config?.analyzeDivaTextureInfo === true

  return useMemo(() => filterAndSortFiles({
    files,
    searchTerm,
    sortField,
    sortOrder,
    categoryFilter,
    annotationFilter,
    annotations,
    divaEnabled,
  }), [files, searchTerm, sortField, sortOrder, categoryFilter, annotationFilter, annotations, divaEnabled])
}

/** Breadcrumb-Pfad vom Wurzel-Item bis zum aktuellen Ordner. */
export function useCurrentPath(): StorageItem[] {
  const activeLibrary = useActiveLibrary()
  const currentFolderId = useAtomValue(currentFolderIdAtom)
  const { folderCache } = useAtomValue(folderNavigationAtom)

  return useMemo(
    () => buildCurrentPath(activeLibrary, currentFolderId, folderCache),
    [activeLibrary, currentFolderId, folderCache],
  )
}
