'use client';

/**
 * file-preview/job-report-tab-with-shadow-twin.tsx
 *
 * Wrapper um `JobReportTab`, der vor dem Render via `resolveArtifactClient`
 * die richtige Markdown-Datei (Transformation bevorzugt, sonst Transcript)
 * aufloest.
 *
 * Aus `file-preview.tsx` extrahiert (Welle 3-II-a). Vertrag stabil:
 * gleicher Props-Vertrag wie zuvor, gleicher Render-Output.
 */

import * as React from 'react'
import { JobReportTab } from '@/components/library/job-report-tab'
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

interface JobReportTabWithShadowTwinProps {
  libraryId: string
  fileId: string
  fileName: string
  parentId: string
  provider: StorageProvider | null
  ingestionTabMode?: 'status' | 'preview'
  onEditClick?: () => void
  effectiveMdIdRef?: React.MutableRefObject<string | null>
  resolvedMdFileId?: string
}

export function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider,
  ingestionTabMode = 'status',
  onEditClick,
  effectiveMdIdRef,
  resolvedMdFileId,
}: JobReportTabWithShadowTwinProps) {
  const [mdFileId, setMdFileId] = React.useState<string | null>(null)
  const [baseFileId, setBaseFileId] = React.useState<string>(fileId)
  const [isLoading, setIsLoading] = React.useState(true)

  // Variante C: Vollstaendig ueber API — kein lokales Parsing mehr.
  React.useEffect(() => {
    if (resolvedMdFileId) {
      setMdFileId(resolvedMdFileId)
      setBaseFileId(fileId)
      setIsLoading(false)
      return
    }

    async function resolveArtifact() {
      setIsLoading(true)

      // Prioritaet 1: Transformation (hat Frontmatter)
      let resolved = await resolveArtifactClient({
        libraryId,
        sourceId: fileId,
        sourceName: fileName,
        parentId,
        targetLanguage: 'de',
        preferredKind: 'transformation',
      })

      // Prioritaet 2: Fallback zu Transcript wenn keine Transformation gefunden
      if (!resolved) {
        resolved = await resolveArtifactClient({
          libraryId,
          sourceId: fileId,
          sourceName: fileName,
          parentId,
          targetLanguage: 'de',
          preferredKind: 'transcript',
        })
      }

      if (resolved) {
        setMdFileId(resolved.fileId)
        setBaseFileId(fileId)
        FileLogger.debug('JobReportTabWithShadowTwin', 'Artefakt ueber Resolver gefunden', {
          originalFileId: fileId,
          resolvedFileId: resolved.fileId,
          resolvedFileName: resolved.fileName,
          kind: resolved.kind,
          location: resolved.location,
        })
      } else {
        // Kein Artefakt gefunden — verwende Basis-Datei direkt
        setMdFileId(null)
        setBaseFileId(fileId)
        FileLogger.debug('JobReportTabWithShadowTwin', 'Kein Shadow-Twin-Artefakt gefunden, verwende Basis-Datei', {
          fileId,
          fileName,
          parentId,
        })
      }

      setIsLoading(false)
    }

    if (libraryId && fileId && parentId) {
      resolveArtifact().catch((error) => {
        FileLogger.error('JobReportTabWithShadowTwin', 'Fehler bei Artefakt-Aufloesung', {
          fileId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        })
        setIsLoading(false)
        setMdFileId(null)
        setBaseFileId(fileId)
      })
    } else {
      setIsLoading(false)
    }
  }, [libraryId, fileId, fileName, parentId, resolvedMdFileId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lade Metadaten...</p>
      </div>
    )
  }

  return (
    <JobReportTab
      libraryId={libraryId}
      fileId={baseFileId}
      fileName={fileName}
      provider={provider}
      mdFileId={mdFileId}
      ingestionTabMode={ingestionTabMode}
      onEditClick={onEditClick}
      effectiveMdIdRef={effectiveMdIdRef}
      sourceMode="frontmatter"
      viewMode="metaOnly"
    />
  )
}
