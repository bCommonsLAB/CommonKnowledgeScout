"use client";

import { useEffect, useState, useCallback } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

interface JobReportTabProps {
  libraryId: string
  fileId: string
  fileName?: string
  provider?: StorageProvider | null
  // Quelle der Metadaten steuern: 'merged' = cumulativeMeta + Frontmatter (Standard),
  // 'frontmatter' = ausschließlich Frontmatter aus Markdown anzeigen
  sourceMode?: 'merged' | 'frontmatter'
  // Darstellungsmodus: 'full' zeigt Kopf/Steps/Logs/Parameter; 'metaOnly' zeigt nur Metadaten/Kapitel/TOC
  viewMode?: 'full' | 'metaOnly'
  // Optional explizite Markdown-Datei-ID (Shadow‑Twin). Überschreibt auto-Erkennung.
  mdFileId?: string | null
  // Optionaler Callback zum Scroll-Sync in die Markdown-Vorschau
  onJumpTo?: (args: { page?: number | string; evidence?: string }) => void
  // NEU: Rohinhalt (Markdown). Wenn gesetzt und sourceMode='frontmatter', wird direkt dieser Text geparst (ohne Datei/JOB).
  rawContent?: string
  forcedTab?: 'markdown' | 'meta' | 'chapters' | 'process'
}

interface JobDto {
  jobId: string
  status: string
  operation: string
  worker: string
  job_type: string
  updatedAt: string
  createdAt: string
  correlation?: { source?: { itemId?: string; name?: string } }
  parameters?: Record<string, unknown>
  steps?: Array<{ name: string; status: string; startedAt?: string; endedAt?: string; error?: { message: string }; details?: { skipped?: boolean } }>
  ingestion?: { vectorsUpserted?: number; index?: string; upsertAt?: string }
  result?: { savedItemId?: string }
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', mdFileId, rawContent, forcedTab }: JobReportTabProps) {
  // States, die aktuell im minimalen UI benötigt werden
  const [job, setJob] = useState<JobDto | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [fullContent, setFullContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'markdown' | 'meta' | 'chapters' | 'process'>(forcedTab || 'markdown')

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab)
  }, [forcedTab])

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        if (sourceMode === 'frontmatter' && (
          (typeof rawContent === 'string' && rawContent.length > 0) ||
          (typeof mdFileId === 'string' && mdFileId.length > 0)
        )) {
          setJob(null)
          return
        }
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null

        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        }

        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          let candidate = (fileName && typeof fileName === 'string') ? fileName : (fileId.includes('/') ? (fileId.split('/').pop() as string) : fileId)
          const parts = candidate.split('.')
          if (parts.length >= 3) {
            const ext1 = parts[parts.length - 1].toLowerCase()
            const ext2 = parts[parts.length - 2].toLowerCase()
            if ((ext1 === 'md' || ext1 === 'mdx') && /^[a-z]{2}$/i.test(ext2)) {
              candidate = parts.slice(0, -2).join('.') + '.pdf'
            }
          }
          byNameUrl.searchParams.set('bySourceName', candidate)
          byNameUrl.searchParams.set('libraryId', libraryId)
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        }

        if (!cancelled) setJob(j)
      } catch (e) {
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId, fileName, sourceMode, rawContent, mdFileId])

  const effectiveMdId = (() => {
    return (mdFileId && typeof mdFileId === 'string' && mdFileId.length > 0)
      ? mdFileId
      : ((job?.result?.savedItemId as string | undefined) || fileId)
  })()

  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (sourceMode === 'frontmatter' && typeof rawContent === 'string' && rawContent.length > 0) {
          const text = rawContent
          setFullContent(text)
          const { frontmatter, meta } = parseSecretaryMarkdownStrict(text)
          if (!frontmatter) { setFrontmatterMeta(null); return }
          setFrontmatterMeta(Object.keys(meta).length ? meta : null)
          return
        }

        if (!provider || !effectiveMdId) return
        const bin = await provider.getBinary(effectiveMdId)
        const text = await bin.blob.text()
        setFullContent(text)
        const { frontmatter, meta } = parseSecretaryMarkdownStrict(text)
        if (!frontmatter) { setFrontmatterMeta(null); return }
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch (e) {
        UILogger.warn('JobReportTab', 'Frontmatter konnte nicht gelesen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadFrontmatter()
  }, [provider, effectiveMdId, sourceMode, rawContent])

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as 'markdown' | 'meta' | 'chapters' | 'process')
  }, [])

  return (
    <div className="w-full">
      {/* Gekürzte Darstellung */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
          <TabsTrigger value="meta">Meta</TabsTrigger>
          </TabsList>
        <TabsContent value="markdown">
          <MarkdownPreview content={fullContent} />
          </TabsContent>
        <TabsContent value="meta">
          <pre className="whitespace-pre-wrap text-xs">{frontmatterMeta ? JSON.stringify(frontmatterMeta, null, 2) : '—'}</pre>
          </TabsContent>
        </Tabs>
    </div>
  )
}


