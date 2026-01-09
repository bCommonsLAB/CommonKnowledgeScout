"use client"

import * as React from "react"
import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { resolveArtifactClient } from "@/lib/shadow-twin/artifact-client"
import type { ResolvedArtifact } from "@/lib/shadow-twin/artifact-resolver"
import { JobReportTab } from "@/components/library/job-report-tab"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { FileLogger } from "@/lib/debug/logger"

interface ArtifactTabsProps {
  libraryId: string
  sourceFile: StorageItem
  provider: StorageProvider | null
  parentId: string
  targetLanguage: string
  templateName?: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function ArtifactTabs({
  libraryId,
  sourceFile,
  provider,
  parentId,
  targetLanguage,
  templateName,
}: ArtifactTabsProps) {
  const [loading, setLoading] = React.useState(false)
  const [resolved, setResolved] = React.useState<ResolvedArtifact | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        setError(null)
        setResolved(null)

        if (!libraryId || !sourceFile?.id || !isNonEmptyString(sourceFile?.metadata?.name) || !parentId) {
          setError("Ungültige Parameter (libraryId/sourceFile/parentId).")
          return
        }

        // Prefer transformation only if we know which template to resolve.
        // Without templateName, a deterministic v2 resolver cannot guess the transformation name.
        const tryTransformationFirst = isNonEmptyString(templateName)

        const preferred: ResolvedArtifact | null = tryTransformationFirst
          ? await resolveArtifactClient({
              libraryId,
              sourceId: sourceFile.id,
              sourceName: sourceFile.metadata.name,
              parentId,
              targetLanguage,
              templateName,
              preferredKind: "transformation",
            })
          : null

        const fallback: ResolvedArtifact | null =
          preferred ||
          (await resolveArtifactClient({
            libraryId,
            sourceId: sourceFile.id,
            sourceName: sourceFile.metadata.name,
            parentId,
            targetLanguage,
            preferredKind: "transcript",
          }))

        if (cancelled) return
        setResolved(fallback)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        FileLogger.error("flow-artifact-tabs", "Artefakt-Auflösung fehlgeschlagen", { msg })
        setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [libraryId, sourceFile?.id, sourceFile?.metadata?.name, parentId, targetLanguage, templateName])

  if (loading) {
    return (
      <div className="p-3">
        <Skeleton className="h-8 w-40" />
        <div className="mt-3 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3">
        <Alert variant="destructive">
          <AlertTitle>Artefakt-Inspector: Fehler</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!resolved?.fileId) {
    return (
      <div className="p-3">
        <Alert>
          <AlertTitle>Kein Shadow‑Twin Artefakt gefunden</AlertTitle>
          <AlertDescription>
            Es wurde weder eine Transformation (Template) noch ein Transcript gefunden. Bitte zuerst den Flow starten
            (Transcribe/Extract) oder prüfen, ob die Datei bereits ein Shadow‑Twin‑Verzeichnis hat.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="h-full">
      <JobReportTab
        libraryId={libraryId}
        fileId={sourceFile.id}
        fileName={sourceFile.metadata.name}
        provider={provider}
        mdFileId={resolved.fileId}
        sourceMode="merged"
        viewMode="full"
      />
    </div>
  )
}



