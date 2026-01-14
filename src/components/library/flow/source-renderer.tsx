"use client"

import * as React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { FileLogger } from "@/lib/debug/logger"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface SourceRendererProps {
  provider: StorageProvider
  file: StorageItem
  streamingUrl?: string | null
  /**
   * Standard: true (zeigt "Quelle" + "Im neuen Tab öffnen").
   * Flow‑View hat diese Controls bereits im Header, daher dort false.
   */
  showHeader?: boolean
}

export function SourceRenderer({
  provider,
  file,
  streamingUrl: streamingUrlProp,
  showHeader = true,
}: SourceRendererProps) {
  const kind = getMediaKind(file)
  const [streamingUrl, setStreamingUrl] = React.useState<string | null>(streamingUrlProp || null)
  const lastFileIdRef = React.useRef<string | null>(null)

  // Reset state when file.id changes
  React.useEffect(() => {
    if (lastFileIdRef.current !== file.id) {
      lastFileIdRef.current = file.id
      setStreamingUrl(streamingUrlProp || null)
    }
  }, [file.id, streamingUrlProp])

  // Load streaming URL if not provided via prop
  React.useEffect(() => {
    let cancelled = false
    async function loadUrl() {
      // If URL already set (from prop or previous load), skip
      if (streamingUrl) return
      // If prop is provided, don't load (it will be synced by the effect above)
      if (streamingUrlProp) return
      if (file.type !== "file") return
      if (lastFileIdRef.current !== file.id) return // Guard: only load for current file
      
      try {
        FileLogger.debug("flow-source-renderer", "Lade Streaming-URL", {
          fileId: file.id,
          fileName: file.metadata?.name,
        })
        const url = await provider.getStreamingUrl(file.id)
        if (cancelled) return
        if (lastFileIdRef.current !== file.id) return // Guard: file changed during load
        setStreamingUrl(url)
        FileLogger.debug("flow-source-renderer", "Streaming-URL geladen", {
          fileId: file.id,
          hasUrl: !!url,
        })
      } catch (err) {
        if (cancelled) return
        if (lastFileIdRef.current !== file.id) return // Guard: file changed during error
        FileLogger.warn("flow-source-renderer", "Streaming URL konnte nicht geladen werden", {
          fileId: file.id,
          error: err instanceof Error ? err.message : String(err),
        })
        // Don't set error state - just leave streamingUrl as null to show loading message
      }
    }
    void loadUrl()
    return () => {
      cancelled = true
    }
  }, [provider, file.id, file.type, file.metadata?.name, streamingUrl, streamingUrlProp])

  const openInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const header = showHeader ? (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-xs text-muted-foreground">Quelle</div>
        <div className="truncate text-sm font-medium">{file.metadata?.name}</div>
      </div>
      <Button size="sm" variant="secondary" onClick={openInNewTab} disabled={!streamingUrl}>
        Im neuen Tab öffnen
      </Button>
    </div>
  ) : null

  const body = (() => {
    if (!streamingUrl) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Streaming-URL wird geladen…
        </div>
      )
    }

    if (kind === "pdf") {
      return <iframe title={file.metadata.name} src={streamingUrl} className="h-full w-full" />
    }

    if (kind === "audio") {
      return (
        <div className="p-4">
          <audio controls src={streamingUrl} className="w-full" />
        </div>
      )
    }

    if (kind === "video") {
      return (
        <div className="h-full w-full">
          <video controls src={streamingUrl} className="h-full w-full" />
        </div>
      )
    }

    if (kind === "image") {
      // next/image requires width/height. We use fill + container sizing.
      return (
        <div className="relative h-full w-full">
          <Image src={streamingUrl} alt={file.metadata.name} fill className="object-contain" />
        </div>
      )
    }

    return showHeader ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <div>Keine Inline-Vorschau für diesen Dateityp.</div>
        <Button variant="outline" onClick={openInNewTab}>
          Quelle öffnen
        </Button>
      </div>
    ) : (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Keine Inline-Vorschau für diesen Dateityp.
      </div>
    )
  })()

  return (
    <div className="flex h-full flex-col">
      {header}
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  )
}


