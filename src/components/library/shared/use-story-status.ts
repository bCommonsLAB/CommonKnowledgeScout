"use client"

import * as React from "react"

import type { FrontendShadowTwinState } from "@/atoms/shadow-twin-atom"
import type { StorageItem } from "@/lib/storage/types"
import { getStoryMediaType, getTextStepLabel, type StoryStepStatus } from "@/components/library/shared/story-status"

interface IngestionStatusCompactDto {
  indexExists: boolean
  doc: {
    exists: boolean
    status: "ok" | "stale" | "not_indexed"
    title?: string
    user?: string
    chunkCount?: number
    chaptersCount?: number
    upsertedAt?: string
  }
  chapters: []
}

interface UseStoryStatusArgs {
  libraryId: string
  file: StorageItem | null
  shadowTwinState: FrontendShadowTwinState | undefined
}

interface UseStoryStatusResult {
  steps: StoryStepStatus[]
  isPublishLoading: boolean
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    const d = new Date(value)
    return Number.isFinite(d.getTime()) ? d.toISOString() : undefined
  }
  return undefined
}

const ingestionCache = new Map<string, { at: number; value: IngestionStatusCompactDto }>()
const INGESTION_CACHE_TTL_MS = 20_000

export function useStoryStatus(args: UseStoryStatusArgs): UseStoryStatusResult {
  const mediaType = React.useMemo(() => (args.file ? getStoryMediaType(args.file) : "unknown"), [args.file])
  const hasText = Boolean(args.shadowTwinState?.transcriptFiles && args.shadowTwinState.transcriptFiles.length > 0)
  const hasTransform = Boolean(args.shadowTwinState?.transformed)

  const docModifiedAt = React.useMemo(() => {
    const transformed = args.shadowTwinState?.transformed
    return transformed ? toIso(transformed.metadata.modifiedAt) : undefined
  }, [args.shadowTwinState?.transformed])

  const shouldFetchPublish = Boolean(args.file && (hasTransform || hasText))
  const [publishData, setPublishData] = React.useState<IngestionStatusCompactDto | null>(null)
  const [publishError, setPublishError] = React.useState<string | null>(null)
  const [isPublishLoading, setIsPublishLoading] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setPublishError(null)
      setPublishData(null)
      setIsPublishLoading(false)

      if (!shouldFetchPublish) return
      if (!args.libraryId) return
      if (!args.file) return

      const cacheKey = `${args.libraryId}:${args.file.id}:${docModifiedAt || ""}`
      const cached = ingestionCache.get(cacheKey)
      if (cached && Date.now() - cached.at < INGESTION_CACHE_TTL_MS) {
        setPublishData(cached.value)
        return
      }

      try {
        setIsPublishLoading(true)
        const url = `/api/chat/${encodeURIComponent(args.libraryId)}/ingestion-status?fileId=${encodeURIComponent(args.file.id)}&compact=1${
          docModifiedAt ? `&docModifiedAt=${encodeURIComponent(docModifiedAt)}` : ""
        }`
        const res = await fetch(url, { cache: "no-store" })
        const json = (await res.json()) as unknown
        if (!res.ok) {
          const msg = typeof (json as { error?: unknown })?.error === "string" ? (json as { error: string }).error : "Ingestion-Status konnte nicht geladen werden"
          throw new Error(msg)
        }
        const dto = json as IngestionStatusCompactDto
        if (cancelled) return
        ingestionCache.set(cacheKey, { at: Date.now(), value: dto })
        setPublishData(dto)
      } catch (e) {
        if (cancelled) return
        setPublishError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setIsPublishLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [args.libraryId, args.file?.id, docModifiedAt, shouldFetchPublish])

  const steps = React.useMemo<StoryStepStatus[]>(() => {
    const textLabel = getTextStepLabel(mediaType)

    const textStep: StoryStepStatus = hasText
      ? { id: "text", state: "present", label: textLabel, detail: "Text liegt vor." }
      : { id: "text", state: "missing", label: textLabel, detail: "Noch kein Text erzeugt." }

    const transformStep: StoryStepStatus = hasTransform
      ? { id: "transform", state: "present", label: "Transformieren", detail: "Transformation liegt vor." }
      : { id: "transform", state: "missing", label: "Transformieren", detail: "Noch keine Transformation." }

    const publishStep: StoryStepStatus = (() => {
      if (!shouldFetchPublish) {
        return { id: "publish", state: "missing", label: "Veröffentlichen", detail: "Noch nicht veröffentlicht." }
      }
      if (isPublishLoading) return { id: "publish", state: "running", label: "Veröffentlichen", detail: "Prüfe Veröffentlichungsstatus…" }
      if (publishError) return { id: "publish", state: "error", label: "Veröffentlichen", detail: publishError }
      if (publishData?.doc?.exists) {
        const chunks = publishData.doc.chunkCount ?? "—"
        const chapters = publishData.doc.chaptersCount ?? "—"
        return { id: "publish", state: "present", label: "Veröffentlichen", detail: `Veröffentlicht (Chunks: ${chunks} · Kapitel: ${chapters}).` }
      }
      return { id: "publish", state: "missing", label: "Veröffentlichen", detail: "Noch nicht veröffentlicht." }
    })()

    return [textStep, transformStep, publishStep]
  }, [mediaType, hasText, hasTransform, shouldFetchPublish, isPublishLoading, publishError, publishData])

  return { steps, isPublishLoading }
}


