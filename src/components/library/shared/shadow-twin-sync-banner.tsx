"use client"

/**
 * @fileoverview Shadow-Twin Sync Banner
 *
 * @description
 * Zeigt eine kompakte Warnung an, wenn die Quelldatei neuer als der
 * Shadow-Twin ist (source-newer) oder kein Shadow-Twin existiert (no-twin).
 *
 * Storage-Fälle (storage-newer, storage-missing) werden automatisch
 * im FilePreview per useEffect synchronisiert – kein Banner nötig.
 *
 * @module shadow-twin
 *
 * @usedIn
 * - src/components/library/file-preview.tsx
 */

import * as React from "react"
import { AlertTriangle, Clock, FileQuestion, RefreshCw } from "lucide-react"
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

/** Icon + Farben pro Status (nur source-newer und no-twin) */
const STATUS_CONFIG: Partial<Record<
  FreshnessStatus,
  {
    icon: React.ElementType
    borderClass: string
    bgClass: string
    iconClass: string
  }
>> = {
  "source-newer": {
    icon: AlertTriangle,
    borderClass: "border-amber-300 dark:border-amber-700",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  "no-twin": {
    icon: FileQuestion,
    borderClass: "border-slate-300 dark:border-slate-700",
    bgClass: "bg-slate-50 dark:bg-slate-950/30",
    iconClass: "text-slate-600 dark:text-slate-400",
  },
}

export function ShadowTwinSyncBanner({
  freshness,
  onRequestUpdate,
  isUpdating = false,
}: ShadowTwinSyncBannerProps) {
  // Banner nur für source-newer und no-twin anzeigen
  // storage-newer und storage-missing werden automatisch per useEffect gesynct
  const config = STATUS_CONFIG[freshness.status]
  if (!config) return null

  // Während API lädt, noch kein Banner (vermeidet Flackern)
  if (freshness.apiLoading) return null

  const Icon = config.icon

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
            {freshness.status === "no-twin" && (
              <>
                <span className="font-medium">Kein Shadow-Twin vorhanden</span>
                <span className="text-muted-foreground">
                  {" "}— für diese Datei wurde noch kein Transkript oder Transformation erstellt.
                </span>
              </>
            )}
          </AlertDescription>

          {/* Aktions-Button: Pipeline öffnen */}
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
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {freshness.status === "no-twin"
                  ? "Jetzt erstellen"
                  : "Shadow-Twin aktualisieren"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Alert>
  )
}
