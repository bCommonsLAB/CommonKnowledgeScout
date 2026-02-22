"use client"

/**
 * @fileoverview Freshness Comparison Panel
 *
 * @description
 * Zeigt pro Artefakt einen Timestamp-Vergleich zwischen MongoDB und Storage.
 * Wird im Debug-Panel (Shadow-Twin Tab) angezeigt.
 *
 * Für jedes Artefakt (Transcript, Transformation) werden verglichen:
 * - Source-Datei modifiedAt (Storage)
 * - Artefakt updatedAt (MongoDB)
 * - Artefakt-Datei modifiedAt (Storage, wenn persistToFilesystem aktiv)
 *
 * @module shadow-twin
 *
 * @usedIn
 * - src/components/debug/debug-footer.tsx (ShadowTwinDebugContent)
 */

import { useState, useEffect, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/** Status-Typ (muss mit API übereinstimmen) */
type ArtifactFreshnessStatus =
  | "synced"
  | "source-newer"
  | "storage-newer"
  | "mongo-newer"
  | "storage-missing"
  | "mongo-missing"

/** Artefakt-Freshness-Daten (von API) */
interface ArtifactFreshness {
  kind: "transcript" | "transformation"
  targetLanguage: string
  templateName?: string
  fileName: string
  status: ArtifactFreshnessStatus
  mongo: { updatedAt: string; createdAt: string } | null
  storage: { modifiedAt: string; fileId: string } | null
}

/** API-Response */
interface FreshnessResponse {
  sourceFile: {
    id: string
    name: string
    modifiedAt: string | null
  }
  documentUpdatedAt: string | null
  artifacts: ArtifactFreshness[]
  config: {
    primaryStore: string
    persistToFilesystem: boolean
    allowFilesystemFallback: boolean
  }
}

/** Status-Labels und Farben */
const STATUS_CONFIG: Record<ArtifactFreshnessStatus, { label: string; color: string; bg: string }> = {
  synced:          { label: "Synchron",         color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/30" },
  "source-newer":  { label: "Quelle neuer",     color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  "storage-newer": { label: "Storage neuer",    color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  "mongo-newer":   { label: "Mongo neuer",      color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  "storage-missing": { label: "Storage fehlt",  color: "text-red-700 dark:text-red-400",    bg: "bg-red-100 dark:bg-red-900/30" },
  "mongo-missing": { label: "Mongo fehlt",      color: "text-red-700 dark:text-red-400",    bg: "bg-red-100 dark:bg-red-900/30" },
}

/** Formatiert ISO-String als deutsches Datum */
function fmt(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

export interface FreshnessComparisonPanelProps {
  libraryId: string
  sourceId: string
  parentId?: string
}

export function FreshnessComparisonPanel({
  libraryId,
  sourceId,
  parentId,
}: FreshnessComparisonPanelProps) {
  const [data, setData] = useState<FreshnessResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFreshness = useCallback(async () => {
    if (!libraryId || !sourceId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/freshness`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId, parentId }),
        }
      )
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      const json = (await res.json()) as FreshnessResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [libraryId, sourceId, parentId])

  // Lade Freshness-Daten beim Mounten und bei Datei-Wechsel
  useEffect(() => {
    void loadFreshness()
  }, [loadFreshness])

  if (loading && !data) {
    return <div className="text-xs text-muted-foreground py-1">Lade Freshness-Daten…</div>
  }

  if (error) {
    return <div className="text-xs text-destructive py-1">Fehler: {error}</div>
  }

  if (!data) return null

  const hasStorageColumn =
    data.config.primaryStore === "filesystem" || data.config.persistToFilesystem

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium">Freshness-Vergleich</div>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 w-5 p-0"
          onClick={() => void loadFreshness()}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Source-Datei Info */}
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">Source modifiedAt</td>
            <td className="py-1">{fmt(data.sourceFile.modifiedAt)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">Dokument updatedAt</td>
            <td className="py-1">{fmt(data.documentUpdatedAt)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap">Config</td>
            <td className="py-1 text-muted-foreground">
              primaryStore={data.config.primaryStore},
              persist={String(data.config.persistToFilesystem)},
              fallback={String(data.config.allowFilesystemFallback)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Artefakte-Vergleich */}
      {data.artifacts.length === 0 ? (
        <div className="text-xs text-muted-foreground">Keine Artefakte in MongoDB.</div>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <TooltipProvider>
                  <th className="px-2 py-1 font-medium">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted">
                        Artefakt
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Typ und Dateiname des Artefakts.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  <th className="px-2 py-1 font-medium">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted">
                        Mongo updatedAt
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Zeitpunkt der letzten Aktualisierung des Artefakts in MongoDB.</p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                  {hasStorageColumn && (
                    <th className="px-2 py-1 font-medium">
                      <Tooltip>
                        <TooltipTrigger className="cursor-help underline decoration-dotted">
                          Storage modifiedAt
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">Änderungsdatum der Datei im Storage (Filesystem/OneDrive/Nextcloud).</p>
                        </TooltipContent>
                      </Tooltip>
                    </th>
                  )}
                  <th className="px-2 py-1 font-medium">
                    <Tooltip>
                      <TooltipTrigger className="cursor-help underline decoration-dotted">
                        Status
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Synchron = konsistent. Quelle neuer = Quelldatei wurde geändert.
                          Storage neuer = Datei im Storage wurde extern editiert.
                          Mongo neuer = MongoDB wurde aktualisiert, Storage-Datei nicht.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </th>
                </TooltipProvider>
              </tr>
            </thead>
            <tbody>
              {data.artifacts.map((art, idx) => {
                const cfg = STATUS_CONFIG[art.status]
                return (
                  <tr key={`${art.kind}-${art.targetLanguage}-${art.templateName || ""}-${idx}`} className="border-t">
                    <td className="px-2 py-1">
                      <div className="font-medium">
                        {art.kind === "transcript" ? "Transcript" : "Transformation"}
                        <span className="text-muted-foreground ml-1">({art.targetLanguage})</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={art.fileName}>
                        {art.fileName}
                      </div>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {fmt(art.mongo?.updatedAt)}
                    </td>
                    {hasStorageColumn && (
                      <td className="px-2 py-1 whitespace-nowrap">
                        {art.storage ? fmt(art.storage.modifiedAt) : (
                          <span className="text-muted-foreground italic">nicht gefunden</span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-1">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
