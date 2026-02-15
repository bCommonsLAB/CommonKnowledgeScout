"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, FileText } from "lucide-react"
import type { WizardSource } from "@/lib/creation/corpus"
import { discoverFolderArtifactsViaApi } from "@/lib/creation/folder-artifact-discovery"
import { cn } from "@/lib/utils"

interface SelectFolderArtifactsStepProps {
  /** Library-ID (für API-Aufruf, unterstützt MongoDB + Filesystem) */
  libraryId: string
  /** ID des Verzeichnisses mit Artefakten */
  folderId: string
  /** Zielsprache für Transcript-Suche */
  targetLanguage?: string
  /** Callback wenn Auswahl geändert wird */
  onSelectionChange: (selectedSources: WizardSource[]) => void
}

/**
 * Step zur Auswahl von Artefakten aus einem Verzeichnis.
 *
 * Zeigt alle transkribierten Dateien (Audio, Video, PDF, Office, Markdown)
 * mit Checkboxen. Ausgewählte Quellen werden an den Parent übergeben.
 */
export function SelectFolderArtifactsStep({
  libraryId,
  folderId,
  targetLanguage = "de",
  onSelectionChange,
}: SelectFolderArtifactsStepProps) {
  const [sources, setSources] = useState<WizardSource[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Discovery beim Mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const discovered = await discoverFolderArtifactsViaApi(
          libraryId,
          folderId,
          targetLanguage
        )
        if (cancelled) return
        setSources(discovered)
        setSelectedIds(new Set(discovered.map((s) => s.id)))
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Fehler beim Laden der Artefakte")
        setSources([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [libraryId, folderId, targetLanguage])

  // Parent über Auswahl informieren
  useEffect(() => {
    const selected = sources.filter((s) => selectedIds.has(s.id))
    onSelectionChange(selected)
  }, [sources, selectedIds, onSelectionChange])

  const toggleSource = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(sources.map((s) => s.id)))
  }, [sources])

  const selectNone = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Lade Artefakte aus dem Verzeichnis…
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Keine Artefakte gefunden</CardTitle>
          <CardDescription>
            In diesem Verzeichnis wurden keine transkribierten Dateien gefunden.
            Stellen Sie sicher, dass Audio-, Video-, PDF- oder Office-Dateien
            bereits verarbeitet wurden.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quellen auswählen</CardTitle>
        <CardDescription>
          Wähle die Artefakte, die für die Transformation verwendet werden sollen.
          Alle ausgewählten Quellen werden in den Kontext geschrieben.
        </CardDescription>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-primary hover:underline"
          >
            Alle auswählen
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            type="button"
            onClick={selectNone}
            className="text-xs text-primary hover:underline"
          >
            Keine auswählen
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors",
              selectedIds.has(source.id) ? "border-primary bg-muted/30" : "border-transparent"
            )}
          >
            <Checkbox
              id={source.id}
              checked={selectedIds.has(source.id)}
              onCheckedChange={() => toggleSource(source.id)}
              className="mt-0.5"
            />
            <label
              htmlFor={source.id}
              className="flex-1 cursor-pointer space-y-1"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{source.fileName}</span>
              </div>
              {source.summary && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {source.summary}
                </p>
              )}
            </label>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
