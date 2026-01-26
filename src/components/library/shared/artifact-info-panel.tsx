"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useSetAtom } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { parseArtifactName } from "@/lib/shadow-twin/artifact-naming"
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

type ArtifactPhase = "extract" | "template" | "ingest"

interface ArtifactRow {
  phase: ArtifactPhase
  label: string
  fileName: string
  fileId: string
  modifiedAtIso?: string
  templateName?: string | null
  targetLanguage?: string | null
  location?: "dotFolder" | "sibling" | "unknown"
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined
  }
  return undefined
}

function sourceBaseName(sourceName: string): string {
  const trimmed = sourceName.trim()
  const lastDot = trimmed.lastIndexOf(".")
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed
}

function formatShort(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return "—"
  return d.toLocaleString("de-DE", { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export interface ArtifactInfoPanelProps {
  libraryId: string
  sourceFile: StorageItem
  /**
   * Falls vorhanden: Dot-Folder Id aus Shadow-Twin Analyse (schnell).
   * Wichtig: Wir triggern hier absichtlich KEIN Dot-Folder Listing, weil das
   * beim Tab-Wechsel teuer sein kann (Storage-Request). Die Info-Ansicht ist
   * "Atom-only" und zeigt nur, was die Shadow-Twin-Analyse bereits geliefert hat.
   */
  shadowTwinFolderId?: string | null
  /**
   * Optional: bereits bekannte Artefakte (z.B. aus shadowTwinStateAtom).
   * Das ist die kanonische Datenquelle für dieses Panel.
   */
  transcriptFiles?: StorageItem[]
  transformed?: StorageItem
  targetLanguage: string
  /**
   * Callback wenn Artefakte geloescht wurden.
   * Wird aufgerufen nach erfolgreichem Loeschen aller Artefakte.
   */
  onArtifactsDeleted?: () => void
}

export function ArtifactInfoPanel(props: ArtifactInfoPanelProps) {
  const base = React.useMemo(() => sourceBaseName(props.sourceFile.metadata.name), [props.sourceFile.metadata.name])
  const [isDeleting, setIsDeleting] = React.useState(false)
  const triggerShadowTwinAnalysis = useSetAtom(shadowTwinAnalysisTriggerAtom)

  // Berechne ob es Artefakte zum Loeschen gibt
  const hasArtifacts = React.useMemo(() => {
    const hasTranscripts = Array.isArray(props.transcriptFiles) && props.transcriptFiles.length > 0
    const hasTransformed = !!props.transformed
    return hasTranscripts || hasTransformed
  }, [props.transcriptFiles, props.transformed])

  // Alle Artefakte loeschen
  const handleDeleteAllArtifacts = React.useCallback(async () => {
    if (!props.libraryId) return
    if (!props.sourceFile?.id) return
    
    setIsDeleting(true)
    try {
      // Strategie: 
      // 1. Shadow-Twin-API aufrufen (loescht alle MongoDB-basierten Artefakte)
      // 2. Fuer normale Storage-Dateien: einzeln loeschen
      
      const sourceId = props.sourceFile.id
      let shadowTwinDeleted = false
      let ingestionDeleted = false
      let storageFilesDeleted = 0
      let storageFilesFailed = 0
      
      // 1. Shadow-Twin-Artefakte aus MongoDB loeschen
      try {
        const shadowTwinRes = await fetch(
          `/api/library/${encodeURIComponent(props.libraryId)}/shadow-twins/${encodeURIComponent(sourceId)}`,
          { method: "DELETE" }
        )
        if (shadowTwinRes.ok) {
          shadowTwinDeleted = true
        }
      } catch {
        // Shadow-Twin-Loeschung ist optional, kein Fehler
      }
      
      // 2. Ingestion-Daten loeschen (Vektoren, DocMeta, Chunks)
      try {
        const ingestionRes = await fetch(
          `/api/chat/${encodeURIComponent(props.libraryId)}/docs/delete?fileId=${encodeURIComponent(sourceId)}`,
          { method: "DELETE" }
        )
        if (ingestionRes.ok) {
          ingestionDeleted = true
        }
      } catch {
        // Ingestion-Loeschung ist optional, kein Fehler
      }
      
      // 3. Normale Storage-Dateien loeschen (nur wenn ID nicht mit mongo-shadow-twin beginnt)
      const storageFileIds: string[] = []
      
      if (Array.isArray(props.transcriptFiles)) {
        for (const t of props.transcriptFiles) {
          if (!t.id.startsWith("mongo-shadow-twin:")) {
            storageFileIds.push(t.id)
          }
        }
      }
      
      if (props.transformed && !props.transformed.id.startsWith("mongo-shadow-twin:")) {
        storageFileIds.push(props.transformed.id)
      }
      
      // Storage-Dateien parallel loeschen
      if (storageFileIds.length > 0) {
        const deletePromises = storageFileIds.map(async (fileId) => {
          const res = await fetch(
            `/api/library/${encodeURIComponent(props.libraryId)}/items/${encodeURIComponent(fileId)}`,
            { method: "DELETE" }
          )
          if (!res.ok) {
            const json = await res.json().catch(() => ({})) as { error?: string }
            throw new Error(json.error || `HTTP ${res.status}`)
          }
          return fileId
        })
        
        const results = await Promise.allSettled(deletePromises)
        storageFilesDeleted = results.filter((r) => r.status === "fulfilled").length
        storageFilesFailed = results.filter((r) => r.status === "rejected").length
      }
      
      // Feedback
      if (shadowTwinDeleted || ingestionDeleted || storageFilesDeleted > 0) {
        if (storageFilesFailed > 0) {
          toast.warning("Teilweise geloescht", {
            description: `Einige Artefakte konnten nicht geloescht werden.`
          })
        } else {
          const parts: string[] = []
          if (shadowTwinDeleted) parts.push("Artefakte")
          if (ingestionDeleted) parts.push("Ingestion-Daten")
          if (storageFilesDeleted > 0) parts.push(`${storageFilesDeleted} Dateien`)
          toast.success("Geloescht", {
            description: `${parts.join(", ")} wurden erfolgreich geloescht.`
          })
        }
      } else if (!shadowTwinDeleted && !ingestionDeleted && storageFilesDeleted === 0) {
        toast.info("Keine Artefakte", { 
          description: "Es gab keine Artefakte zum Loeschen." 
        })
      }
      
      // Shadow-Twin-Analyse neu triggern um UI zu aktualisieren
      triggerShadowTwinAnalysis((v) => v + 1)
      // Optional: zusaetzlicher Callback
      props.onArtifactsDeleted?.()
      
    } catch (error) {
      toast.error("Fehler beim Loeschen", {
        description: error instanceof Error ? error.message : "Unbekannter Fehler"
      })
    } finally {
      setIsDeleting(false)
    }
  }, [props.libraryId, props.sourceFile?.id, props.transcriptFiles, props.transformed, props.onArtifactsDeleted, triggerShadowTwinAnalysis])

  const rows = React.useMemo<ArtifactRow[]>(() => {
    // Atom-only: KEIN Dot-Folder Listing (Performance).
    const out: ArtifactRow[] = []

    const transcript = Array.isArray(props.transcriptFiles) ? props.transcriptFiles : []
    for (const t of transcript) {
      out.push({
        phase: "extract",
        label: "Transcript",
        fileName: String(t.metadata.name),
        fileId: t.id,
        modifiedAtIso: toIso(t.metadata.modifiedAt),
        targetLanguage: parseArtifactName(String(t.metadata.name), base).targetLanguage,
        location: "unknown",
      })
    }

    if (props.transformed) {
      const parsed = parseArtifactName(String(props.transformed.metadata.name), base)
      out.push({
        phase: "template",
        label: "Transformation",
        fileName: String(props.transformed.metadata.name),
        fileId: props.transformed.id,
        modifiedAtIso: toIso(props.transformed.metadata.modifiedAt),
        templateName: parsed.templateName,
        targetLanguage: parsed.targetLanguage,
        location: "unknown",
      })
    }

    out.sort((a, b) => (b.modifiedAtIso || "").localeCompare(a.modifiedAtIso || ""))
    return out
  }, [props.transcriptFiles, props.transformed, base])

  const transformations = rows.filter((r) => r.phase === "template")
  const transcripts = rows.filter((r) => r.phase === "extract")
  const newestTransformation = transformations[0] || null
  const ingestionFileId = props.sourceFile.id
  const activeTemplateName = newestTransformation?.templateName || null

  return (
    <div className="space-y-6 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Sprache: {props.targetLanguage} · Template: {activeTemplateName || "—"} · Dot‑Folder: {props.shadowTwinFolderId ? "ja" : "nein"}
        </div>
        <div className="text-xs text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 1 · Original transkribieren</div>
        {transcripts.length === 0 ? (
          <div className="text-sm text-muted-foreground">Kein Transcript gefunden.</div>
        ) : (
          <div className="space-y-1">
            {transcripts.map((t) => (
              <div key={t.fileId} className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs text-muted-foreground">{t.fileName}</div>
                <div className="shrink-0 text-xs text-muted-foreground">{formatShort(t.modifiedAtIso)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 2 · Metadaten & Storyinhalte transformieren</div>
        {transformations.length === 0 ? (
          <div className="text-sm text-muted-foreground">Keine Transformation gefunden.</div>
        ) : (
          <div className="space-y-1">
            {transformations.map((t) => (
              <div key={t.fileId} className="flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-xs text-muted-foreground">{t.fileName}</div>
                <div className="shrink-0 text-xs text-muted-foreground">{formatShort(t.modifiedAtIso)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold">Phase 3 · Story veröffentlichen</div>
        {!newestTransformation ? (
          <div className="text-sm text-muted-foreground">Keine Transformation → kein Ingestion‑Status.</div>
        ) : (
          <div className="rounded-md border p-3">
            <IngestionStatusCompact
              libraryId={props.libraryId}
              fileId={ingestionFileId}
              docModifiedAt={newestTransformation.modifiedAtIso}
            />
          </div>
        )}
      </div>

      {/* Alle Artefakte loeschen Button */}
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
                {isDeleting ? "Wird geloescht..." : "Alle Artefakte loeschen"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Alle Artefakte loeschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dies loescht alle generierten Artefakte (Transkript, Transformation) fuer diese Datei.
                  Die Originaldatei bleibt erhalten. Diese Aktion kann nicht rueckgaengig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDeleteAllArtifacts()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Loeschen
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


