"use client"

/**
 * @fileoverview Hook: geaenderte Markdown-Quelle mit einem Klick neu uebernehmen.
 *
 * @description
 * Ruft `POST /api/library/{id}/shadow-twins/republish-unchanged` und meldet das
 * Ergebnis per Toast. Hat die Dokumentpruefung Warnungen, wird nichts
 * geschrieben; der Toast bietet dann „Trotzdem uebernehmen" an.
 *
 * @module shadow-twin
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'

interface RepublishResponse {
  updated?: boolean
  reason?: string
  warnings?: string[]
  canAcceptWarnings?: boolean
  error?: string
}

export interface UnchangedRepublish {
  isRunning: boolean
  run: () => void
}

export function useUnchangedRepublish(
  libraryId: string | null | undefined,
  sourceId: string | null | undefined,
  onUpdated: () => void,
): UnchangedRepublish {
  const [isRunning, setIsRunning] = useState(false)

  const execute = useCallback(async (acceptWarnings: boolean) => {
    if (!libraryId || !sourceId) {
      toast.error('Übernehmen nicht möglich', { description: 'Bibliothek oder Datei fehlt.' })
      return
    }
    setIsRunning(true)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/republish-unchanged`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId, acceptWarnings }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as RepublishResponse
      if (res.ok && data.updated) {
        toast.success('Änderung übernommen', {
          description: 'Der neue Text steht jetzt in der Galerie.',
        })
        onUpdated()
        return
      }
      const warnings = (data.warnings ?? []).join(' · ')
      if (data.canAcceptWarnings) {
        toast.warning('Noch nicht übernommen', {
          description: warnings,
          duration: 15000,
          action: { label: 'Trotzdem übernehmen', onClick: () => { void execute(true) } },
        })
        return
      }
      toast.error('Änderung nicht übernommen', {
        description: data.reason || data.error || `HTTP ${res.status}`,
      })
    } catch (err) {
      toast.error('Änderung nicht übernommen', {
        description: err instanceof Error ? err.message : 'Netzwerkfehler',
      })
    } finally {
      setIsRunning(false)
    }
  }, [libraryId, sourceId, onUpdated])

  const run = useCallback(() => { void execute(false) }, [execute])
  return { isRunning, run }
}
