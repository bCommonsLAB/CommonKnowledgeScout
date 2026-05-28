/**
 * @fileoverview Hook: Liest DIVA-Archive-Defaults aus der Library-Config
 * und schiebt sie beim Library-Wechsel einmalig in die Toolbar-Atoms.
 *
 * @description
 * Die Atoms `annotationFilterModeAtom`, `groupByAttributeAtom` und
 * `divaExtraColumnsAtom` halten Runtime-State der DIVA-Toolbar in der
 * Archiv-Dateiliste. Damit der Klassifizierer beim Oeffnen einer Library
 * sofort seine bevorzugten Einstellungen sieht, werden sie hier aus
 * `library.config.divaArchiveDefaults` (persistent in MongoDB)
 * uebernommen. Aenderungen im Popover sind danach per-Session und werden
 * NICHT automatisch zurueckgespielt — der explizite Weg laeuft ueber das
 * Library-Settings-Formular.
 *
 * Trigger: jeder Wechsel von `activeLibrary.id`. Kein silent fallback —
 * ungueltige Werte werden ignoriert und die Atoms bleiben auf ihrem
 * vorherigen Stand.
 */

import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import {
  annotationFilterModeAtom,
  divaExtraColumnsAtom,
  groupByAttributeAtom,
} from '@/atoms/library-atom'
import type { ClientLibrary } from '@/types/library'

export function useDivaArchiveDefaults(library: ClientLibrary | undefined): void {
  const setFilterMode = useSetAtom(annotationFilterModeAtom)
  const setGroupBy = useSetAtom(groupByAttributeAtom)
  const setExtraColumns = useSetAtom(divaExtraColumnsAtom)
  const libraryId = library?.id

  useEffect(() => {
    if (!libraryId) return
    const defaults = (library?.config?.divaArchiveDefaults ?? null) as
      | { filterMode?: unknown; groupByAttribute?: unknown; extraColumns?: unknown }
      | null
    if (!defaults) {
      // Bewusste Reset-Semantik: bei Library-Switch ohne persistierte Defaults
      // faellt die Toolbar in den neutralen Zustand zurueck.
      setFilterMode('all')
      setGroupBy(null)
      setExtraColumns([])
      return
    }
    const fm = defaults.filterMode
    if (fm === 'all' || fm === 'with' || fm === 'without') setFilterMode(fm)
    else setFilterMode('all')

    const gb = defaults.groupByAttribute
    if (typeof gb === 'string' && gb.trim().length > 0) setGroupBy(gb)
    else setGroupBy(null)

    const cols = defaults.extraColumns
    if (Array.isArray(cols)) {
      setExtraColumns(cols.filter((c): c is string => typeof c === 'string'))
    } else {
      setExtraColumns([])
    }
  }, [libraryId, library?.config?.divaArchiveDefaults, setFilterMode, setGroupBy, setExtraColumns])
}
