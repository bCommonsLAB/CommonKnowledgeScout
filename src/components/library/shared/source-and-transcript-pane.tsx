"use client"

import * as React from "react"

import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { SourceRenderer } from "@/components/library/flow/source-renderer"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"

type MediaType = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

function getMediaType(file: StorageItem): MediaType {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

export interface SourceAndTranscriptPaneProps {
  provider: StorageProvider
  sourceFile: StorageItem
  streamingUrl: string | null
  /**
   * Wird benötigt, um Mongo-Shadow-Twins (virtuelle IDs) per API aufzulösen.
   */
  libraryId?: string
  /**
   * Wird optional übergeben (Flow kennt es via Shadow‑Twin Analyse).
   * In der File‑Liste wird es via Resolver gesucht.
   */
  transcriptItem: StorageItem | null
  /**
   * Für PDF:
   * - 'transcript' zeigt links das Transcript (statt PDF)
   * - sonst zeigt links die Quelle
   *
   * Für Audio/Video ist der Wert egal (Audio zeigt Quelle + Transcript darunter).
   */
  leftPaneMode: string
}

export function SourceAndTranscriptPane(props: SourceAndTranscriptPaneProps) {
  const mediaType = getMediaType(props.sourceFile)
  const leftMode = props.leftPaneMode

  const [transcriptText, setTranscriptText] = React.useState<string>("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [transcriptError, setTranscriptError] = React.useState<string | null>(null)

  const shouldLoadTranscript = mediaType === "audio" || (mediaType === "pdf" && leftMode === "transcript")
  React.useEffect(() => {
    let cancelled = false

    async function loadTranscript() {
      setTranscriptError(null)
      setTranscriptText("")
      if (!props.transcriptItem) return
      if (!shouldLoadTranscript) return

      try {
        setIsTranscriptLoading(true)
        // Mongo-Shadow-Twins sind virtuelle IDs und existieren nicht als Datei im Provider.
        // Daher muss der Inhalt über die Mongo-Content-API geladen werden.
        if (isMongoShadowTwinId(props.transcriptItem.id)) {
          const parts = parseMongoShadowTwinId(props.transcriptItem.id)
          if (!parts || !props.libraryId) {
            throw new Error("Mongo-Shadow-Twin kann ohne libraryId nicht geladen werden.")
          }
          const text = await fetchShadowTwinMarkdown(props.libraryId, parts)
          if (cancelled) return
          setTranscriptText(text)
          return
        }

        const { blob } = await props.provider.getBinary(props.transcriptItem.id)
        const text = await blob.text()
        if (cancelled) return
        setTranscriptText(text)
      } catch (e) {
        if (cancelled) return
        setTranscriptError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setIsTranscriptLoading(false)
      }
    }

    void loadTranscript()
    return () => {
      cancelled = true
    }
  }, [props.provider, props.transcriptItem, props.libraryId, shouldLoadTranscript])

  if (mediaType === "pdf") {
    if (leftMode === "transcript") {
      return (
        <div className="h-full overflow-auto p-3">
          {!props.transcriptItem ? (
            <div className="text-sm text-muted-foreground">Kein Transcript vorhanden.</div>
          ) : transcriptError ? (
            <div className="text-sm text-destructive">{transcriptError}</div>
          ) : isTranscriptLoading ? (
            <div className="text-sm text-muted-foreground">Lade Transcript…</div>
          ) : (
            <MarkdownPreview content={transcriptText} compact className="h-full" />
          )}
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col">
        <div className="border-b bg-muted/20 px-3 py-2 text-xs text-muted-foreground truncate">
          {props.sourceFile.metadata?.name}
        </div>
        <div className="min-h-0 flex-1">
          <SourceRenderer
            provider={props.provider}
            file={props.sourceFile}
            streamingUrl={props.streamingUrl}
            showHeader={false}
          />
        </div>
      </div>
    )
  }

  if (mediaType === "audio") {
    return (
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <SourceRenderer provider={props.provider} file={props.sourceFile} streamingUrl={props.streamingUrl} showHeader={false} />
        </div>

        <div className="min-h-0 flex-1 border-t">
          <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Transcript (Shadow‑Twin{props.transcriptItem?.metadata?.name ? `: ${props.transcriptItem.metadata.name}` : ""})
          </div>
          <div className="h-full overflow-auto p-3">
            {!props.transcriptItem ? (
              <div className="text-sm text-muted-foreground">Kein Transcript vorhanden.</div>
            ) : transcriptError ? (
              <div className="text-sm text-destructive">{transcriptError}</div>
            ) : isTranscriptLoading ? (
              <div className="text-sm text-muted-foreground">Lade Transcript…</div>
            ) : (
              <MarkdownPreview content={transcriptText} compact className="h-full" />
            )}
          </div>
        </div>
      </div>
    )
  }

  return <SourceRenderer provider={props.provider} file={props.sourceFile} streamingUrl={props.streamingUrl} showHeader={false} />
}


