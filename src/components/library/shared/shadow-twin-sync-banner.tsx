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
import { AlertTriangle, FileQuestion, FolderSearch, RefreshCw, Upload } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
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
  /** Fuer no-twin: fileId und libraryId, um Rekonstruktion aus Storage zu ermoeglichen */
  fileId?: string
  parentId?: string
  libraryId?: string
  /** Shadow-Twin-Ordner-ID: Wenn vorhanden, existiert ein Storage-Ordner mit möglichen Artefakten */
  shadowTwinFolderId?: string | null
  /** Callback nach erfolgreicher Rekonstruktion (z.B. Atom-Refresh) */
  onReconstructed?: () => void
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
  fileId,
  parentId,
  libraryId,
  shadowTwinFolderId,
  onReconstructed,
}: ShadowTwinSyncBannerProps) {
  const [isReconstructing, setIsReconstructing] = React.useState(false)

  // Rekonstruktion: Bestehende Artefakte aus dem Storage in MongoDB laden
  const handleReconstruct = React.useCallback(async () => {
    if (!libraryId || !fileId || !parentId) return
    setIsReconstructing(true)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(libraryId)}/shadow-twins/reconstruct`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: fileId, parentId }),
        },
      )
      const data = await res.json()

      if (!res.ok) {
        toast.error('Rekonstruktion fehlgeschlagen', { description: data.error || 'Unbekannter Fehler' })
        return
      }

      if (data.reconstructed > 0) {
        toast.success('Artefakte rekonstruiert', {
          description: `${data.reconstructed} Artefakt${data.reconstructed > 1 ? 'e' : ''} aus dem Storage wiederhergestellt.`,
        })
        onReconstructed?.()
      } else if (data.artifacts?.length === 0) {
        toast.info('Keine Artefakte gefunden', {
          description: data.message || 'Im Shadow-Twin-Ordner wurden keine Markdown-Dateien gefunden.',
        })
      } else {
        toast.warning('Rekonstruktion unvollständig', {
          description: `${data.failed} Artefakt${data.failed > 1 ? 'e' : ''} konnten nicht geladen werden.`,
        })
      }
    } catch (err) {
      toast.error('Fehler', {
        description: err instanceof Error ? err.message : 'Netzwerkfehler bei Rekonstruktion',
      })
    } finally {
      setIsReconstructing(false)
    }
  }, [libraryId, fileId, parentId, onReconstructed])

  // Banner nur fuer source-newer und no-twin anzeigen
  // storage-newer und storage-missing werden automatisch per useEffect gesynct
  const config = STATUS_CONFIG[freshness.status]
  if (!config) return null

  // Waehrend API laedt, noch kein Banner (vermeidet Flackern)
  if (freshness.apiLoading) return null

  const Icon = config.icon

  const hasApiData = freshness.apiArtifacts.length > 0
  const issueCount = hasApiData ? freshness.apiIssueCount : freshness.staleCount
  const totalCount = hasApiData ? freshness.apiArtifacts.length : freshness.artifacts.length

  // Rekonstruktion nur anbieten, wenn ein Shadow-Twin-Ordner im Storage existiert
  const canReconstruct = freshness.status === 'no-twin' && !!shadowTwinFolderId && !!libraryId && !!fileId && !!parentId

  return (
    <Alert className={`mx-3 mt-2 py-2 px-3 ${config.borderClass} ${config.bgClass}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${config.iconClass}`} />
        <AlertDescription className="text-xs flex-1 min-w-0">
          {freshness.status === "source-newer" && (
            <>
              <span className="font-medium">
                Quelldatei wurde geändert
                {totalCount > 1 && <> ({issueCount}/{totalCount} veraltet)</>}
              </span>
              {freshness.diffMs !== null && (
                <span className="text-muted-foreground"> — vor {formatDiff(freshness.diffMs)}</span>
              )}
            </>
          )}
          {freshness.status === "no-twin" && (
            <span className="font-medium">Keine Story vorhanden</span>
          )}
        </AlertDescription>

        <div className="flex items-center gap-2 shrink-0">
          {/* Rekonstruktion nur wenn Storage-Ordner existiert */}
          {canReconstruct && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              disabled={isReconstructing || isUpdating}
              onClick={handleReconstruct}
            >
              {isReconstructing ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <FolderSearch className="h-3 w-3 mr-1" />
              )}
              Wiederherstellen
            </Button>
          )}

          {onRequestUpdate && (
            <Button
              size="sm"
              variant={freshness.status === "no-twin" ? "default" : "outline"}
              className="h-6 text-xs px-2"
              disabled={isUpdating || isReconstructing}
              onClick={onRequestUpdate}
            >
              {isUpdating ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : freshness.status === "no-twin" ? (
                <Upload className="h-3 w-3 mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              {freshness.status === "no-twin"
                ? "Story erstellen"
                : "Aktualisieren"}
            </Button>
          )}
        </div>
      </div>
    </Alert>
  )
}
