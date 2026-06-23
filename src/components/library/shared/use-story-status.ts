"use client"

import * as React from "react"
import { useAtomValue } from "jotai"

import type { FrontendShadowTwinState } from "@/atoms/shadow-twin-atom"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import type { StorageItem } from "@/lib/storage/types"
import { getStoryMediaType, getTextStepLabel, type StoryStepStatus } from "@/components/library/shared/story-status"
import { useIngestionStatus, useInvalidateIngestionStatus } from "@/hooks/use-ingestion-status"

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

export function useStoryStatus(args: UseStoryStatusArgs): UseStoryStatusResult {
  const mediaType = React.useMemo(() => (args.file ? getStoryMediaType(args.file) : "unknown"), [args.file])
  const hasText = Boolean(args.shadowTwinState?.transcriptFiles && args.shadowTwinState.transcriptFiles.length > 0)
  const hasTransform = Boolean(args.shadowTwinState?.transformed)

  const docModifiedAt = React.useMemo(() => {
    const transformed = args.shadowTwinState?.transformed
    return transformed ? toIso(transformed.metadata.modifiedAt) : undefined
  }, [args.shadowTwinState?.transformed])

  // Trigger-Atom abonnieren, um bei Job-Abschluss neu zu laden
  const shadowTwinTrigger = useAtomValue(shadowTwinAnalysisTriggerAtom)
  const invalidate = useInvalidateIngestionStatus()

  const shouldFetchPublish = Boolean(args.file && (hasTransform || hasText))

  // Geteilter Ingestion-Status (compact) — derselbe React-Query-Cache wie der
  // IngestionDataProvider, statt einer eigenen TTL-Map. Nur laden, wenn ueberhaupt
  // Text/Transformation vorliegt (sonst kann es keinen Publish-Status geben).
  const fileId = args.file?.id
  const statusQuery = useIngestionStatus(args.libraryId, fileId, {
    docModifiedAt,
    enabled: shouldFetchPublish,
  })

  const publishData = statusQuery.data ?? null
  const isPublishLoading = statusQuery.isLoading
  const publishError = statusQuery.error
    ? (statusQuery.error instanceof Error ? statusQuery.error.message : String(statusQuery.error))
    : null

  // Bei Job-Abschluss neu laden — nur beim echten WECHSEL des Trigger-Werts (nicht initial).
  const prevTrigger = React.useRef(shadowTwinTrigger)
  React.useEffect(() => {
    if (prevTrigger.current !== shadowTwinTrigger) {
      prevTrigger.current = shadowTwinTrigger
      if (args.libraryId && fileId) void invalidate(args.libraryId, fileId)
    }
  }, [shadowTwinTrigger, args.libraryId, fileId, invalidate])

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
