"use client"

import * as React from "react"

import type { StorageItem } from "@/lib/storage/types"
import { parseArtifactName } from "@/lib/shadow-twin/artifact-naming"
import { IngestionStatusCompact } from "@/components/library/shared/ingestion-status-compact"

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
}

export function ArtifactInfoPanel(props: ArtifactInfoPanelProps) {
  const base = React.useMemo(() => sourceBaseName(props.sourceFile.metadata.name), [props.sourceFile.metadata.name])

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

      <div className="border-t pt-2">
        <div className="text-[11px] text-muted-foreground truncate">fileId: {props.sourceFile.id}</div>
      </div>
    </div>
  )
}


