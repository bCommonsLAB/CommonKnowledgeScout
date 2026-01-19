"use client";

import { useEffect, useState, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { IngestionBookDetail } from './ingestion-book-detail'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider, StorageItem } from '@/lib/storage/types'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom'
import { librariesAtom } from '@/atoms/library-atom'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'
import { DetailViewRenderer } from '@/components/library/detail-view-renderer'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { findShadowTwinImage, resolveShadowTwinImageUrl } from '@/lib/storage/shadow-twin'
import { CoverImageGeneratorDialog } from './cover-image-generator-dialog'
import { ArtifactEditDialog } from './shared/artifact-edit-dialog'

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
  forcedTab?: 'markdown' | 'meta' | 'chapters' | 'ingestion' | 'process'
  // Steuert den Tab "ingestion": Statusanzeige oder Story-Vorschau.
  ingestionTabMode?: 'status' | 'preview'
  // Callbacks für Header-Buttons (Bearbeiten und Story veröffentlichen)
  onEditClick?: () => void
  onPublishClick?: () => void
  // Exponiert die Transformationsdatei-ID für Header-Buttons
  effectiveMdIdRef?: React.MutableRefObject<string | null>
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
  logs?: Array<{ timestamp: string; phase?: string; message?: string; progress?: number; details?: Record<string, unknown> }>
  cumulativeMeta?: Record<string, unknown>
}

