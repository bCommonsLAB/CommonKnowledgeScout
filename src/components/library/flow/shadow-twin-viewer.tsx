"use client"

import * as React from "react"

import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { parseFrontmatter } from "@/lib/markdown/frontmatter"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MarkdownPreview } from "@/components/library/markdown-preview"
import { MarkdownMetadata } from "@/components/library/markdown-metadata"
import { ChapterAccordion, type Chapter } from "@/components/library/chapter-accordion"
import { IngestionStatus } from "@/components/library/ingestion-status"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { SourceAndTranscriptPane } from "@/components/library/shared/source-and-transcript-pane"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"

interface ShadowTwinViewerProps {
  libraryId: string
  provider: StorageProvider
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  targetLanguage: string
  leftPaneMode: string
  activeTransformationId: string
  transcriptItem: StorageItem | null
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shadowTwinLoading: boolean
  shadowTwinError: string | null
}

function getMediaType(file: StorageItem): "pdf" | "audio" | "video" | "image" | "markdown" | "unknown" {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}


function coerceChapters(meta: Record<string, unknown>): Chapter[] {
  const raw = meta["chapters"]
  if (!Array.isArray(raw)) return []

  const chapters: Chapter[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const obj = entry as Record<string, unknown>
    const title = typeof obj.title === "string" ? obj.title : null
    if (!title) continue

    const order = typeof obj.order === "number" ? obj.order : chapters.length + 1
    const level = typeof obj.level === "number" ? obj.level : 1
    const startPage = typeof obj.startPage === "number" ? obj.startPage : undefined
    const endPage = typeof obj.endPage === "number" ? obj.endPage : undefined
    const summary = typeof obj.summary === "string" ? obj.summary : undefined
    const keywords = Array.isArray(obj.keywords) ? obj.keywords.filter((k): k is string => typeof k === "string") : undefined

    chapters.push({ order, level, title, startPage, endPage, summary, keywords })
  }
  return chapters
}

