"use client"

/**
 * @fileoverview Hook fuer die per-Quelle Shadow-Twin-Reconcile aus der Uebersicht.
 *
 * @description
 * Kapselt den Aufruf des Reconcile-Endpoints (`/shadow-twins/reconcile`):
 * - runPreview: Dry-Run (apply=false) -> zeigt, was passieren WUERDE.
 * - runApply: Apply (apply=true) -> schreibt kanonische {base}.md + Mongo, loescht
 *   strikt unterlegene Varianten. Danach onApplied() (Ansicht neu laden).
 *
 * Haelt die UI-Datei schlank; die eigentliche Logik liegt serverseitig.
 */

import * as React from "react"
import { toast } from "sonner"

/** Pro-Quelle-Ergebnis aus dem Reconcile-Report (Teilmenge fuer die UI). */
export interface ReconcileSourceResult {
  sourceId: string
  sourceName: string
  status: string
  winnerName: string | null
  winnerOrigin: string | null
  winnerPages: number
  wroteCanonical: boolean
  updatedMongo: boolean
  deleted: string[]
  note?: string
}

async function callReconcile(
  libraryId: string,
  sourceId: string,
  apply: boolean,
): Promise<ReconcileSourceResult | null> {
  const res = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconcile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceIds: [sourceId], apply }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    results?: ReconcileSourceResult[]
    error?: string
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data.results?.[0] ?? null
}

/** Liefert true, wenn der Plan tatsaechlich etwas aendern wuerde. */
export function reconcileHasChanges(r: ReconcileSourceResult | null): boolean {
  return !!r && r.status === "ok" && (r.wroteCanonical || r.updatedMongo || r.deleted.length > 0)
}

export function useSourceReconcile(
  libraryId: string,
  sourceId: string | undefined,
  onApplied?: () => void,
) {
  const [isBusy, setIsBusy] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<ReconcileSourceResult | null>(null)

  const runPreview = React.useCallback(async () => {
    if (!libraryId || !sourceId) return
    setIsBusy(true)
    try {
      setPreview(await callReconcile(libraryId, sourceId, false))
      setOpen(true)
    } catch (e) {
      toast.error("Vorschau fehlgeschlagen", {
        description: e instanceof Error ? e.message : "Unbekannter Fehler",
      })
    } finally {
      setIsBusy(false)
    }
  }, [libraryId, sourceId])

  const runApply = React.useCallback(async () => {
    if (!libraryId || !sourceId) return
    setIsBusy(true)
    try {
      const r = await callReconcile(libraryId, sourceId, true)
      toast.success("Transkript repariert", {
        description: r
          ? `Gewinner: ${r.winnerName ?? "—"} (${r.winnerPages} Seiten)` +
            (r.deleted.length ? `, ${r.deleted.length} Datei(en) geloescht` : "")
          : undefined,
      })
      setOpen(false)
      onApplied?.()
    } catch (e) {
      toast.error("Reparatur fehlgeschlagen", {
        description: e instanceof Error ? e.message : "Unbekannter Fehler",
      })
    } finally {
      setIsBusy(false)
    }
  }, [libraryId, sourceId, onApplied])

  return { isBusy, open, setOpen, preview, runPreview, runApply }
}
