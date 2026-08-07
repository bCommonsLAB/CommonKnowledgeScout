"use client"

/**
 * @fileoverview Hook fuer den per-Quelle Shadow-Twin-Abgleich aus der Uebersicht.
 *
 * @description
 * Spricht die Sync-Engine (Welle 4): runPreview = mode=check, runApply =
 * mode=repair — beide mit preset=repair und scope auf genau diese Quelle.
 * Der Dialog zeigt den Transkript-Plan (Gewinner, Loeschungen) plus eine
 * Kurzzeile fuer weitere Abgleiche (Transformationen, Spiegel, Bilder),
 * damit die Vorschau exakt dem entspricht, was Reparieren ausfuehrt.
 */

import * as React from "react"
import { toast } from "sonner"

/** Engine-Report-Zeile (Teilmenge, die dieser Hook konsumiert). */
interface EngineSourceRow {
  sourceId: string
  sourceName: string
  transcriptStatus: string
  winnerName: string | null
  winnerOrigin: string | null
  winnerPages: number
  operations: Array<{ type: string; fileName: string; selected: boolean; executed?: boolean; error?: string }>
  notes: string[]
  error?: string
}

/** View-Model fuer den Dialog (per-Quelle). */
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
  /** Weitere ausgewaehlte Abgleiche jenseits des Transkripts. */
  otherOps: number
  note?: string
}

const DELETE_TYPES = new Set(["delete-inferior-variant", "delete-dead-page-md"])
const TRANSCRIPT_TYPES = new Set(["write-canonical-transcript", "update-mongo-transcript", ...DELETE_TYPES])

function toViewModel(row: EngineSourceRow): ReconcileSourceResult {
  const selected = row.operations.filter((op) => op.selected)
  return {
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    status: row.transcriptStatus,
    winnerName: row.winnerName,
    winnerOrigin: row.winnerOrigin,
    winnerPages: row.winnerPages,
    wroteCanonical: selected.some((op) => op.type === "write-canonical-transcript"),
    updatedMongo: selected.some((op) => op.type === "update-mongo-transcript"),
    deleted: selected.filter((op) => DELETE_TYPES.has(op.type)).map((op) => op.fileName),
    otherOps: selected.filter((op) => !TRANSCRIPT_TYPES.has(op.type)).length,
    note: [row.error, ...row.notes].filter(Boolean).join("; ") || undefined,
  }
}

async function callSyncEngine(
  libraryId: string,
  sourceId: string,
  mode: "check" | "repair",
): Promise<ReconcileSourceResult | null> {
  const res = await fetch(
    `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconcile`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, preset: "repair", scope: { sourceIds: [sourceId] } }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as {
    sources?: EngineSourceRow[]
    error?: string
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  const row = data.sources?.[0]
  return row ? toViewModel(row) : null
}

/** Liefert true, wenn der Plan tatsaechlich etwas aendern wuerde. */
export function reconcileHasChanges(r: ReconcileSourceResult | null): boolean {
  return !!r && (r.wroteCanonical || r.updatedMongo || r.deleted.length > 0 || r.otherOps > 0)
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
      setPreview(await callSyncEngine(libraryId, sourceId, "check"))
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
      const r = await callSyncEngine(libraryId, sourceId, "repair")
      toast.success("Datei repariert", {
        description: r
          ? `Gewinner: ${r.winnerName ?? "—"} (${r.winnerPages} Seiten)` +
            (r.deleted.length ? `, ${r.deleted.length} Datei(en) geloescht` : "") +
            (r.otherOps ? `, ${r.otherOps} weitere Abgleiche` : "")
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
