/**
 * @fileoverview Hook: laedt Item-Annotationen des aktuellen Ordners.
 *
 * @description
 * Holt `GET /api/library/[id]/item-annotations?parentId=<folder>` und befuellt
 * `itemAnnotationsAtom` (keyed nach Dateiname) + `itemAnnotationsStatusAtom`.
 * Quelle ist Live-Match gegen optionvalues.json (kein Mongo-Preprocess noetig).
 * Re-Fetch bei Ordner-/Library-Wechsel.
 *
 * Kein stiller Fallback: bei Fehlern wird der Status auf 'error' gesetzt und
 * geloggt, statt leise eine leere Annotationsliste vorzutaeuschen.
 */

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  activeLibraryIdAtom,
  currentFolderIdAtom,
  itemAnnotationsAtom,
  itemAnnotationsStatusAtom,
  itemSidecarEntriesAtom,
} from '@/atoms/library-atom'
import type { ItemAnnotationsResponse } from '@/lib/diva-texture/types'

export function useItemAnnotations(): void {
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const folderId = useAtomValue(currentFolderIdAtom)
  const setAnnotations = useSetAtom(itemAnnotationsAtom)
  const setEntries = useSetAtom(itemSidecarEntriesAtom)
  const setStatus = useSetAtom(itemAnnotationsStatusAtom)

  useEffect(() => {
    if (!libraryId || !folderId) {
      setAnnotations(new Map())
      setEntries(new Map())
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')

    const url = `/api/library/${encodeURIComponent(libraryId)}/item-annotations?parentId=${encodeURIComponent(folderId)}`
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ItemAnnotationsResponse>
      })
      .then((data) => {
        if (cancelled) return
        const attrs = new Map<string, Record<string, unknown>>()
        const entries = new Map<string, Record<string, unknown>>()
        for (const annotation of data.annotations) {
          attrs.set(annotation.fileName, annotation.attributes)
          if (annotation.entry) {
            // OptionvalueEntry hat ein striktes Schema; das Atom haelt eine
            // Library-neutrale Record-Sicht. Doppel-Cast ueber `unknown` ist
            // hier korrekt (Layering: Atoms duerfen nicht auf diva-spezifische
            // Typen typabhaengen).
            entries.set(
              annotation.fileName,
              annotation.entry as unknown as Record<string, unknown>,
            )
          }
        }
        setAnnotations(attrs)
        setEntries(entries)
        setStatus('loaded')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('[item-annotations] Laden fehlgeschlagen', error)
        setAnnotations(new Map())
        setEntries(new Map())
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [libraryId, folderId, setAnnotations, setEntries, setStatus])
}
