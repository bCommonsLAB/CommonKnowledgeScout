"use client"

import * as React from "react"

import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { parseArtifactName } from "@/lib/shadow-twin/artifact-naming"

export interface ShadowTwinTransformationEntry {
  item: StorageItem
  templateName: string
  targetLanguage: string | null
  modifiedAtMs: number
}

export interface ShadowTwinArtifactsResult {
  shadowTwinFolderId: string | null
  transcriptItem: StorageItem | null
  transformations: ShadowTwinTransformationEntry[]
  isLoading: boolean
  error: string | null
  /**
   * Wird erst true, nachdem wir mindestens einmal versucht haben,
   * den Shadow‑Twin Zustand zu laden (success / not found / error).
   *
   * WICHTIG: verhindert "false positive" UI-Entscheidungen direkt nach dem Mount,
   * bevor die erste Analyse überhaupt gelaufen ist.
   */
  hasChecked: boolean
}

function getFileBaseName(fileName: string): string {
  const trimmed = typeof fileName === "string" ? fileName.trim() : ""
  const lastDot = trimmed.lastIndexOf(".")
  return lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed
}

function asTimeMs(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  if (typeof value === "string") {
    const t = new Date(value).getTime()
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function generateShadowTwinFolderNameVariants(originalName: string): string[] {
  const cleanName = originalName.trim().replace(/^\/+|\/+$/g, "")
  const fullFolderName = `.${cleanName}`
  const maxLength = 255

  if (fullFolderName.length <= maxLength) return [fullFolderName]

  // Name ist zu lang: behalte Extension, kürze Basisname (ohne Node `path`).
  const lastDot = cleanName.lastIndexOf(".")
  const extension = lastDot >= 0 ? cleanName.slice(lastDot) : ""
  const baseName = lastDot >= 0 ? cleanName.slice(0, lastDot) : cleanName
  const reservedLength = 2 + extension.length // "." + "." + ext
  const availableLength = maxLength - reservedLength
  if (availableLength <= 0) return [`.${extension}`]

  const truncatedBase = baseName.length > availableLength ? baseName.slice(0, availableLength) : baseName
  return [`.${truncatedBase}${extension}`]
}

async function findShadowTwinFolderId(args: {
  provider: StorageProvider
  parentId: string
  originalName: string
}): Promise<string | null> {
  const variants = generateShadowTwinFolderNameVariants(args.originalName)
  const items = await args.provider.listItemsById(args.parentId)
  const found = items.find((it) => it.type === "folder" && variants.includes(it.metadata.name))
  return found?.id ?? null
}

export function useShadowTwinArtifacts(args: {
  provider: StorageProvider | null
  parentId: string
  sourceFile: StorageItem | null
  targetLanguage: string
}): ShadowTwinArtifactsResult {
  const provider = args.provider
  const parentId = args.parentId
  const sourceFile = args.sourceFile
  const targetLanguage = args.targetLanguage

  const sourceBaseName = React.useMemo(
    () => (sourceFile ? getFileBaseName(sourceFile.metadata.name) : ""),
    [sourceFile]
  )

  const [state, setState] = React.useState<ShadowTwinArtifactsResult>({
    shadowTwinFolderId: null,
    transcriptItem: null,
    transformations: [],
    isLoading: false,
    error: null,
    hasChecked: false,
  })

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!provider) return
      if (!sourceFile) return
      if (!parentId) return

      setState({
        shadowTwinFolderId: null,
        transcriptItem: null,
        transformations: [],
        isLoading: true,
        error: null,
        hasChecked: false,
      })

      try {
        const folderId = await findShadowTwinFolderId({
          provider,
          parentId,
          originalName: sourceFile.metadata.name,
        })
        if (cancelled) return

        if (!folderId) {
          setState({
            shadowTwinFolderId: null,
            transcriptItem: null,
            transformations: [],
            isLoading: false,
            error: null,
            hasChecked: true,
          })
          return
        }

        const items = await provider.listItemsById(folderId)
        if (cancelled) return

        const markdownFiles = items.filter(
          (it) => it.type === "file" && it.metadata.name.toLowerCase().endsWith(".md")
        )

        const transcriptCandidates: { item: StorageItem; modifiedAtMs: number; lang: string | null }[] = []
        const transformationEntries: ShadowTwinTransformationEntry[] = []

        for (const md of markdownFiles) {
          const parsed = parseArtifactName(md.metadata.name, sourceBaseName)
          const modifiedAtMs = asTimeMs(md.metadata.modifiedAt)

          if (parsed.kind === "transcript") {
            transcriptCandidates.push({ item: md, modifiedAtMs, lang: parsed.targetLanguage })
          }

          if (parsed.kind === "transformation") {
            transformationEntries.push({
              item: md,
              templateName: parsed.templateName ?? "unbekannt",
              targetLanguage: parsed.targetLanguage,
              modifiedAtMs,
            })
          }
        }

        transcriptCandidates.sort((a, b) => b.modifiedAtMs - a.modifiedAtMs)
        const preferredTranscript =
          transcriptCandidates.find((t) => t.lang === targetLanguage)?.item ??
          transcriptCandidates[0]?.item ??
          null

        transformationEntries.sort((a, b) => {
          if (b.modifiedAtMs !== a.modifiedAtMs) return b.modifiedAtMs - a.modifiedAtMs
          return a.item.metadata.name.localeCompare(b.item.metadata.name)
        })

        setState({
          shadowTwinFolderId: folderId,
          transcriptItem: preferredTranscript,
          transformations: transformationEntries,
          isLoading: false,
          error: null,
          hasChecked: true,
        })
      } catch (e) {
        setState({
          shadowTwinFolderId: null,
          transcriptItem: null,
          transformations: [],
          isLoading: false,
          error: e instanceof Error ? e.message : String(e),
          hasChecked: true,
        })
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [provider, parentId, sourceFile?.id, sourceFile?.metadata.name, targetLanguage, sourceBaseName])

  return state
}


