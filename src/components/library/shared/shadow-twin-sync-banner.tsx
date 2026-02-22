"use client"

/**
 * @fileoverview Shadow-Twin Sync Banner
 *
 * @description
 * Zeigt eine kompakte Warnung an, wenn Quelldatei, MongoDB und Storage-Datei
 * nicht synchron sind. Zeigt pro Artefakt den Status an (Transcript,
 * Transformation können unterschiedlich sein).
 *
 * Erkennt drei Fälle:
 * - source-newer: Quelldatei wurde geändert → Shadow-Twin neu generieren
 * - storage-newer: Artefakt-Datei im Storage wurde extern editiert → MongoDB aktualisieren
 * - no-twin: Kein Shadow-Twin vorhanden → Erstellen
 *
 * Funktioniert Storage-unabhängig (Filesystem, OneDrive, Nextcloud).
 *
 * @module shadow-twin
 *
 * @usedIn
 * - src/components/library/file-preview.tsx
 */

import * as React from "react"
import { AlertTriangle, ArrowUpFromLine, Clock, Download, FileQuestion, RefreshCw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { FreshnessInfo, FreshnessStatus } from "@/hooks/use-shadow-twin-freshness"

/** Formatiert eine Zeitdifferenz menschenlesbar. */
function formatDiff(diffMs: number | null): string {
  if (diffMs === null) return ""
  const absDiff = Math.abs(diffMs)
  const minutes = Math.floor(absDiff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} Tag${days > 1 ? "e" : ""}`
  if (hours > 0) return `${hours} Stunde${hours > 1 ? "n" : ""}`
  if (minutes > 0) return `${minutes} Minute${minutes > 1 ? "n" : ""}`
  return "wenigen Sekunden"
}

export interface ShadowTwinSyncBannerProps {
  freshness: FreshnessInfo
  onRequestUpdate?: () => void
  isUpdating?: boolean
}

/** Icon + Farben pro Status */
const STATUS_CONFIG: Record<
  Exclude<FreshnessStatus, "loading" | "synced">,
  {
    icon: React.ElementType
    borderClass: string
    bgClass: string
    iconClass: string
  }
> = {
  "source-newer": {
    icon: AlertTriangle,
    borderClass: "border-amber-300 dark:border-amber-700",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  "storage-newer": {
    icon: ArrowUpFromLine,
    borderClass: "border-blue-300 dark:border-blue-700",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  "storage-missing": {
    icon: Download,
    borderClass: "border-red-300 dark:border-red-700",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    iconClass: "text-red-600 dark:text-red-400",
  },
  "no-twin": {
    icon: FileQuestion,
    borderClass: "border-slate-300 dark:border-slate-700",
    bgClass: "bg-slate-50 dark:bg-slate-950/30",
    iconClass: "text-slate-600 dark:text-slate-400",
  },
}

/** Status-Label pro API-Artefakt-Status */
const API_STATUS_LABEL: Record<string, { symbol: string; color: string }> = {
  synced:          { symbol: "✓", color: "text-green-600 dark:text-green-400" },
  "source-newer":  { symbol: "⚠", color: "text-amber-600 dark:text-amber-400" },
  "storage-newer": { symbol: "↑", color: "text-blue-600 dark:text-blue-400" },
  "mongo-newer":   { symbol: "↓", color: "text-purple-600 dark:text-purple-400" },
  "storage-missing": { symbol: "✗", color: "text-red-600 dark:text-red-400" },
  "mongo-missing": { symbol: "✗", color: "text-red-600 dark:text-red-400" },
}

export function ShadowTwinSyncBanner({
  freshness,
  onRequestUpdate,
  isUpdating = false,
}: ShadowTwinSyncBannerProps) {
  // Bei "loading", "synced" oder apiLoading kein Banner anzeigen
  if (freshness.status === "loading" || freshness.status === "synced") {
    return null
  }
  // Während API lädt, noch kein Banner (vermeidet Flackern)
  if (freshness.apiLoading) {
    return null
  }

  const config = STATUS_CONFIG[freshness.status]
  const Icon = config.icon

  // Per-Artefakt Details aus API (vollständig) oder aus Atom-Check (Fallback)
  const hasApiData = freshness.apiArtifacts.length > 0
  const issueCount = hasApiData ? freshness.apiIssueCount : freshness.staleCount
  const totalCount = hasApiData ? freshness.apiArtifacts.length : freshness.artifacts.length

  return (
    <Alert className={`mx-3 mt-2 py-2 px-3 ${config.borderClass} ${config.bgClass}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconClass}`} />
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-xs">
            {freshness.status === "source-newer" && (
              <>
                <span className="font-medium">
                  Quelldatei ist neuer als Shadow-Twin
                  {totalCount > 1 && <> ({issueCount}/{totalCount} veraltet)</>}
                </span>
                {freshness.diffMs !== null && (
                  <span className="text-muted-foreground"> — Differenz: {formatDiff(freshness.diffMs)}</span>
                )}
              </>
            )}
            {freshness.status === "storage-newer" && (
              <>
                <span className="font-medium">
                  Artefakt im Storage wurde extern geändert
                  {totalCount > 1 && <> ({issueCount}/{totalCount} abweichend)</>}
                </span>
                <span className="text-muted-foreground">
                  {" "}— Die Datei im Storage ist neuer als der MongoDB-Eintrag.
                </span>
              </>
            )}
            {freshness.status === "storage-missing" && (
              <>
                <span className="font-medium">
                  Artefakt fehlt im Storage
                  {totalCount > 1 && <> ({issueCount}/{totalCount} fehlend)</>}
                </span>
                <span className="text-muted-foreground">
                  {" "}— Die Datei existiert in MongoDB, aber nicht im Storage.
                </span>
              </>
            )}
            {freshness.status === "no-twin" && (
              <>
                <span className="font-medium">Kein Shadow-Twin vorhanden</span>
                <span className="text-muted-foreground">
                  {" "}— für diese Datei wurde noch kein Transkript oder Transformation erstellt.
                </span>
              </>
            )}

            {/* Per-Artefakt Auflistung (API-basiert wenn verfügbar) */}
            {hasApiData && freshness.apiArtifacts.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {freshness.apiArtifacts.map((art) => {
                  const statusCfg = API_STATUS_LABEL[art.status] || API_STATUS_LABEL.synced
                  return (
                    <li key={`${art.kind}-${art.targetLanguage}-${art.templateName || ""}`} className="flex items-center gap-1">
                      <span className={statusCfg.color}>{statusCfg.symbol}</span>
                      <span>{art.kind === "transcript" ? "Transcript" : "Transformation"}</span>
                      <span className="text-muted-foreground text-[10px]">({art.targetLanguage})</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </AlertDescription>

          {/* Aktions-Button */}
          {onRequestUpdate && (
            <div className="flex items-center gap-2 mt-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2"
                disabled={isUpdating}
                onClick={onRequestUpdate}
              >
                {isUpdating ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : freshness.status === "no-twin" ? (
                  <Clock className="h-3 w-3 mr-1" />
                ) : freshness.status === "storage-missing" ? (
                  <Download className="h-3 w-3 mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {freshness.status === "no-twin"
                  ? "Jetzt erstellen"
                  : freshness.status === "storage-newer"
                  ? "MongoDB aktualisieren"
                  : freshness.status === "storage-missing"
                  ? "In Storage schreiben"
                  : "Shadow-Twin aktualisieren"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Alert>
  )
}
