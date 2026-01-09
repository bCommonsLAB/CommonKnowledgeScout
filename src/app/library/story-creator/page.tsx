"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAtom } from "jotai"
import { parseAsString, useQueryState } from "nuqs"

import { activeLibraryIdAtom } from "@/atoms/library-atom"
import { useStorage } from "@/contexts/storage-context"
import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FileLogger } from "@/lib/debug/logger"
import { FlowActions } from "@/components/library/flow/flow-actions"
import { ShadowTwinViewer } from "@/components/library/flow/shadow-twin-viewer"
import { useShadowTwinArtifacts } from "@/components/library/flow/use-shadow-twin-artifacts"

export default function LibraryStoryCreatorPage() {
  const router = useRouter()
  const { provider, libraryStatus, refreshAuthStatus } = useStorage()
  const [activeLibraryId, setActiveLibraryId] = useAtom(activeLibraryIdAtom)

  const [libraryIdParam] = useQueryState("libraryId", parseAsString.withDefault(""))
  const [fileIdParam] = useQueryState("fileId", parseAsString.withDefault(""))
  const [parentIdParam] = useQueryState("parentId", parseAsString.withDefault(""))
  const [targetLanguageParam] = useQueryState("targetLanguage", parseAsString.withDefault("de"))
  // mobile-first: default hidden, since user just saw the source in file-list preview
  const [leftPaneParam] = useQueryState("left", parseAsString.withDefault("off"))
  const [transformationIdParam] = useQueryState("transformationId", parseAsString.withDefault(""))

  const [file, setFile] = React.useState<StorageItem | null>(null)
  const [streamingUrl, setStreamingUrl] = React.useState<string | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Sync active library from URL (same intent as LibraryUrlHandler, but Story Creator is a separate page)
  React.useEffect(() => {
    if (!libraryIdParam) return
    if (libraryIdParam === activeLibraryId) return
    setActiveLibraryId(libraryIdParam)
    try {
      localStorage.setItem("activeLibraryId", libraryIdParam)
    } catch {}
    refreshAuthStatus()
  }, [libraryIdParam, activeLibraryId, setActiveLibraryId, refreshAuthStatus])

  // Load file + streaming URL
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadError(null)
      setFile(null)
      setStreamingUrl(null)

      if (!provider || libraryStatus !== "ready") return
      if (!fileIdParam) {
        setLoadError("fileId fehlt in der URL.")
        return
      }

      try {
        const it = await provider.getItemById(fileIdParam)
        if (cancelled) return
        setFile(it)

        if (it.type === "file") {
          try {
            const url = await provider.getStreamingUrl(it.id)
            if (!cancelled) setStreamingUrl(url)
          } catch (err) {
            FileLogger.warn("story-creator", "Streaming URL konnte nicht geladen werden", {
              fileId: it.id,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [provider, libraryStatus, fileIdParam])

  const effectiveParentId = parentIdParam || file?.parentId || ""
  const shadowTwin = useShadowTwinArtifacts({
    provider,
    parentId: effectiveParentId,
    sourceFile: file,
    targetLanguage: targetLanguageParam || "de",
  })
  const shouldPromptPipeline = Boolean(
    file &&
      shadowTwin.hasChecked &&
      !shadowTwin.shadowTwinFolderId &&
      !shadowTwin.transcriptItem &&
      shadowTwin.transformations.length === 0
  )

  const backToLibrary = React.useCallback(() => {
    if (effectiveParentId) {
      router.push(`/library?folderId=${encodeURIComponent(effectiveParentId)}`)
      return
    }
    router.push("/library")
  }, [router, effectiveParentId])

  const backHref = React.useMemo(() => {
    if (effectiveParentId) return `/library?folderId=${encodeURIComponent(effectiveParentId)}`
    return "/library"
  }, [effectiveParentId])

  React.useEffect(() => {
    if (!file?.metadata?.name) return
    document.title = `${file.metadata.name} – Story Creator`
  }, [file?.metadata?.name])

  if (loadError) {
    return (
      <div className="p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTitle>Story Creator: Fehler</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={backToLibrary} variant="outline">
            Zurück zur Bibliothek
          </Button>
        </div>
      </div>
    )
  }

  if (!provider || libraryStatus !== "ready") {
    return (
      <div className="p-4 md:p-6">
        <Skeleton className="h-10 w-48" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[50vh] w-full" />
          <Skeleton className="h-[50vh] w-full" />
        </div>
      </div>
    )
  }

  if (!file) {
    return (
      <div className="p-4 md:p-6">
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[50vh] w-full" />
          <Skeleton className="h-[50vh] w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] p-3 md:p-6">
      <div className="min-h-0 h-full overflow-hidden rounded border">
        <div className="flex h-full flex-col">
          <FlowActions
            libraryId={activeLibraryId}
            sourceFile={file}
            parentId={effectiveParentId}
            streamingUrl={streamingUrl}
            backHref={backHref}
            transformations={shadowTwin.transformations}
            shadowTwinFolderId={shadowTwin.shadowTwinFolderId}
            shouldPromptPipeline={shouldPromptPipeline}
          />
          <div className="min-h-0 flex-1 overflow-hidden p-0">
            <ShadowTwinViewer
              libraryId={activeLibraryId}
              provider={provider}
              sourceFile={file}
              parentId={effectiveParentId}
              streamingUrl={streamingUrl}
              targetLanguage={targetLanguageParam || "de"}
              leftPaneMode={leftPaneParam}
              activeTransformationId={transformationIdParam}
              transcriptItem={shadowTwin.transcriptItem}
              transformations={shadowTwin.transformations}
              shadowTwinFolderId={shadowTwin.shadowTwinFolderId}
              shadowTwinLoading={shadowTwin.isLoading}
              shadowTwinError={shadowTwin.error}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


