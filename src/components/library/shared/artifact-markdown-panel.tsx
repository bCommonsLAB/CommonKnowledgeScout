"use client"

import * as React from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { MarkdownPreview, type CompositeWikiPreviewOptions } from "@/components/library/markdown-preview"
import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import type { Library } from "@/types/library"
import { FileLogger } from "@/lib/debug/logger"
import { ArtifactEditDialog } from "@/components/library/shared/artifact-edit-dialog"
import { cn } from "@/lib/utils"
import { Pencil } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"
import { parseFrontmatter } from "@/lib/markdown/frontmatter"
import { activeLibraryAtom, selectedFileAtom } from "@/atoms/library-atom"
import { isFilesystemBacked } from "@/lib/storage/library-capability"

interface ArtifactMarkdownPanelProps {
  title: string
  titleClassName?: string
  /** Zusätzliches Element neben dem Titel (z.B. Sprach-Dropdown) */
  headerExtra?: React.ReactNode
  item: StorageItem | null
  provider: StorageProvider | null
  libraryId?: string
  emptyHint: string
  stripFrontmatter?: boolean
  onSaved?: (item: StorageItem) => void
  additionalActions?: React.ReactNode
  /**
   * Optional: Callback fuer Klicks auf interne Datei-Links im Composite-Markdown.
   * Wenn nicht gesetzt, sind Wikilinks zwar sichtbar, aber nicht klickbar.
   * In `file-preview.tsx` wird hier `onWikiNavigateToFile` durchgereicht,
   * um zur Geschwister-Datei zu wechseln.
   */
  onNavigateToFile?: CompositeWikiPreviewOptions["onNavigateToFile"]
}

/**
 * Frontmatter-Pruefung: Liefert true, wenn das Markdown ein Composite-
 * Container ist (`composite-multi` oder `composite-transcript`).
 * Solche Container haben spezielle Wikilink-/Embed-Syntax, die nur dann
 * korrekt gerendert wird, wenn `compositeWikiPreview` gesetzt ist.
 */
function isCompositeContainerContent(content: string): boolean {
  if (!content?.trim()) return false
  const { meta } = parseFrontmatter(content)
  return meta?.kind === "composite-transcript" || meta?.kind === "composite-multi"
}

// Entfernt Frontmatter fuer reine Vorschau ohne Metadaten-Block.
function stripFrontmatterBlock(markdown: string): string {
  return markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, "")
}

