'use client'

/**
 * @fileoverview Client-Hook fuer die Themen-Route (Welle A6).
 *
 * @description
 * Kapselt `POST /api/library/{id}/agent-view/themen` nach dem Muster
 * `use-stand.ts`: Nach Erfolg wird der Report NICHT neu gerechnet — ein
 * Override je folderId ueberlagert die gepflegten Themen lokal
 * (`ueberlagereThemen` im Panel), bis der naechste Scan laeuft. Fehler
 * (ungueltiges Thema, fehlendes `_INDEX.md`) erscheinen als Klartext am
 * Editor; nichts wurde in diesen Faellen geschrieben.
 *
 * @module hooks/agent-view
 */

import { useCallback, useState } from 'react'

export interface UseThemenResult {
  /** Frisch geschriebene Themen je folderId — bis zum naechsten Scan. */
  overrides: ReadonlyMap<string, string[]>
  /** folderId der gerade laufenden Aktion (eine zur Zeit). */
  pendingFolderId: string | null
  /** Klartext-Fehler je folderId (400/409-Katalog der Route). */
  fehlerByFolder: ReadonlyMap<string, string>
  /** Schreibt die komplette Themenliste; true = gespeichert. */
  setzeThemen: (folderId: string, themen: string[]) => Promise<boolean>
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    if (typeof body.error === 'string' && body.error.trim() !== '') return body.error
  } catch {
    // Antwort ohne JSON-Body: Status-Code ist die beste verfuegbare Aussage.
  }
  return `HTTP ${response.status}`
}

export function useThemen(libraryId: string): UseThemenResult {
  const [overrides, setOverrides] = useState<Map<string, string[]>>(new Map())
  const [pendingFolderId, setPendingFolderId] = useState<string | null>(null)
  const [fehlerByFolder, setFehlerByFolder] = useState<Map<string, string>>(new Map())

  const setzeThemen = useCallback(
    async (folderId: string, themen: string[]): Promise<boolean> => {
      setPendingFolderId(folderId)
      setFehlerByFolder((prev) => {
        const next = new Map(prev)
        next.delete(folderId)
        return next
      })
      try {
        const response = await fetch(
          `/api/library/${encodeURIComponent(libraryId)}/agent-view/themen`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId, themen }),
          },
        )
        if (!response.ok) throw new Error(await readError(response))
        const ergebnis = (await response.json()) as { themen: string[] }
        setOverrides((prev) => new Map(prev).set(folderId, ergebnis.themen))
        return true
      } catch (error) {
        setFehlerByFolder((prev) =>
          new Map(prev).set(folderId, error instanceof Error ? error.message : String(error)),
        )
        return false
      } finally {
        setPendingFolderId(null)
      }
    },
    [libraryId],
  )

  return { overrides, pendingFolderId, fehlerByFolder, setzeThemen }
}
