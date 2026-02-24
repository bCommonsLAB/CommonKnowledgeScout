"use client"

import * as React from "react"
import { Trash2, X, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { useSetAtom } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { IngestionStatusCompact } from "@/components/library/shared/ingestion-status-compact"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Typ aus der API – entspricht FlatArtifactEntry aus shadow-twin-repo
interface MongoArtifact {
  kind: "transcript" | "transformation"
  targetLanguage: string
  templateName?: string
  updatedAt: string
  createdAt: string
  markdownLength: number
}

function formatShort(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString("de-DE", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

function sourceBaseName(sourceName: string): string {
  const trimmed = sourceName.trim()
  const lastDot = trimmed.lastIndexOf(".")
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed
}

/** Baut den erwarteten Dateinamen fuer ein Artefakt */
function buildFileName(base: string, artifact: MongoArtifact): string {
  if (artifact.kind === "transcript") {
    return `${base}.${artifact.targetLanguage}.md`
  }
  return `${base}.${artifact.templateName || "unknown"}.${artifact.targetLanguage}.md`
}

/** Eindeutiger Key fuer ein Artefakt (fuer React-Key und Delete-Tracking) */
function artifactKey(a: MongoArtifact): string {
  return `${a.kind}::${a.targetLanguage}::${a.templateName || ""}`
}

export interface ArtifactInfoPanelProps {
  libraryId: string
  sourceFile: StorageItem
  shadowTwinFolderId?: string | null
  transcriptFiles?: StorageItem[]
  transformed?: StorageItem
  targetLanguage: string
  onArtifactsDeleted?: () => void
}

export function ArtifactInfoPanel(props: ArtifactInfoPanelProps) {
  const base = React.useMemo(() => sourceBaseName(props.sourceFile.metadata.name), [props.sourceFile.metadata.name])
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null)
  const triggerShadowTwinAnalysis = useSetAtom(shadowTwinAnalysisTriggerAtom)

  // Alle Artefakte aus MongoDB laden (nicht gefiltert, alle Sprachen/Templates)
  const [allArtifacts, setAllArtifacts] = React.useState<MongoArtifact[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchAllArtifacts = React.useCallback(async () => {
    if (!props.libraryId || !props.sourceFile?.id) return
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/library/${encodeURIComponent(props.libraryId)}/shadow-twins/${encodeURIComponent(props.sourceFile.id)}`
      )
      if (res.ok) {
        const data = await res.json() as { artifacts?: MongoArtifact[] }
        setAllArtifacts(data.artifacts || [])
      }
    } catch {
      // Fehler beim Laden – leer bleiben
    } finally {
      setIsLoading(false)
    }
  }, [props.libraryId, props.sourceFile?.id])

  React.useEffect(() => {
    void fetchAllArtifacts()
  }, [fetchAllArtifacts])

  const transcripts = React.useMemo(
    () => allArtifacts.filter((a) => a.kind === "transcript"),
    [allArtifacts]
  )
  const transformations = React.useMemo(
    () => allArtifacts.filter((a) => a.kind === "transformation"),
    [allArtifacts]
  )
  const hasArtifacts = allArtifacts.length > 0

  // Neueste Transformation fuer Ingestion-Status
  const newestTransformation = transformations[0] || null
  const activeTemplateName = newestTransformation?.templateName || null

  // Einzelnes Artefakt loeschen
  const handleDeleteSingle = React.useCallback(async (artifact: MongoArtifact) => {
    if (!props.libraryId || !props.sourceFile?.id) return
    const sourceId = props.sourceFile.id
    const key = artifactKey(artifact)

    setDeletingKey(key)
    try {
      const params = new URLSearchParams({ kind: artifact.kind, lang: artifact.targetLanguage })
      if (artifact.templateName) params.set("template", artifact.templateName)

      const res = await fetch(
        `/api/library/${encodeURIComponent(props.libraryId)}/shadow-twins/${encodeURIComponent(sourceId)}?${params.toString()}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      const label = artifact.kind === "transcript"
        ? `Transcript (${artifact.targetLanguage})`
        : `Transformation (${artifact.targetLanguage}/${artifact.templateName})`
      toast.success("Artefakt geloescht", { description: label })

      // Liste und Shadow-Twin-Analyse aktualisieren
      await fetchAllArtifacts()
      triggerShadowTwinAnalysis((v) => v + 1)
      props.onArtifactsDeleted?.()
    } catch (error) {
      toast.error("Fehler beim Loeschen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler"
      })
    } finally {
      setDeletingKey(null)
    }
  }, [props.libraryId, props.sourceFile?.id, props.onArtifactsDeleted, triggerShadowTwinAnalysis, fetchAllArtifacts])

  // Alle Artefakte loeschen
  const handleDeleteAll = React.useCallback(async () => {
    if (!props.libraryId || !props.sourceFile?.id) return
    setIsDeleting(true)
    try {
      const sourceId = props.sourceFile.id

      // 1. Alle Shadow-Twin-Artefakte aus MongoDB loeschen
      await fetch(
        `/api/library/${encodeURIComponent(props.libraryId)}/shadow-twins/${encodeURIComponent(sourceId)}`,
        { method: "DELETE" }
      )

      // 2. Ingestion-Daten loeschen
      try {
        await fetch(
          `/api/chat/${encodeURIComponent(props.libraryId)}/docs/delete?fileId=${encodeURIComponent(sourceId)}`,
          { method: "DELETE" }
        )
      } catch {
        // optional
      }

      toast.success("Alle Artefakte geloescht")
      await fetchAllArtifacts()
      triggerShadowTwinAnalysis((v) => v + 1)
      props.onArtifactsDeleted?.()
    } catch (error) {
      toast.error("Fehler beim Loeschen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler"
      })
    } finally {
      setIsDeleting(false)
    }
  }, [props.libraryId, props.sourceFile?.id, props.onArtifactsDeleted, triggerShadowTwinAnalysis, fetchAllArtifacts])

  // Einzelne Artefakt-Zeile rendern
  const renderArtifactRow = React.useCallback((artifact: MongoArtifact) => {
    const key = artifactKey(artifact)
    const fileName = buildFileName(base, artifact)
    const isCurrentlyDeleting = deletingKey === key

    return (
      <div key={key} className="group flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
            {artifact.targetLanguage}
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">{fileName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs text-muted-foreground">{formatShort(artifact.updatedAt)}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-30"
                disabled={isCurrentlyDeleting}
                onClick={() => void handleDeleteSingle(artifact)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Dieses Artefakt loeschen</TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }, [base, deletingKey, handleDeleteSingle])

  return (
    <div className="space-y-6 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Sprache: {props.targetLanguage} · Template: {activeTemplateName || "—"} · Dot-Folder: {props.shadowTwinFolderId ? "ja" : "nein"}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              onClick={() => void fetchAllArtifacts()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Artefakte neu laden</TooltipContent>
        </Tooltip>
      </div>

      {/* Phase 1: Transcripts */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 1 · Original transkribieren</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Lade...</div>
        ) : transcripts.length === 0 ? (
          <div className="text-sm text-muted-foreground">Kein Transcript gefunden.</div>
        ) : (
          <div className="space-y-1">{transcripts.map(renderArtifactRow)}</div>
        )}
      </div>

      {/* Phase 2: Transformations */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 2 · Metadaten & Storyinhalte transformieren</div>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Lade...</div>
        ) : transformations.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Transformation gefunden.</div>
        ) : (
          <div className="space-y-1">{transformations.map(renderArtifactRow)}</div>
        )}
      </div>

      {/* Phase 3: Ingestion */}
      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 3 · Story veroeffentlichen</div>
        {!newestTransformation ? (
          <div className="text-sm text-muted-foreground">Keine Transformation → kein Ingestion-Status.</div>
        ) : (
          <div className="rounded-md border p-3">
            <IngestionStatusCompact
              libraryId={props.libraryId}
              fileId={props.sourceFile.id}
              docModifiedAt={newestTransformation.updatedAt}
            />
          </div>
        )}
      </div>

      {/* Alle Artefakte loeschen */}
      {hasArtifacts && (
        <div className="border-t pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? "Wird geloescht..." : `Alle Artefakte loeschen (${allArtifacts.length})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alle {allArtifacts.length} Artefakte loeschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dies loescht alle generierten Artefakte (Transkript, Transformation) in allen Sprachen fuer diese Datei.
                  Die Originaldatei bleibt erhalten. Diese Aktion kann nicht rueckgaengig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDeleteAll()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Alle loeschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="border-t pt-2">
        <div className="text-[11px] text-muted-foreground truncate">fileId: {props.sourceFile.id}</div>
      </div>
    </div>
  )
}