export function ArtifactMarkdownPanel({
  title,
  titleClassName,
  headerExtra,
  item,
  provider,
  libraryId,
  emptyHint,
  stripFrontmatter = false,
  onSaved,
  additionalActions,
  onNavigateToFile,
}: ArtifactMarkdownPanelProps) {
  const [currentItem, setCurrentItem] = React.useState<StorageItem | null>(item)
  const [content, setContent] = React.useState<string>("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  // Wir lesen die aktive Library aus dem Atom, um `injectMongoTranscriptLinks`
  // korrekt zu setzen (true bei Mongo-only, false bei Filesystem-backed).
  const activeLibrary = useAtomValue(activeLibraryAtom)
  // Default-Navigationssetter: wenn kein onNavigateToFile-Prop uebergeben wird,
  // setzen wir die globale File-Selection. So funktionieren Composite-Klicks
  // auch ohne dass jeder Aufrufer ein Callback durchreicht.
  const setSelectedFile = useSetAtom(selectedFileAtom)
  // Sibling-Map (Dateiname → fileId). Wird nur bei Composite-Inhalt geladen.
  const [siblingNameToId, setSiblingNameToId] = React.useState<Record<string, string>>({})

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
  }, [provider, currentItem?.id, currentItem?.metadata?.modifiedAt, libraryId])

  // WICHTIG (Rules of Hooks):
  // Alle weiteren Hooks (useEffect/useCallback/useMemo) MUESSEN vor den
  // Early-Returns weiter unten stehen. Andernfalls wechselt die Hook-Reihenfolge
  // zwischen Renders (z.B. wenn `isLoading` von true→false geht), was zur
  // bekannten Fehlermeldung "change in the order of Hooks" fuehrt.

  // Composite-Erkennung erfolgt am ROHEN Inhalt (mit Frontmatter), denn nur dort
  // steht das `kind`-Feld. Bei leerem Content ist das Ergebnis schlicht `false`.
  const isCompositeContainer = isCompositeContainerContent(content)

  // Lade die Geschwister-Datei-Liste (Dateiname → fileId), wenn ein Composite
  // erkannt wurde und alle benoetigten Kontextwerte vorhanden sind.
  // Dies ist die zentrale Voraussetzung dafuer, dass Wikilinks und eingebettete
  // Bilder im Composite-Markdown aufgeloest werden koennen.
  React.useEffect(() => {
    if (!isCompositeContainer || !libraryId || !currentItem?.id) {
      setSiblingNameToId({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/sibling-files`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceId: currentItem.id }),
        })
        if (!res.ok || cancelled) return
        const json = (await res.json()) as { files: Array<{ id: string; name: string }> }
        const map: Record<string, string> = {}
        for (const f of json.files ?? []) map[f.name] = f.id
        if (!cancelled) setSiblingNameToId(map)
      } catch (e) {
        // Vorschau darf bei Netzwerkfehlern nicht abbrechen — wir zeigen
        // dann eben keine aufgeloesten Bilder/Links, der Markdown bleibt
        // jedoch lesbar. Logging laut no-silent-fallbacks-Regel.
        FileLogger.warn("ArtifactMarkdownPanel", "sibling-files konnte nicht geladen werden", {
          message: e instanceof Error ? e.message : String(e),
        })
        if (!cancelled) setSiblingNameToId({})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCompositeContainer, libraryId, currentItem?.id])

  // Default-Navigation per globalem `selectedFileAtom`, damit Aufrufer das
  // `onNavigateToFile`-Prop nicht explizit setzen muessen. Wenn ein expliziter
  // Callback uebergeben wurde, hat dieser Vorrang (z. B. wenn der Aufrufer
  // zusaetzlich noch den Tab wechseln will).
  const defaultNavigateToFile = React.useCallback<CompositeWikiPreviewOptions["onNavigateToFile"]>(
    async (targetFileId) => {
      if (!provider) return
      try {
        const target = await provider.getItemById(targetFileId)
        if (target) setSelectedFile(target)
      } catch (e) {
        FileLogger.warn("ArtifactMarkdownPanel", "Wiki-Navigation zu Datei fehlgeschlagen", {
          message: e instanceof Error ? e.message : String(e),
        })
      }
    },
    [provider, setSelectedFile]
  )

  // Bauen wir das Optionsobjekt fuer die Composite-Wiki-Preview im Renderer.
  // Vorteil dieser Variante (Variante B): jeder Aufrufer von ArtifactMarkdownPanel
  // profitiert automatisch — ohne dass das Prop `compositeWikiPreview` durchgereicht
  // werden muss. Damit ist die Vereinheitlichung gegenueber dem Original-Tab gegeben.
  const compositeWikiPreview = React.useMemo<CompositeWikiPreviewOptions | null>(() => {
    if (!isCompositeContainer || !libraryId || !currentItem) return null
    const transcriptOnFs = isFilesystemBacked(activeLibrary as Library | null | undefined)
    return {
      libraryId,
      parentFolderId: currentItem.parentId ?? "",
      siblingNameToId,
      injectMongoTranscriptLinks: !transcriptOnFs,
      onNavigateToFile: onNavigateToFile ?? defaultNavigateToFile,
    }
  }, [
    isCompositeContainer,
    libraryId,
    currentItem,
    siblingNameToId,
    activeLibrary,
    onNavigateToFile,
    defaultNavigateToFile,
  ])

  // Ab hier KEINE Hooks mehr — nur reine Rendervarianten / Early-Returns.
  if (!currentItem) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeof title === "string" && title.trim().length > 0 ? (
              <div className={cn("text-sm font-medium", titleClassName)}>{title}</div>
            ) : (
              <div />
            )}
            {headerExtra}
          </div>
          <div className="flex items-center gap-2">
            {additionalActions}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{emptyHint}</div>
      </div>
    )
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
        <div className="flex items-center gap-2">
          {hasTitle ? <div className={cn("text-sm font-medium", titleClassName)}>{title}</div> : <div />}
          {headerExtra}
        </div>
        <div className="flex items-center gap-2">
          {additionalActions}
          {/* Icon-only wie Transkript-Toolbar; Tooltip ersetzt den früheren Button-Text. */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setIsEditOpen(true)}
                  disabled={!provider && !(libraryId && currentItem?.id && isMongoShadowTwinId(currentItem.id))}
                  aria-label="Bearbeiten"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Bearbeiten</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="rounded border">
        <MarkdownPreview
          content={previewContent}
          currentFolderId={currentItem.parentId}
          provider={provider}
          className="max-h-[70vh]"
          compact
          compositeWikiPreview={compositeWikiPreview}
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

