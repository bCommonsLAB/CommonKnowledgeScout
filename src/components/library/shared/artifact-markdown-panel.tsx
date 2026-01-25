"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { FileLogger } from "@/lib/debug/logger"
import { ArtifactEditDialog } from "@/components/library/shared/artifact-edit-dialog"
import { cn } from "@/lib/utils"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"

interface ArtifactMarkdownPanelProps {
  title: string
  titleClassName?: string
  item: StorageItem | null
  provider: StorageProvider | null
  libraryId?: string
  emptyHint: string
  stripFrontmatter?: boolean
  onSaved?: (item: StorageItem) => void
  additionalActions?: React.ReactNode
}

// Entfernt Frontmatter fuer reine Vorschau ohne Metadaten-Block.
function stripFrontmatterBlock(markdown: string): string {
  return markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, "")
}

export function ArtifactMarkdownPanel({
  title,
  titleClassName,
  item,
  provider,
  libraryId,
  emptyHint,
  stripFrontmatter = false,
  onSaved,
  additionalActions,
}: ArtifactMarkdownPanelProps) {
  const [currentItem, setCurrentItem] = React.useState<StorageItem | null>(item)
  const [content, setContent] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)

  React.useEffect(() => {
    setCurrentItem(item || null)
  }, [item])

  // Laedt den aktuellen Artefakt-Inhalt:
  // - Mongo-ID: per API
  // - Filesystem-ID: per Provider
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!currentItem?.id) {
        setContent("")
        setError(null)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        if (isMongoShadowTwinId(currentItem.id)) {
          const parts = parseMongoShadowTwinId(currentItem.id)
          if (!parts || !libraryId) {
            throw new Error("Mongo-ID ohne Library-Kontext.")
          }
          const text = await fetchShadowTwinMarkdown(libraryId, parts)
          if (cancelled) return
          setContent(text)
          return
        }

        if (!provider) {
          throw new Error("Storage-Provider fehlt.")
        }

        const { blob } = await provider.getBinary(currentItem.id)
        const text = await blob.text()
        if (cancelled) return
        setContent(text)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        FileLogger.error("ArtifactMarkdownPanel", "Laden fehlgeschlagen", { message })
        setError(message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [provider, currentItem?.id, libraryId])

  if (!currentItem) {
    return <div className="text-sm text-muted-foreground">{emptyHint}</div>
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lade Inhalt…</div>
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const previewContent = stripFrontmatter ? stripFrontmatterBlock(content) : content

  const hasTitle = typeof title === "string" && title.trim().length > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {hasTitle ? <div className={cn("text-sm font-medium", titleClassName)}>{title}</div> : <div />}
        <div className="flex items-center gap-2">
          {additionalActions}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            disabled={!provider && !(libraryId && currentItem?.id && isMongoShadowTwinId(currentItem.id))}
          >
            Bearbeiten
          </Button>
        </div>
      </div>
      <div className="rounded border">
        <MarkdownPreview
          content={previewContent}
          currentFolderId={currentItem.parentId}
          provider={provider}
          className="max-h-[70vh]"
          compact
        />
      </div>
      <ArtifactEditDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        item={currentItem}
        provider={provider}
        libraryId={libraryId}
        onSaved={(saved) => {
          setCurrentItem(saved)
          onSaved?.(saved)
        }}
      />
    </div>
  )
}