export function ShadowTwinViewer(props: ShadowTwinViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mediaType = getMediaType(props.sourceFile)
  const leftMode = props.leftPaneMode
  const isLeftHidden = leftMode === "off"

  // Viewer zeigt bewusst NUR die aktuellste Transformation (neueste zuerst).
  // Die Auswahl-/Filter-Logik zum Starten neuer Jobs ist oben in `FlowActions` abgebildet.
  const selectedTransformation = React.useMemo(() => {
    if (props.transformations.length === 0) return null
    const byId = props.activeTransformationId
      ? props.transformations.find((t) => t.item.id === props.activeTransformationId) ?? null
      : null
    return byId ?? props.transformations[0]
  }, [props.transformations, props.activeTransformationId])

  const [transformationText, setTransformationText] = React.useState<string>("")
  const [isTransformationLoading, setIsTransformationLoading] = React.useState(false)
  const [transformationError, setTransformationError] = React.useState<string | null>(null)

  // 3) Transformation Text laden
  React.useEffect(() => {
    let cancelled = false

    async function loadTransformation() {
      setTransformationError(null)
      setTransformationText("")
      if (!selectedTransformation) return

      try {
        setIsTransformationLoading(true)
        if (isMongoShadowTwinId(selectedTransformation.item.id)) {
          const parts = parseMongoShadowTwinId(selectedTransformation.item.id)
          if (!parts) throw new Error("Ungültige Mongo-Shadow-Twin-ID (Transformation).")
          const text = await fetchShadowTwinMarkdown(props.libraryId, parts)
          if (cancelled) return
          setTransformationText(text)
          return
        }
        const { blob } = await props.provider.getBinary(selectedTransformation.item.id)
        const text = await blob.text()
        if (cancelled) return
        setTransformationText(text)
      } catch (e) {
        if (cancelled) return
        setTransformationError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setIsTransformationLoading(false)
      }
    }

    void loadTransformation()
    return () => {
      cancelled = true
    }
  }, [props.provider, selectedTransformation])

  const transformationParsed = React.useMemo(() => {
    if (!transformationText) return null
    const parsed = parseFrontmatter(transformationText)
    const chapters = coerceChapters(parsed.meta)
    return { meta: parsed.meta, body: parsed.body, chapters }
  }, [transformationText])

  const transformationDocModifiedAt = React.useMemo(() => {
    const v = selectedTransformation?.item.metadata.modifiedAt
    if (v instanceof Date) return v.toISOString()
    if (typeof v === "string") return new Date(v).toISOString()
    return undefined
  }, [selectedTransformation])

  const [rightTab, setRightTab] = React.useState<"text" | "transform" | "publish">("transform")
  React.useEffect(() => {
    setRightTab(props.transformations.length > 0 ? "transform" : "text")
  }, [props.sourceFile.id, props.transformations.length])

  const [transcriptText, setTranscriptText] = React.useState<string>("")
  const [isTranscriptLoading, setIsTranscriptLoading] = React.useState(false)
  const [transcriptError, setTranscriptError] = React.useState<string | null>(null)
  React.useEffect(() => {
    let cancelled = false

    async function loadTranscript() {
      setTranscriptError(null)
      setTranscriptText("")
      if (!props.transcriptItem) return
      if (rightTab !== "text") return

      try {
        setIsTranscriptLoading(true)
        if (isMongoShadowTwinId(props.transcriptItem.id)) {
          const parts = parseMongoShadowTwinId(props.transcriptItem.id)
          if (!parts) throw new Error("Ungültige Mongo-Shadow-Twin-ID (Transcript).")
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
  }, [props.provider, props.transcriptItem, rightTab])

  return (
    <div className={isLeftHidden ? "grid h-full min-h-0 gap-3" : "grid h-full min-h-0 gap-3 md:grid-cols-2"}>
      {/* Links: Quelle + Transcript (Shadow‑Twin) */}
      {isLeftHidden ? null : (
        <div className="min-h-0 overflow-hidden rounded border">
        <div className="flex h-full flex-col">
          <SourceAndTranscriptPane
            provider={props.provider}
            libraryId={props.libraryId}
            sourceFile={props.sourceFile}
            streamingUrl={props.streamingUrl}
            transcriptItem={props.transcriptItem}
            leftPaneMode={leftMode}
          />
        </div>
      </div>
      )}

      {/* Rechts: Transformationen (Shadow‑Twin) */}
      <div className="min-h-0 overflow-hidden rounded border">
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            {props.shadowTwinError ? (
              <div className="p-3 text-sm text-destructive">{props.shadowTwinError}</div>
            ) : props.shadowTwinLoading ? (
              <div className="p-3 text-sm text-muted-foreground">Lade Shadow‑Twin…</div>
            ) : (
              <Tabs value={rightTab} onValueChange={(v) => setRightTab(v === "text" || v === "publish" ? v : "transform")} className="flex h-full flex-col">
                <div className="mx-3 mt-3 truncate text-xs text-muted-foreground">
                  {selectedTransformation?.item?.metadata?.name ? `Transformiert: ${selectedTransformation.item.metadata.name}` : "Noch keine Transformation"}
                </div>
                <TabsList className="mx-3 mt-3 w-fit">
                  <TabsTrigger value="text">Text</TabsTrigger>
                  <TabsTrigger value="transform" disabled={props.transformations.length === 0}>
                    Transformieren
                  </TabsTrigger>
                  <TabsTrigger value="publish">Veröffentlichen</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="min-h-0 flex-1 overflow-auto p-3">
                  {!props.transcriptItem ? (
                    <div className="text-sm text-muted-foreground">Noch kein Text vorhanden.</div>
                  ) : transcriptError ? (
                    <div className="text-sm text-destructive">{transcriptError}</div>
                  ) : isTranscriptLoading ? (
                    <div className="text-sm text-muted-foreground">Lade Text…</div>
                  ) : (
                    <MarkdownPreview content={transcriptText} compact className="h-full" />
                  )}
                </TabsContent>

                <TabsContent value="transform" className="min-h-0 flex-1 overflow-hidden">
                  {props.transformations.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">Noch keine Transformation vorhanden.</div>
                  ) : transformationError ? (
                    <div className="p-3 text-sm text-destructive">{transformationError}</div>
                  ) : isTransformationLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Lade Transformation…</div>
                  ) : (
                    <Tabs defaultValue="body" className="flex h-full flex-col">
                      <TabsList className="mx-3 mt-3 w-fit">
                        <TabsTrigger value="body">Ergebnis</TabsTrigger>
                        <TabsTrigger value="meta">Metadaten</TabsTrigger>
                        {transformationParsed && transformationParsed.chapters.length > 0 ? (
                          <TabsTrigger value="chapters">Struktur</TabsTrigger>
                        ) : null}
                      </TabsList>

                      <TabsContent value="body" className="min-h-0 flex-1 overflow-auto p-3">
                        <MarkdownPreview content={transformationParsed?.body ?? transformationText} compact className="h-full" />
                      </TabsContent>

                      <TabsContent value="meta" className="min-h-0 flex-1 overflow-auto p-3">
                        <MarkdownMetadata content={transformationText} libraryId={props.libraryId} />
                      </TabsContent>

                      {transformationParsed && transformationParsed.chapters.length > 0 ? (
                        <TabsContent value="chapters" className="min-h-0 flex-1 overflow-auto p-3">
                          <ChapterAccordion chapters={transformationParsed.chapters} />
                        </TabsContent>
                      ) : null}
                    </Tabs>
                  )}
                </TabsContent>

                <TabsContent value="publish" className="min-h-0 flex-1 overflow-auto p-3">
                  <IngestionStatus
                    libraryId={props.libraryId}
                    fileId={props.sourceFile.id}
                    docModifiedAt={transformationDocModifiedAt}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