export function JobReportTab({
  libraryId,
  fileId,
  fileName,
  provider,
  sourceMode = 'merged',
  viewMode = 'full',
  mdFileId,
  onJumpTo,
  rawContent,
  forcedTab,
  ingestionTabMode = 'status',
  onEditClick,
  onPublishClick,
  effectiveMdIdRef,
}: JobReportTabProps) {
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find((lib) => lib.id === libraryId)
  const libraryConfig = activeLibrary?.config?.chat
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [editItem, setEditItem] = useState<StorageItem | null>(null)
  
  // Hole Shadow-Twin-State für die aktuelle Datei, um das Bildverzeichnis zu bestimmen
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom)
  const shadowTwinState = shadowTwinStates.get(fileId)
  
  // State für Fallback-Suche des Shadow-Twin-Verzeichnisses
  const [fallbackFolderId, setFallbackFolderId] = useState<string | null>(null)
  
  // Fallback: Wenn shadowTwinFolderId nicht verfügbar ist, versuche das Shadow-Twin-Verzeichnis zu finden
  useEffect(() => {
    if (shadowTwinState?.shadowTwinFolderId || !provider || !fileName) return
    
    let cancelled = false
    async function findFolder() {
      if (!provider || !fileName) return; // Type guard für TypeScript
      try {
        // Hole das Item, um parentId zu bekommen
        const item = await provider.getItemById(fileId)
        if (!item || cancelled) return
        
        const { findShadowTwinFolder } = await import('@/lib/storage/shadow-twin')
        const folder = await findShadowTwinFolder(item.parentId, fileName, provider)
        if (folder && !cancelled) {
          setFallbackFolderId(folder.id)
          UILogger.info('JobReportTab', 'Shadow-Twin-Verzeichnis via Fallback gefunden', {
            fileId,
            fileName,
            folderId: folder.id,
            folderName: folder.metadata.name
          })
        }
      } catch (error) {
        UILogger.error('JobReportTab', 'Fehler beim Finden des Shadow-Twin-Verzeichnisses', error)
      }
    }
    void findFolder()
    return () => { cancelled = true }
  }, [fileId, fileName, provider, shadowTwinState?.shadowTwinFolderId])
  
  // Verwende shadowTwinFolderId wenn verfügbar, sonst Fallback, sonst 'root'
  const currentFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId || 'root'
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [section] = useState<'meta' | 'chapters'>('meta')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fullContent, setFullContent] = useState<string>('')
  const [debouncedContent, setDebouncedContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'markdown' | 'meta' | 'chapters' | 'image' | 'ingestion' | 'process'>(forcedTab || 'markdown')
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null)
  // State für aufgelöste coverImageUrl in Story-Vorschau
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab)
  }, [forcedTab])

  // Resolve coverImageUrl für Story-Vorschau wenn es ein relativer Pfad ist
  useEffect(() => {
    const base: Record<string, unknown> = sourceMode === 'frontmatter'
      ? {}
      : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
    const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
    const coverImageUrl = cm.coverImageUrl as string | undefined
    
    if (!coverImageUrl || !provider || !fileId) {
      setResolvedCoverImageUrl(coverImageUrl)
      return
    }
    
    // Wenn bereits absolute URL, verwende direkt
    if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://') || coverImageUrl.startsWith('/api/storage/')) {
      setResolvedCoverImageUrl(coverImageUrl)
      return
    }
    
    // Relativer Pfad: Auflösen zu Storage-API-URL
    let cancelled = false
    async function resolveCoverImage() {
      try {
        const baseItem = await provider.getItemById(fileId)
        if (!baseItem || cancelled) return
        
        const shadowTwinFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId || undefined
        const resolvedUrl = await resolveShadowTwinImageUrl(
          baseItem,
          coverImageUrl,
          provider,
          libraryId,
          shadowTwinFolderId
        )
        if (!cancelled) {
          setResolvedCoverImageUrl(resolvedUrl)
        }
      } catch (error) {
        UILogger.warn('JobReportTab', 'Fehler beim Auflösen des Cover-Bildes für Story-Vorschau', {
          coverImageUrl,
          error: error instanceof Error ? error.message : String(error)
        })
        if (!cancelled) {
          setResolvedCoverImageUrl(coverImageUrl) // Fallback auf Original
        }
      }
    }
    void resolveCoverImage()
    return () => { cancelled = true }
  }, [frontmatterMeta?.coverImageUrl, job?.cumulativeMeta, sourceMode, provider, fileId, libraryId, shadowTwinState?.shadowTwinFolderId, fallbackFolderId])

  // Debounce Content-Änderungen, um unnötige Re-Renders während der Job-Verarbeitung zu vermeiden
  // WICHTIG: Wenn der Job abgeschlossen ist, rendere sofort (kein Debounce)
  useEffect(() => {
    const isJobCompleted = job?.status === 'completed' || job?.status === 'failed'
    
    if (isJobCompleted) {
      // Job abgeschlossen: Rendere sofort ohne Debounce
      setDebouncedContent(fullContent)
    } else {
      // Job läuft noch: Debounce Content-Änderungen (500ms)
      const timeoutId = setTimeout(() => {
        setDebouncedContent(fullContent)
      }, 500)
      
      return () => clearTimeout(timeoutId)
    }
  }, [fullContent, job?.status])

  const stripFrontmatter = (markdown: string): string => markdown.replace(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/, '')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        // Wenn wir ausschließlich Frontmatter anzeigen und bereits eine eindeutige Quelle haben (rawContent oder mdFileId),
        // dann überspringen wir die Job-Suche komplett, um doppelte Events/Loads zu vermeiden.
        if (sourceMode === 'frontmatter' && (
          (typeof rawContent === 'string' && rawContent.length > 0) ||
          (typeof mdFileId === 'string' && mdFileId.length > 0)
        )) {
          setJob(null)
          setLoading(false)
          setError(null)
          return
        }
        setLoading(true)
        setError(null)
        UILogger.info('JobReportTab', 'Start Job-Suche', { libraryId, fileId })
        // 1) Versuche Job über result.savedItemId (Shadow‑Twin) zu finden
        const byResultUrl = new URL(`/api/external/jobs`, window.location.origin)
        byResultUrl.searchParams.set('byResultItemId', fileId)
        UILogger.debug('JobReportTab', 'Request byResultItemId', { url: byResultUrl.toString() })
        let res = await fetch(byResultUrl.toString(), { cache: 'no-store' })
        let data = await res.json()
        if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche fehlgeschlagen')
        let j: JobDto | null = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
        UILogger.debug('JobReportTab', 'Result byResultItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })

        // 2) Fallback: über correlation.source.itemId (Originaldatei)
        if (!j) {
          const bySourceUrl = new URL(`/api/external/jobs`, window.location.origin)
          bySourceUrl.searchParams.set('bySourceItemId', fileId)
          bySourceUrl.searchParams.set('libraryId', libraryId)
          UILogger.debug('JobReportTab', 'Request bySourceItemId', { url: bySourceUrl.toString() })
          res = await fetch(bySourceUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Quelle) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceItemId', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        // 3) Fallback: über correlation.source.name (Dateiname der Quelle)
        if (!j) {
          const byNameUrl = new URL(`/api/external/jobs`, window.location.origin)
          // Wenn wir den tatsächlichen Dateinamen kennen, verwende ihn.
          // Für Shadow‑Twins (z. B. name.de.md) versuche das Basis‑PDF (name.pdf).
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
          UILogger.debug('JobReportTab', 'Request bySourceName', { url: byNameUrl.toString(), nameOnly: candidate, originalFileName: fileName })
          res = await fetch(byNameUrl.toString(), { cache: 'no-store' })
          data = await res.json()
          if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Job-Suche (Name) fehlgeschlagen')
          j = Array.isArray(data?.items) && data.items.length > 0 ? (data.items[0] as JobDto) : null
          UILogger.debug('JobReportTab', 'Result bySourceName', { count: Array.isArray(data?.items) ? data.items.length : 0 })
        }

        if (!cancelled) setJob(j)
        if (j) UILogger.info('JobReportTab', 'Job gefunden', { jobId: j.jobId, status: j.status })
        else UILogger.warn('JobReportTab', 'Kein Job gefunden', { libraryId, fileId })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unbekannter Fehler'
        UILogger.error('JobReportTab', 'Job-Suche fehlgeschlagen', e)
        if (!cancelled) setError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [libraryId, fileId, fileName, sourceMode, rawContent, mdFileId])

  // Wenn Template benutzt wurde, lade dessen Inhalt aus /templates und extrahiere Frontmatter-Schlüssel
  useEffect(() => {
    async function loadTemplateFields() {
      try {
        setTemplateFields(null)
        const tpl = job?.cumulativeMeta && typeof (job.cumulativeMeta as unknown) === 'object'
          ? (job.cumulativeMeta as Record<string, unknown>)['template_used']
          : undefined
        const templateName = typeof tpl === 'string' ? tpl : undefined
        if (!templateName || !libraryId) return
        // Verwende zentrale Client-Library für MongoDB-Templates
        const { loadTemplate } = await import('@/lib/templates/template-service-client')
        const result = await loadTemplate({
          libraryId,
          preferredTemplateName: templateName
        })
        const text = result.templateContent
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            if (k) keys.push(k)
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
      } catch (e) {
        UILogger.warn('JobReportTab', 'Template-Felder konnten nicht geladen werden', { error: e instanceof Error ? e.message : String(e) })
      }
    }
    void loadTemplateFields()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, provider]) // libraryId absichtlich nicht in Dependencies, da es aus job.libraryId kommt

  // Gemeinsamer strikter Parser
  // Hinweis: Parser wird direkt über parseSecretaryMarkdownStrict in Effekten genutzt

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (oder aus rawContent)
  const effectiveMdId = (() => {
    // WICHTIG: Im Frontmatter-Modus NIEMALS auf fileId (PDF) zurückfallen,
    // sonst wird der PDF‑Blob als Text gelesen und die UI kippt.
    if (sourceMode === 'frontmatter') {
      // Debug-Logging zur Diagnose
      UILogger.debug('JobReportTab', 'effectiveMdId Berechnung', {
        mdFileId,
        hasShadowTwinState: !!shadowTwinState,
        transformedId: shadowTwinState?.transformed?.id,
        hasTranscriptFiles: !!(shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0),
        transcriptFilesCount: shadowTwinState?.transcriptFiles?.length || 0,
        jobResultId: job?.result?.savedItemId
      })
      
      // PRIORITÄT 1: Verwende mdFileId (aus shadowTwinState.transformed.id)
      if (mdFileId && typeof mdFileId === 'string' && mdFileId.length > 0) {
        // Prüfe, ob mdFileId auf die transformierte Datei (.de.md) zeigt, nicht auf das Transcript (.md)
        const isTransformed = mdFileId.includes('.de.md') || shadowTwinState?.transformed?.id === mdFileId
        if (isTransformed) {
          return mdFileId
        }
        // Wenn mdFileId auf das Transcript zeigt, verwende stattdessen transformed.id direkt
        if (shadowTwinState?.transformed?.id) {
          UILogger.warn('JobReportTab', 'mdFileId zeigt auf Transcript, verwende transformed.id', {
            mdFileId,
            transformedId: shadowTwinState.transformed.id
          })
          return shadowTwinState.transformed.id
        }
      }
      // PRIORITÄT 2: Fallback auf transformed.id direkt aus shadowTwinState
      if (shadowTwinState?.transformed?.id) {
        return shadowTwinState.transformed.id
      }
      // PRIORITÄT 3: Fallback auf Job-Resultat (nur wenn es auf .de.md endet)
      const resultId = job?.result?.savedItemId as string | undefined
      if (resultId && resultId.length > 0 && resultId.includes('.de.md')) {
        return resultId
      }
      // PRIORITÄT 4: Fallback auf Transcript, wenn keine transformierte Datei vorhanden ist
      // (wird später eine Warnung anzeigen, dass kein Frontmatter vorhanden ist)
      if (shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0) {
        const transcriptId = shadowTwinState.transcriptFiles[0].id
        UILogger.warn('JobReportTab', 'Keine transformierte Datei gefunden, verwende Transcript als Fallback', {
          transcriptId,
          transcriptName: shadowTwinState.transcriptFiles[0].metadata?.name
        })
        return transcriptId
      }
      
      // Debug-Logging wenn keine Datei gefunden wurde
      UILogger.warn('JobReportTab', 'Keine Markdown-Datei-ID gefunden (effectiveMdId)', {
        mdFileId,
        hasShadowTwinState: !!shadowTwinState,
        hasTransformed: !!shadowTwinState?.transformed,
        transformedId: shadowTwinState?.transformed?.id,
        hasTranscriptFiles: !!(shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0),
        transcriptFilesCount: shadowTwinState?.transcriptFiles?.length || 0,
        jobResultId: job?.result?.savedItemId
      })
      return null
    }
    // Außerhalb des Frontmatter-Modus weiterhin Job‑Ergebnis oder fileId (historisches Verhalten)
    return (mdFileId && typeof mdFileId === 'string' && mdFileId.length > 0)
      ? mdFileId
      : ((job?.result?.savedItemId as string | undefined) || fileId)
  })()

  // Handler für Bearbeiten-Button (nach effectiveMdId Berechnung)
  const handleEditClick = useCallback(() => {
    if (!provider || !effectiveMdId) {
      toast.error('Fehler: Provider oder Datei-ID nicht verfügbar')
      return
    }
    setIsEditOpen(true)
  }, [provider, effectiveMdId])
  
  // Handler für Story-Veröffentlichung (nach effectiveMdId Berechnung)
  const handlePublishClick = useCallback(async () => {
    if (!provider || !effectiveMdId) {
      toast.error('Fehler: Provider oder Datei-ID nicht verfügbar')
      return
    }
    
    setIsPublishing(true)
    try {
      UILogger.info('JobReportTab', 'Starte Story-Veröffentlichung', {
        fileId: effectiveMdId,
        libraryId
      })
      
      // Hole Dateiname der Transformationsdatei
      const currentItem = await provider.getItemById(effectiveMdId)
      const fileName = currentItem?.metadata.name || 'document.md'
      
      // Rufe Ingestion-API auf
      const response = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/ingest-markdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: effectiveMdId,
          fileName
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        UILogger.error('JobReportTab', 'Fehler bei Story-Veröffentlichung', {
          status: response.status,
          error: errorText
        })
        toast.error(`Fehler bei der Veröffentlichung: ${response.statusText}`)
        return
      }
      
      const result = await response.json()
      UILogger.info('JobReportTab', 'Story erfolgreich veröffentlicht', {
        fileId: effectiveMdId,
        chunksUpserted: result.chunksUpserted,
        imageErrors: result.imageErrors?.length ?? 0
      })
      
      toast.success('Story erfolgreich veröffentlicht')
    } catch (error) {
      UILogger.error('JobReportTab', 'Unerwarteter Fehler bei Story-Veröffentlichung', error)
      toast.error('Fehler: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
    } finally {
      setIsPublishing(false)
    }
  }, [provider, effectiveMdId, libraryId])
  
  // Exponiere Handler über Callbacks
  useEffect(() => {
    if (onEditClick) {
      // Speichere Handler in Callback-Ref
      const callbackRef = onEditClick as unknown as React.MutableRefObject<(() => void) | undefined>
      callbackRef.current = handleEditClick
    }
    if (onPublishClick) {
      const callbackRef = onPublishClick as unknown as React.MutableRefObject<(() => Promise<void>) | undefined>
      callbackRef.current = handlePublishClick
    }
  }, [onEditClick, onPublishClick, handleEditClick, handlePublishClick])
  
  // Aktualisiere Ref für effectiveMdId, damit FilePreview darauf zugreifen kann
  useEffect(() => {
    if (effectiveMdIdRef) {
      effectiveMdIdRef.current = effectiveMdId
    }
  }, [effectiveMdId, effectiveMdIdRef])
  
  // Lade Edit-Item wenn Dialog geöffnet wird
  useEffect(() => {
    if (!isEditOpen || !provider || !effectiveMdId) {
      setEditItem(null)
      return
    }
    
    let cancelled = false
    async function loadEditItem() {
      try {
        const item = await provider.getItemById(effectiveMdId)
        if (!cancelled) {
          setEditItem(item)
        }
      } catch (error) {
        UILogger.error('JobReportTab', 'Fehler beim Laden des Edit-Items', error)
        if (!cancelled) {
          setEditItem(null)
        }
      }
    }
    void loadEditItem()
    return () => { cancelled = true }
  }, [isEditOpen, provider, effectiveMdId])

  useEffect(() => {
    async function loadFrontmatter() {
      try {
        setParseErrors([])
        // Wenn roher Inhalt übergeben wurde, direkt daraus lesen
        if (sourceMode === 'frontmatter' && typeof rawContent === 'string' && rawContent.length > 0) {
          const text = rawContent
          setFullContent(text)
          setDisplayedFileName('(Rohinhalt)')
          const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
          UILogger.debug('JobReportTab', 'Frontmatter (raw): Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
          if (!frontmatter) { setFrontmatterMeta(null); return }
          setFrontmatterMeta(Object.keys(meta).length ? meta : null)
          setParseErrors(errors)
          return
        }

        if (!provider) return
        const mdId = effectiveMdId
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { 
          mdId, 
          sourceMode, 
          mdFileId,
          hasShadowTwinState: !!shadowTwinState,
          transformedId: shadowTwinState?.transformed?.id,
          transcriptFilesCount: shadowTwinState?.transcriptFiles?.length || 0,
          jobResultId: job?.result?.savedItemId,
          effectiveMdId: mdId
        })
        // Wenn kein Shadow‑Twin vorhanden ist: nichts laden/anzeigen
        if (!mdId) { 
          UILogger.warn('JobReportTab', 'Keine Markdown-Datei-ID gefunden', {
            mdFileId,
            hasShadowTwinState: !!shadowTwinState,
            transformedId: shadowTwinState?.transformed?.id,
            jobResultId: job?.result?.savedItemId
          })
          setFullContent(''); 
          setFrontmatterMeta(null); 
          setDisplayedFileName(null); 
          return 
        }
        if (!provider) return // Type guard für TypeScript
        
        // Ermittle den Dateinamen: zuerst aus shadowTwinState, dann aus dem Item
        let fileName: string | null = null
        if (shadowTwinState?.transformed?.metadata?.name) {
          // Transformierte Datei vorhanden
          fileName = shadowTwinState.transformed.metadata?.name || null
        } else if (shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0) {
          // Nur Transcript vorhanden (keine transformierte Datei)
          fileName = shadowTwinState.transcriptFiles[0].metadata?.name || null
        } else {
          // Fallback: Lade Item-Name direkt
          try {
            const item = await provider.getItemById(mdId)
            fileName = item?.metadata?.name || null
          } catch (error) {
            UILogger.warn('JobReportTab', 'Fehler beim Laden des Item-Namens', { mdId, error })
            fileName = null
          }
        }
        setDisplayedFileName(fileName)
        
        try {
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
          UILogger.info('JobReportTab', 'Datei erfolgreich geladen', { mdId, textLength: text.length, fileName })
        setFullContent(text)
        const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
          if (!frontmatter) { 
            // Prüfe, ob dies ein Transcript ohne Frontmatter ist
            const isTranscript = !shadowTwinState?.transformed && shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0
            if (isTranscript) {
              UILogger.warn('JobReportTab', 'Kein Frontmatter in Transcript gefunden - dies ist normal für OCR-Transkripte ohne Template-Transformation', { 
                mdId, 
                fileName,
                hasTransformed: !!shadowTwinState?.transformed
              })
            } else {
              UILogger.warn('JobReportTab', 'Kein Frontmatter in Datei gefunden', { mdId, fileName })
            }
            setFrontmatterMeta(null); 
            return 
          }
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
        setParseErrors(errors)
        } catch (error) {
          UILogger.error('JobReportTab', 'Fehler beim Laden der Markdown-Datei', { mdId, fileName, error })
        setFrontmatterMeta(null)
          setDisplayedFileName(null)
          setError(`Fehler beim Laden der Datei: ${error instanceof Error ? error.message : String(error)}`)
        }
      } catch (error) {
        UILogger.error('JobReportTab', 'Unerwarteter Fehler beim Laden des Frontmatters', error)
        setFrontmatterMeta(null)
        setDisplayedFileName(null)
        setError(`Unerwarteter Fehler: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    void loadFrontmatter()
  }, [provider, effectiveMdId, sourceMode, rawContent, shadowTwinState?.transformed?.metadata?.name, job?.result?.savedItemId, mdFileId, shadowTwinState])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'metaOnly' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-5 w-full gap-1">
            <TabsTrigger value="markdown" className="px-2 py-1 text-xs">Markdown</TabsTrigger>
            <TabsTrigger value="meta" className="px-2 py-1 text-xs">Metadaten</TabsTrigger>
            <TabsTrigger value="chapters" className="px-2 py-1 text-xs">Kapitel</TabsTrigger>
            <TabsTrigger value="image" className="px-2 py-1 text-xs">Bild</TabsTrigger>
            <TabsTrigger value="ingestion" className="px-2 py-1 text-xs">
              {ingestionTabMode === 'preview' ? 'Story Vorschau' : 'Ingestion-Status'}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="markdown" className="mt-3 min-h-0">
            {/* Begrenze die Hoehe der Markdown-Vorschau, damit der Seiten-Scroll nicht uebernimmt. */}
            <div className="border rounded-md max-h-[70vh] overflow-hidden">
              {(() => {
                // Zeige Fehler beim Laden der Datei an
                if (error) {
                  return (
                    <div className="p-4 text-sm text-destructive">
                      {error}
                    </div>
                  );
                }
                
                // Prüfe Verarbeitungsstatus: Rendere nur wenn 'ready' oder wenn kein Status vorhanden (Rückwärtskompatibilität)
                const processingStatus = shadowTwinState?.processingStatus;
                const isReady = processingStatus === 'ready' || processingStatus === undefined;
                const isProcessing = processingStatus === 'processing';
                const isError = processingStatus === 'error';
                
                if (isError) {
                  return (
                    <div className="p-4 text-sm text-destructive">
                      Fehler bei der Verarbeitung: {shadowTwinState?.analysisError || 'Unbekannter Fehler'}
                    </div>
                  );
                }
                
                if (isProcessing) {
                  return (
                    <div className="p-4 text-sm text-muted-foreground">
                      Verarbeitung läuft... Bitte warten Sie, bis der Job abgeschlossen ist.
                    </div>
                  );
                }
                
                if (debouncedContent && debouncedContent.trim().length > 0 && isReady) {
                  return (
                <MarkdownPreview 
                  content={stripFrontmatter(debouncedContent)} 
                  currentFolderId={currentFolderId}
                  provider={provider}
                  className="h-[70vh]"
                />
                  );
                }
                
                // Wenn keine Datei geladen wurde, zeige Hinweis
                if (!effectiveMdId) {
                  return (
                    <div className="p-4 text-sm text-muted-foreground">
                      Keine Markdown-Datei gefunden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                    </div>
                  );
                }
                
                return null;
              })()}
            </div>
          </TabsContent>

          <TabsContent value="meta" className="mt-3">
            {/* Hinweise zu Parserfehlern (strikt) */}
            {parseErrors.length > 0 && (
              <div className="text-xs text-destructive mb-2">
                {parseErrors.map((e, i) => (<div key={i}>Parserfehler: {e}</div>))}
              </div>
            )}
            {/* Dateiname-Anzeige */}
            {displayedFileName && (
              <div className="text-xs text-muted-foreground mb-2 pb-2 border-b">
                Datei: <span className="font-mono font-medium">{displayedFileName}</span>
              </div>
            )}
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter'
                ? {}
                : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              // confidence/provenance können Objekt oder JSON-String sein → Fallback parse
              const confidence: Record<string, unknown> = (() => {
                const raw = cm['confidence']
                if (raw && typeof raw === 'object') return raw as Record<string, unknown>
                if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
                return {}
              })()
              const provenance: Record<string, unknown> = (() => {
                const raw = cm['provenance']
                if (raw && typeof raw === 'object') return raw as Record<string, unknown>
                if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
                return {}
              })()
              const hasAnyConfidence = Object.keys(confidence).length > 0
              const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
                ? Array.from(new Set([...(templateFields as string[]), ...Object.keys(cm)]))
                : Object.keys(cm)
              const flatKeysAll = baseKeys.filter(k => k !== 'chapters' && k !== 'toc' && k !== 'confidence' && k !== 'provenance')
              const processFields = new Set([
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ])
              const primaryKeys = flatKeysAll.filter(k => !processFields.has(k))
              const flatKeys = primaryKeys
              if (flatKeys.length === 0) return null
              return (
                <div>
                  <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                          <th className="py-1 pr-2">Wert</th>
                          {hasAnyConfidence ? <th className="py-1 pr-2 text-right sticky right-0 bg-background border-l">Q</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {flatKeys.map((k) => {
                          const val = cm[k]
                          let valueStr = ''
                          if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                          else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                          const hasNonEmptyValue = (() => {
                            if (val === null || val === undefined) return false
                            if (typeof val === 'string') return val.trim().length > 0
                            if (Array.isArray(val)) return (val as Array<unknown>).length > 0
                            if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0
                            return true
                          })()
                          const cRaw = (confidence as Record<string, unknown>)[k]
                          const cNum = typeof cRaw === 'number' ? cRaw : (typeof cRaw === 'string' && /^\d+(\.\d+)?$/.test(cRaw) ? Number(cRaw) : undefined)
                          const pRaw = (provenance as Record<string, unknown>)[k]
                          const pStr = typeof pRaw === 'string' ? pRaw : pRaw ? JSON.stringify(pRaw) : ''
                          const color = cNum === undefined ? 'text-muted-foreground' : (cNum >= 0.8 ? 'text-green-600' : cNum >= 0.7 ? 'text-yellow-600' : 'text-red-600')
                          return (
                            <tr key={k} className="border-t border-muted/40">
                              <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                              <td className="py-1 pr-2 align-top">
                                {valueStr ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">
                                          {valueStr}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : ''}
                              </td>
                              {hasAnyConfidence ? <td className="py-1 pr-2 align-top sticky right-0 bg-background border-l">
                                {(!hasNonEmptyValue || cNum === undefined) ? null : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`inline-flex items-center justify-end w-full ${color}`} title={pStr || ''}>
                                          <span className="inline-block h-2 w-2 rounded-full bg-current" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-xs whitespace-pre-wrap break-words">
                                          <div className="font-medium">Confidence: {cNum.toFixed(2)}</div>
                                          {pStr ? <div className="mt-1 text-muted-foreground">Provenance: {pStr}</div> : null}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </td> : null}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="image" className="mt-3">
            {(() => {
              // Extrahiere coverImageUrl aus Frontmatter
              const coverImageUrl = frontmatterMeta?.coverImageUrl as string | undefined
              const [isUploading, setIsUploading] = useState(false)
              const [coverImageDisplayUrl, setCoverImageDisplayUrl] = useState<string | null>(null)
              const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false)

              // Lade Bild-URL wenn coverImageUrl vorhanden ist
              useEffect(() => {
                if (!coverImageUrl || !provider || !effectiveMdId) {
                  setCoverImageDisplayUrl(null)
                  return
                }

                let cancelled = false
                async function loadImageUrl() {
                  try {
                    // Prüfe ob es bereits eine absolute URL ist
                    if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://') || coverImageUrl.startsWith('/api/storage/')) {
                      if (!cancelled) setCoverImageDisplayUrl(coverImageUrl)
                      return
                    }

                    // Relativer Pfad: Finde Bild im Shadow-Twin-Verzeichnis
                    const baseItem = await provider.getItemById(fileId)
                    if (!baseItem || cancelled) return

                    const shadowTwinFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId || undefined
                    const resolvedUrl = await resolveShadowTwinImageUrl(
                      baseItem,
                      coverImageUrl,
                      provider,
                      libraryId,
                      shadowTwinFolderId
                    )
                    if (!cancelled) setCoverImageDisplayUrl(resolvedUrl)
                  } catch (error) {
                    UILogger.warn('JobReportTab', 'Fehler beim Laden des Cover-Bildes', {
                      coverImageUrl,
                      error: error instanceof Error ? error.message : String(error)
                    })
                    if (!cancelled) setCoverImageDisplayUrl(null)
                  }
                }
                void loadImageUrl()
                return () => { cancelled = true }
              }, [coverImageUrl, provider, effectiveMdId, fileId, libraryId, shadowTwinState?.shadowTwinFolderId, fallbackFolderId])

              // Gemeinsame Funktion zum Speichern eines Coverbildes (für Upload und Generierung)
              const saveCoverImage = async (file: File) => {
                if (!provider || !effectiveMdId) return

                setIsUploading(true)
                try {
                  // Bestimme Shadow-Twin-Verzeichnis für Upload
                  const shadowTwinFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId
                  if (!shadowTwinFolderId) {
                    toast.error('Shadow-Twin-Verzeichnis nicht gefunden')
                    return
                  }

                  // Speichere Bild im Shadow-Twin-Verzeichnis
                  const uploadedItem = await provider.uploadFile(shadowTwinFolderId, file)
                  
                  // Setze coverImageUrl im Frontmatter auf den Dateinamen
                  const imageFileName = uploadedItem.metadata.name
                  const updatedMarkdown = patchFrontmatter(debouncedContent || fullContent, {
                    coverImageUrl: imageFileName
                  })

                  // Hole das aktuelle Item, um parentId und Dateinamen zu bekommen
                  // WICHTIG: Muss VOR dem Löschen erfolgen, damit wir parentId und Dateinamen haben
                  const currentItem = await provider.getItemById(effectiveMdId)
                  if (!currentItem) {
                    toast.error('Markdown-Datei nicht gefunden')
                    return
                  }

                  // Verwende den ursprünglichen Dateinamen aus currentItem.metadata.name
                  // WICHTIG: effectiveMdId ist eine Base64-ID, kein Pfad - daher nicht split('/').pop() verwenden
                  const originalFileName = currentItem.metadata.name || 'document.md'
                  let parentId = currentItem.parentId || 'root'
                  
                  // WICHTIG: Prüfe ob parentId auf einen Ordner zeigt, nicht auf eine Datei
                  // Die API-Route extrahiert den Dateinamen aus fileId, wenn dieser auf eine Datei zeigt
                  // Daher müssen wir sicherstellen, dass parentId auf einen Ordner zeigt
                  try {
                    const parentItem = await provider.getItemById(parentId)
                    if (parentItem && parentItem.type === 'file') {
                      // parentId zeigt auf eine Datei statt auf einen Ordner - verwende dessen parentId
                      UILogger.warn('JobReportTab', 'parentId zeigt auf Datei statt Ordner, verwende dessen parentId', {
                        parentId,
                        parentItemName: parentItem.metadata.name,
                        correctedParentId: parentItem.parentId
                      })
                      parentId = parentItem.parentId || 'root'
                    }
                  } catch (error) {
                    UILogger.warn('JobReportTab', 'Fehler beim Prüfen des parentId', {
                      parentId,
                      error: error instanceof Error ? error.message : String(error)
                    })
                    // Fallback: Verwende 'root' wenn parentId ungültig ist
                    parentId = 'root'
                  }
                  
                  UILogger.info('JobReportTab', 'Speichere aktualisierte Markdown-Datei', {
                    effectiveMdId,
                    originalFileName,
                    parentId,
                    currentItemName: currentItem.metadata.name,
                    fileSize: updatedMarkdown.length
                  })
                  
                  // Speichere aktualisierte Markdown-Datei
                  // WICHTIG: Dateiname muss explizit gesetzt werden, damit die API-Route ihn verwendet
                  const blob = new Blob([updatedMarkdown], { type: 'text/markdown' })
                  const markdownFile = new File([blob], originalFileName, { type: 'text/markdown' })
                  
                  // Prüfe ob file.name korrekt gesetzt wurde
                  if (markdownFile.name !== originalFileName) {
                    UILogger.error('JobReportTab', 'File.name wurde nicht korrekt gesetzt', {
                      expected: originalFileName,
                      actual: markdownFile.name
                    })
                    toast.error('Fehler: Dateiname konnte nicht gesetzt werden')
                    return
                  }
                  
                  // Lösche alte Datei und lade neue hoch
                  await provider.deleteItem(effectiveMdId)
                  const savedItem = await provider.uploadFile(parentId, markdownFile)
                  
                  UILogger.info('JobReportTab', 'Markdown-Datei erfolgreich gespeichert', {
                    savedItemId: savedItem.id,
                    savedItemName: savedItem.metadata.name,
                    expectedName: originalFileName,
                    parentId
                  })
                  
                  // Prüfe ob der gespeicherte Dateiname korrekt ist
                  if (savedItem.metadata.name !== originalFileName) {
                    UILogger.error('JobReportTab', 'Gespeicherter Dateiname stimmt nicht überein', {
                      expected: originalFileName,
                      actual: savedItem.metadata.name,
                      savedItemId: savedItem.id
                    })
                    toast.error(`Warnung: Dateiname wurde geändert zu: ${savedItem.metadata.name}`)
                  }

                  // Aktualisiere State
                  setFullContent(updatedMarkdown)
                  setCoverImageDisplayUrl(`/api/storage/filesystem?action=binary&fileId=${encodeURIComponent(uploadedItem.id)}&libraryId=${encodeURIComponent(libraryId)}`)

                  // Lade Frontmatter neu
                  const { meta } = parseSecretaryMarkdownStrict(updatedMarkdown)
                  setFrontmatterMeta(meta)
                  
                  // Trigger Refresh: Lade Markdown-Datei neu, um sicherzustellen, dass der State konsistent ist
                  try {
                    const refreshedContent = await provider.getBinary(savedItem.id)
                    const refreshedText = await refreshedContent.blob.text()
                    setFullContent(refreshedText)
                    const { meta: refreshedMeta } = parseSecretaryMarkdownStrict(refreshedText)
                    setFrontmatterMeta(refreshedMeta)
                  } catch (refreshError) {
                    UILogger.warn('JobReportTab', 'Fehler beim Neuladen der aktualisierten Datei', {
                      error: refreshError instanceof Error ? refreshError.message : String(refreshError)
                    })
                  }
                } catch (error) {
                  UILogger.error('JobReportTab', 'Fehler beim Speichern des Cover-Bildes', error)
                  throw error // Re-throw für Caller
                } finally {
                  setIsUploading(false)
                }
              }

              const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0]
                if (!file || !provider || !effectiveMdId) return

                // Prüfe ob es ein Bild ist
                if (!file.type.startsWith('image/')) {
                  toast.error('Nur Bilddateien sind erlaubt')
                  return
                }

                try {
                  await saveCoverImage(file)
                  toast.success('Coverbild hochgeladen und gespeichert')
                } catch (error) {
                  toast.error('Fehler beim Hochladen: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
                } finally {
                  // Reset file input
                  event.target.value = ''
                }
              }

              const handleGeneratedImage = async (file: File) => {
                try {
                  await saveCoverImage(file)
                  // Toast wird bereits in saveCoverImage nicht mehr gesetzt, da es von handleFileUpload kommt
                  // Aber für Generierung wollen wir eine eigene Nachricht
                  toast.success('Bild generiert und gespeichert')
                } catch (error) {
                  toast.error('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
                  throw error // Re-throw damit Dialog offen bleibt
                }
              }

              // Default-Prompt aus Metadaten ableiten (z.B. aus title oder summary)
              const defaultPrompt = (() => {
                const base: Record<string, unknown> = sourceMode === 'frontmatter'
                  ? {}
                  : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
                const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
                const title = cm.title as string | undefined
                const summary = cm.summary as string | undefined
                if (title && typeof title === 'string' && title.trim().length > 0) {
                  return title.trim()
                }
                if (summary && typeof summary === 'string' && summary.trim().length > 0) {
                  // Kürze Summary auf max. 100 Zeichen für Prompt
                  return summary.trim().substring(0, 100)
                }
                return ''
              })()

              return (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    Coverbild für die Ingestion. Das Bild wird im Shadow-Twin-Verzeichnis gespeichert und als <code className="text-xs bg-muted px-1 py-0.5 rounded">coverImageUrl</code> in den Metadaten gespeichert.
                  </div>
                  
                  {coverImageDisplayUrl ? (
                    <div className="space-y-2">
                      <div className="border rounded-md p-3">
                        <img 
                          src={coverImageDisplayUrl} 
                          alt="Coverbild" 
                          className="max-w-full max-h-[400px] object-contain rounded"
                          onError={() => {
                            UILogger.warn('JobReportTab', 'Fehler beim Laden des Cover-Bildes', { coverImageDisplayUrl })
                            setCoverImageDisplayUrl(null)
                          }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Dateiname: {coverImageUrl}
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                      Kein Coverbild vorhanden. Bitte laden Sie ein Bild hoch.
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      disabled={isUploading || !provider || !effectiveMdId || (!shadowTwinState?.shadowTwinFolderId && !fallbackFolderId)}
                      className="hidden"
                      id="cover-image-upload"
                    />
                    <label htmlFor="cover-image-upload">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUploading || !provider || !effectiveMdId || (!shadowTwinState?.shadowTwinFolderId && !fallbackFolderId)}
                        className="w-full cursor-pointer"
                        asChild
                      >
                        <span>
                          {isUploading ? 'Wird hochgeladen...' : coverImageDisplayUrl ? 'Coverbild ersetzen' : 'Coverbild hochladen'}
                        </span>
                      </Button>
                    </label>
                    
                    {/* Button "Bild generieren" - erscheint wenn kein Coverbild vorhanden ist oder zusätzlich */}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsGeneratorDialogOpen(true)}
                      disabled={isUploading || !provider || !effectiveMdId || (!shadowTwinState?.shadowTwinFolderId && !fallbackFolderId)}
                      className="w-full"
                    >
                      {coverImageDisplayUrl ? 'Neues Bild generieren' : 'Bild generieren'}
                    </Button>
                  </div>

                  {(!shadowTwinState?.shadowTwinFolderId && !fallbackFolderId) && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Shadow-Twin-Verzeichnis nicht gefunden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Dialog für Bildgenerierung */}
                  <CoverImageGeneratorDialog
                    open={isGeneratorDialogOpen}
                    onOpenChange={setIsGeneratorDialogOpen}
                    onGenerated={handleGeneratedImage}
                    defaultPrompt={defaultPrompt}
                  />
                </div>
              )
            })()}
          </TabsContent>

          <TabsContent value="ingestion" className="mt-3">
            {ingestionTabMode === 'preview' ? (
              (() => {
                const base: Record<string, unknown> = sourceMode === 'frontmatter'
                  ? {}
                  : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
                const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
                const previewType = getDetailViewType(cm, libraryConfig)
                const body = debouncedContent ? stripFrontmatter(debouncedContent) : ''
                
                // Metadaten mit aufgelöster coverImageUrl (wird durch useEffect aktualisiert)
                const cmWithResolvedImage = resolvedCoverImageUrl !== undefined
                  ? { ...cm, coverImageUrl: resolvedCoverImageUrl }
                  : cm
                
                return (
                  <div className="border rounded-md p-3">
                    <DetailViewRenderer
                      detailViewType={previewType}
                      metadata={cmWithResolvedImage}
                      markdown={body}
                      libraryId={libraryId}
                      provider={provider}
                      currentFolderId={currentFolderId}
                      showBackLink={false}
                    />
                  </div>
                )
              })()
            ) : (
              (() => {
                const effectiveFileId = fileId
                const modifiedAt = (() => {
                  const d = (job?.cumulativeMeta as unknown as { source_file_modified?: unknown })?.source_file_modified
                  if (d instanceof Date) return d.toISOString()
                  if (typeof d === 'string') { const dt = new Date(d); return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString() }
                  return undefined
                })()
                return (
                  <div className="border rounded-md p-3">
                    <IngestionBookDetail libraryId={libraryId} fileId={effectiveFileId} docModifiedAt={modifiedAt} />
                  </div>
                )
              })()
            )}
          </TabsContent>

          <TabsContent value="chapters" className="mt-3">
            {(() => {
              const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
                ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
                : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
              if (!Array.isArray(chapters) || chapters.length === 0) return null
              const pad = (lvl: number | undefined): number => {
                if (typeof lvl !== 'number') return 0
                const clamped = Math.max(0, Math.min(3, lvl))
                return (clamped - 1) * 16
              }
              const counters = [0, 0, 0]
              return (
                <div className="space-y-1">
                  <div>
                    {chapters.map((c, i) => {
                      const level = typeof c.level === 'number' ? c.level : 1
                      const lvl = Math.max(1, Math.min(3, level))
                      counters[lvl - 1] += 1
                      for (let j = lvl; j < counters.length; j++) counters[j] = 0
                      const numLabel = counters.slice(0, lvl).filter(n => n > 0).join('.')
                      const title = typeof c.title === 'string' ? c.title : ''
                      const startPage = typeof c.startPage === 'number' ? c.startPage : ''
                      const summaryVal = typeof c.summary === 'string' ? c.summary : ''
                      const summary = summaryVal.length > 1000 ? `${summaryVal.slice(0, 1000)}…` : summaryVal
                      const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
                      // startEvidence in dieser Ansicht ungenutzt
                      return (
                        <details key={`${title}-${i}`} className="group border-b py-1" open={false}>
                          <summary className="list-none cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0" style={{ paddingLeft: `${pad(lvl)}px` }}>
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-muted-foreground tabular-nums">{numLabel}</span>
                                  <span className="font-medium truncate">{title}</span>
                                </div>
                              </div>
                              <div className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                                {String(startPage)}
                              </div>
                            </div>
                          </summary>
                          <div className="mt-1 pr-1 text-xs space-y-1" style={{ paddingLeft: `${pad(lvl) + 28}px` }}>
                            {summary && (
                              <div className="whitespace-pre-wrap break-words">
                                {summary}
                              </div>
                            )}
                            {Array.isArray(keywords) && keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {keywords.map(k => (
                                  <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </TabsContent>
        </Tabs>
      )}

      {viewMode === 'full' && job && (
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Job {job.jobId}</div>
            <div className="text-xs text-muted-foreground">{job.job_type} · {job.operation} · {new Date(job.updatedAt).toLocaleString()}</div>
          </div>
          <div className="inline-flex items-center rounded px-2 py-0.5 bg-muted text-xs">{job.status}</div>
        </div>
      )}

      {/* Hinweise zu Parserfehlern (strikt) */}
      {viewMode !== 'metaOnly' && parseErrors.length > 0 && (
        <div className="text-xs text-destructive">
          {parseErrors.map((e, i) => (<div key={i}>Parserfehler: {e}</div>))}
        </div>
      )}

      {/* Template Hinweis (im Frontmatter-only-Modus ausgeblendet) */}
      {sourceMode !== 'frontmatter' && job && typeof job.cumulativeMeta?.template_used === 'string' && (
        <div className="text-xs text-muted-foreground">Template: {String(job.cumulativeMeta.template_used)}</div>
      )}

      {/* Schritte mit Ampel-Logik */}
      {viewMode === 'full' && job && Array.isArray(job.steps) && job.steps.length > 0 && (
        <div>
          <div className="font-medium mb-1">Schritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {job.steps.map((s) => {
              // Geplante Phasen ermitteln (neues Policies-Format)
              const p = (job.parameters || {}) as Record<string, unknown>
              const policies = (p['policies'] as { extract?: string; metadata?: string; ingest?: string }) || {}
              const phases = {
                extract: policies.extract !== 'ignore',
                template: policies.metadata !== 'ignore',
                ingest: policies.ingest !== 'ignore',
              }

              const planned = (() => {
                const n = s.name
                if (n === 'extract_pdf') return phases.extract === true
                if (n === 'transform_template' || n === 'store_shadow_twin') return phases.template === true
                if (n === 'ingest_rag') return phases.ingest === true
                return false
              })()

              // Ampel-Status ableiten
              const skipped = !!(s as { details?: { skipped?: boolean } }).details?.skipped
              let icon = '○'
              let cls = 'text-muted-foreground'
              if (s.status === 'failed') { icon = '✕'; cls = 'text-red-600' }
              else if (s.status === 'running') { icon = '◐'; cls = 'text-yellow-600' }
              else if (s.status === 'completed') { icon = skipped ? '○' : '✓'; cls = skipped ? 'text-gray-400' : 'text-green-600' }
              else if (s.status === 'pending') { icon = planned ? '•' : '○'; cls = planned ? 'text-yellow-600' : 'text-muted-foreground' }

              const time = s.endedAt ? new Date(s.endedAt).toLocaleTimeString() : s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : ''
              return (
                <div key={s.name} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${cls}`}>
                  <span>{icon}</span>
                  <span className="font-medium">{s.name}</span>
                  {time ? <span className="opacity-70">{time}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge (nur außerhalb metaOnly-View) */}
      {viewMode !== 'metaOnly' && section === 'meta' && (() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const confidence: Record<string, unknown> = (() => {
          const raw = cm['confidence']
          if (raw && typeof raw === 'object') return raw as Record<string, unknown>
          if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
          return {}
        })()
        const provenance: Record<string, unknown> = (() => {
          const raw = cm['provenance']
          if (raw && typeof raw === 'object') return raw as Record<string, unknown>
          if (typeof raw === 'string') { try { return JSON.parse(raw) as Record<string, unknown> } catch { /* ignore */ } }
          return {}
        })()
        const hasAnyConfidence = Object.keys(confidence).length > 0
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? Array.from(new Set([...(templateFields as string[]), ...Object.keys(cm)]))
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc' && k !== 'confidence' && k !== 'provenance')
        if (flatKeys.length === 0) return null
        return (
        <div>
          {/* Dateiname-Anzeige */}
          {displayedFileName && (
            <div className="text-xs text-muted-foreground mb-2 pb-2 border-b">
              Datei: <span className="font-mono font-medium">{displayedFileName}</span>
            </div>
          )}
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                  {hasAnyConfidence ? <th className="py-1 pr-2 text-right sticky right-0 bg-background border-l">Q</th> : null}
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  const hasNonEmptyValue = (() => {
                    if (val === null || val === undefined) return false
                    if (typeof val === 'string') return val.trim().length > 0
                    if (Array.isArray(val)) return (val as Array<unknown>).length > 0
                    if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length > 0
                    return true
                  })()
                  const cRaw = (confidence as Record<string, unknown>)[k]
                  const cNum = typeof cRaw === 'number' ? cRaw : (typeof cRaw === 'string' && /^\d+(\.\d+)?$/.test(cRaw) ? Number(cRaw) : undefined)
                  const pRaw = (provenance as Record<string, unknown>)[k]
                  const pStr = typeof pRaw === 'string' ? pRaw : pRaw ? JSON.stringify(pRaw) : ''
                  const color = cNum === undefined ? 'text-muted-foreground' : (cNum >= 0.8 ? 'text-green-600' : cNum >= 0.7 ? 'text-yellow-600' : 'text-red-600')
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                      <td className="py-1 pr-2 align-top">
                        {valueStr ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">
                                  {valueStr}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : ''}
                      </td>
                      {hasAnyConfidence ? <td className="py-1 pr-2 align-top sticky right-0 bg-background border-l">
                        {(!hasNonEmptyValue || cNum === undefined) ? null : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center justify-end w-full ${color}`} title={pStr || ''}>
                                  <span className="inline-block h-2 w-2 rounded-full bg-current" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-xs whitespace-pre-wrap break-words">
                                  <div className="font-medium">Confidence: {cNum.toFixed(2)}</div>
                                  {pStr ? <div className="mt-1 text-muted-foreground">Provenance: {pStr}</div> : null}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </td> : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch, TOC-Ansicht) – nur außerhalb metaOnly-View */}
      {viewMode !== 'metaOnly' && section === 'chapters' && (() => {
        const chapters: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.chapters) ? (frontmatterMeta?.chapters as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { chapters?: Array<Record<string, unknown>> })?.chapters || [])
        if (!Array.isArray(chapters) || chapters.length === 0) return null

        const pad = (lvl: number | undefined): number => {
          if (typeof lvl !== 'number') return 0
          const clamped = Math.max(0, Math.min(3, lvl))
          return (clamped - 1) * 16 // px
        }

        // Hierarchische Nummerierung 1., 1.1, 1.1.1 basierend auf level
        const counters = [0, 0, 0]
        return (
        <div className="space-y-1">
          <div className="font-medium mb-1">Kapitel</div>
          <div>
            {chapters.map((c, i) => {
              const level = typeof c.level === 'number' ? c.level : 1
              const lvl = Math.max(1, Math.min(3, level))
              // Zähler aktualisieren
              counters[lvl - 1] += 1
              for (let j = lvl; j < counters.length; j++) counters[j] = 0
              const numLabel = counters.slice(0, lvl).filter(n => n > 0).join('.')
              const title = typeof c.title === 'string' ? c.title : ''
              const startPage = typeof c.startPage === 'number' ? c.startPage : ''
              
              const summaryVal = typeof c.summary === 'string' ? c.summary : ''
              const summary = summaryVal.length > 1000 ? `${summaryVal.slice(0, 1000)}…` : summaryVal
              const keywords = Array.isArray(c.keywords) ? (c.keywords as Array<unknown>).filter(v => typeof v === 'string') as string[] : []
              const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
              return (
                <details key={`${title}-${i}`} className="group border-b py-1" open={false} onToggle={(e) => {
                  const open = (e.currentTarget as HTMLDetailsElement).open
                  if (open) {
                    if (startPage !== '') onJumpTo?.({ page: startPage as number | string })
                    else if (ev) onJumpTo?.({ evidence: ev })
                  }
                }}>
                  <summary className="list-none cursor-pointer">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0" style={{ paddingLeft: `${pad(lvl)}px` }}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-muted-foreground tabular-nums">{numLabel}</span>
                          <span className="font-medium truncate">{title}</span>
                        </div>
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {String(startPage)}
                      </div>
                    </div>
                  </summary>
                  <div className="mt-1 pr-1 text-xs space-y-1" style={{ paddingLeft: `${pad(lvl) + 28}px` }}>
                    {summary && (
                      <div className="whitespace-pre-wrap break-words">
                        {summary}
                      </div>
                    )}
                    {Array.isArray(keywords) && keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {keywords.map(k => (
                          <span key={k} className="inline-flex items-center rounded px-1.5 py-0.5 bg-muted">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* Inhaltsverzeichnis */}
      {section === 'chapters' && (() => {
        const toc: Array<Record<string, unknown>> = sourceMode === 'frontmatter'
          ? (Array.isArray(frontmatterMeta?.toc) ? (frontmatterMeta?.toc as Array<Record<string, unknown>>) : [])
          : ((job?.cumulativeMeta as unknown as { toc?: Array<Record<string, unknown>> }).toc || [])
        if (!Array.isArray(toc) || toc.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Inhaltsverzeichnis</div>
          <div className="overflow-visible">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Titel</th>
                  <th className="py-1 pr-2">Seite</th>
                  <th className="py-1 pr-2">L</th>
                </tr>
              </thead>
              <tbody>
                {toc.map((t, i) => {
                  const title = typeof t.title === 'string' ? t.title : ''
                  const page = typeof t.page === 'number' ? t.page : ''
                  const level = typeof t.level === 'number' ? t.level : ''
                  return (
                    <tr key={`${title}-${i}`} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{title}</td>
                      <td className="py-1 pr-2 align-top">{page}</td>
                      <td className="py-1 pr-2 align-top">{level}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {viewMode === 'full' && job && job.ingestion && (
        <div>
          <div className="font-medium mb-1">Ingestion</div>
          <div className="text-xs text-muted-foreground">{job.ingestion.index || '—'} · Vektoren: {job.ingestion.vectorsUpserted ?? '—'} · {job.ingestion.upsertAt ? new Date(job.ingestion.upsertAt).toLocaleString() : '—'}</div>
        </div>
      )}

      {viewMode === 'full' && job && Array.isArray(job.logs) && job.logs.length > 0 && (
        <div>
          <div className="font-medium mb-1">Logs (neueste zuerst)</div>
          <ul className="space-y-0.5 max-h-48 overflow-auto">
            {[...job.logs].reverse().slice(0, 30).map((l, i) => (
              <li key={i} className="text-xs">
                {new Date(l.timestamp).toLocaleTimeString()} · {l.phase || '—'} · {typeof l.progress === 'number' ? `${l.progress}% · ` : ''}{l.message || ''}
                {l && typeof (l as { details?: unknown }).details === 'object' && (l as { details?: Record<string, unknown> }).details !== null && Object.keys(((l as { details: Record<string, unknown> }).details) || {}).length > 0 ? (
                  <pre className="mt-0.5 whitespace-pre-wrap break-words bg-muted/30 rounded p-1 text-[10px]">{JSON.stringify((l as { details: Record<string, unknown> }).details, null, 2)}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameter am Ende */}
      {viewMode === 'full' && job && job.parameters && (
        <div>
          <div className="font-medium mb-1">Parameter</div>
          <pre className="bg-muted/40 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(job.parameters, null, 2)}</pre>
        </div>
      )}

      {/* Edit-Dialog für Transformationsdatei */}
      {editItem && (
        <ArtifactEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          item={editItem}
          provider={provider}
          onSaved={async (saved) => {
            // Lade aktualisierten Inhalt
            try {
              const refreshedContent = await provider.getBinary(saved.id)
              const refreshedText = await refreshedContent.blob.text()
              setFullContent(refreshedText)
              const { meta } = parseSecretaryMarkdownStrict(refreshedText)
              setFrontmatterMeta(meta)
              toast.success('Änderungen gespeichert')
            } catch (error) {
              UILogger.error('JobReportTab', 'Fehler beim Neuladen nach Speichern', error)
            }
          }}
        />
      )}
    </div>
  )
}


