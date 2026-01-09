"use client"

import * as React from "react"

import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { resolveArtifactClient } from "@/lib/shadow-twin/artifact-client"

export interface ResolvedTranscriptItemResult {
  transcriptItem: StorageItem | null
  isLoading: boolean
  error: string | null
}

export function useResolvedTranscriptItem(args: {
  provider: StorageProvider | null
  libraryId: string
  sourceFile: StorageItem | null
  targetLanguage: string
}): ResolvedTranscriptItemResult {
  const { provider, libraryId, sourceFile, targetLanguage } = args
  const [state, setState] = React.useState<ResolvedTranscriptItemResult>({
    transcriptItem: null,
    isLoading: false,
    error: null,
  })

  React.useEffect(() => {
    let cancelled = false

    async function run() {
      if (!provider) return
      if (!libraryId) return
      if (!sourceFile) return
      if (!sourceFile.parentId) return

      setState({ transcriptItem: null, isLoading: true, error: null })
      try {
        const resolved = await resolveArtifactClient({
          libraryId,
          sourceId: sourceFile.id,
          sourceName: sourceFile.metadata.name,
          parentId: sourceFile.parentId,
          targetLanguage: targetLanguage || "de",
          preferredKind: "transcript",
        })
        if (cancelled) return
        if (!resolved?.fileId) {
          setState({ transcriptItem: null, isLoading: false, error: null })
          return
        }

        const it = await provider.getItemById(resolved.fileId)
        if (cancelled) return
        setState({ transcriptItem: it, isLoading: false, error: null })
      } catch (e) {
        if (cancelled) return
        setState({
          transcriptItem: null,
          isLoading: false,
          error: e instanceof Error ? e.message : String(e),
        })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [provider, libraryId, sourceFile?.id, sourceFile?.parentId, sourceFile?.metadata.name, targetLanguage])

  return state
}


