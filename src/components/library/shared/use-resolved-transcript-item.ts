"use client"

import * as React from "react"
import { useAtomValue } from "jotai"

import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { resolveArtifactClient } from "@/lib/shadow-twin/artifact-client"
import { isMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"

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
  
  // Trigger-Atom abonnieren, um bei Shadow-Twin-Aenderungen neu zu laden
  const shadowTwinTrigger = useAtomValue(shadowTwinAnalysisTriggerAtom)

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

        if (isMongoShadowTwinId(resolved.fileId)) {
          const virtualItem: StorageItem = {
            id: resolved.fileId,
            parentId: sourceFile.parentId,
            type: "file",
            metadata: {
              name: resolved.fileName,
              size: 0,
              modifiedAt: new Date(),
              mimeType: "text/markdown",
              isTwin: true,
            },
          }
          if (cancelled) return
          setState({ transcriptItem: virtualItem, isLoading: false, error: null })
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
    // shadowTwinTrigger: Wenn sich die Shadow-Twin-Analyse aendert, wird das Transkript neu geladen
  }, [provider, libraryId, sourceFile, targetLanguage, shadowTwinTrigger])

  return state
}


