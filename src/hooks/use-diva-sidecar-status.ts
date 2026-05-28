/**
 * @fileoverview Hook: laedt den Sidecar-Status fuer den aktuellen DIVA-Ordner.
 *
 * @description
 * Holt `GET /api/diva-texture/sidecar-status?libraryId=X&parentId=Y` und
 * befuellt `divaSidecarStatusAtom`. Wird vom DivaToolsMenu konsumiert, um den
 * Toolbar-Button orange zu faerben, wenn `api2_GetJsonOptionValues.json` im
 * Verzeichnis liegt. Re-Fetch bei Ordner-/Library-Wechsel.
 *
 * Kein stiller Fallback: bei Fehlern wird `state: 'error'` gesetzt + geloggt.
 */

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  activeLibraryIdAtom,
  currentFolderIdAtom,
  divaSidecarStatusAtom,
} from '@/atoms/library-atom'

interface SidecarStatusApiResponse {
  found: boolean
  entryCount?: number
  sourceFileName?: string
}

export function useDivaSidecarStatus(enabled: boolean): void {
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const folderId = useAtomValue(currentFolderIdAtom)
  const setStatus = useSetAtom(divaSidecarStatusAtom)

  useEffect(() => {
    if (!enabled || !libraryId || !folderId) {
      setStatus({ state: 'idle', found: false })
      return
    }

    let cancelled = false
    setStatus({ state: 'loading', found: false })

    const url =
      `/api/diva-texture/sidecar-status` +
      `?libraryId=${encodeURIComponent(libraryId)}` +
      `&parentId=${encodeURIComponent(folderId)}`
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SidecarStatusApiResponse>
      })
      .then((data) => {
        if (cancelled) return
        setStatus({
          state: 'loaded',
          found: data.found === true,
          entryCount: typeof data.entryCount === 'number' ? data.entryCount : undefined,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('[diva-sidecar-status] Laden fehlgeschlagen', error)
        setStatus({ state: 'error', found: false })
      })

    return () => {
      cancelled = true
    }
  }, [enabled, libraryId, folderId, setStatus])
}
