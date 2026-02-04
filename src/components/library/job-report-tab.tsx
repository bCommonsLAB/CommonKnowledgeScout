"use client";

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import type { TemplatePreviewDetailViewType } from '@/lib/templates/template-types'
import { DetailViewRenderer } from '@/components/library/detail-view-renderer'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentCard } from '@/components/library/gallery/document-card'
import type { DocCardMeta } from '@/lib/gallery/types'
import { AlertTriangle, X, Save, Copy, Link2 } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { validateAndRepairShadowTwin } from '@/lib/shadow-twin/shared'
import { resolveShadowTwinImageUrl } from '@/lib/storage/shadow-twin'
import { CoverImageGeneratorDialog } from './cover-image-generator-dialog'
import { ArtifactEditDialog } from './shared/artifact-edit-dialog'
import { fetchShadowTwinMarkdown, updateShadowTwinMarkdown } from '@/lib/shadow-twin/shadow-twin-mongo-client'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { buildCoverImagePromptForUIWithSource, type CoverImagePromptUIResult } from '@/lib/cover-image/prompt-builder'

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
  // Callback für Header-Buttons (Bearbeiten)
  onEditClick?: () => void
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
  effectiveMdIdRef,
}: JobReportTabProps) {
  const libraries = useAtomValue(librariesAtom)
  const activeLibrary = libraries.find((lib) => lib.id === libraryId)
  const libraryConfig = activeLibrary?.config?.chat
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<StorageItem | null>(null)
  
  // Hole Shadow-Twin-State für die aktuelle Datei
  // Der State enthält binaryUploadEnabled, das die Storage-Implementierung abstrahiert
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
  // Template-spezifischer coverImagePrompt (aus Template-Frontmatter, höchste Priorität)
  const [templateCoverImagePrompt, setTemplateCoverImagePrompt] = useState<string | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [section] = useState<'meta' | 'chapters'>('meta')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fullContent, setFullContent] = useState<string>('')
  const [debouncedContent, setDebouncedContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'markdown' | 'meta' | 'chapters' | 'image' | 'ingestion' | 'process'>(forcedTab || 'markdown')
  const [displayedFileName, setDisplayedFileName] = useState<string | null>(null)
  // State für aufgelöste coverImageUrl in Story-Vorschau
  const [resolvedCoverImageUrl, setResolvedCoverImageUrl] = useState<string | undefined>(undefined)
  // State für Cover-Bild-Upload im "image" Tab
  const [isUploading, setIsUploading] = useState(false)
  const [coverImageDisplayUrl, setCoverImageDisplayUrl] = useState<string | null>(null)
  const [isGeneratorDialogOpen, setIsGeneratorDialogOpen] = useState(false)
  // State für DetailViewType-Override in Story-Vorschau ('auto' = aus Frontmatter/Config ermitteln)
  const [previewDetailViewType, setPreviewDetailViewType] = useState<TemplatePreviewDetailViewType | 'auto'>('auto')
  // State für Bearbeitungsmodus im Markdown-Tab (Rohtext vs. formatiert)
  const [isMarkdownEditing, setIsMarkdownEditing] = useState(false)
  // State für editierten Content (nur Body, ohne Frontmatter)
  const [editedContent, setEditedContent] = useState<string>('')
  // State für Inline-Editing: aktuell bearbeitetes Metadaten-Feld (null = keines)
  const [editingField, setEditingField] = useState<string | null>(null)
  // State für temporären Wert beim Inline-Editing
  const [editingValue, setEditingValue] = useState<string>('')
  // State für Speichern-Loading
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab)
  }, [forcedTab])

  // Resolve coverImageUrl für Story-Vorschau wenn es ein relativer Pfad ist
  // Verwendet den ShadowTwinService via API für Storage-Abstraktion
  useEffect(() => {
    const base: Record<string, unknown> = sourceMode === 'frontmatter'
      ? {}
      : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
    const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
    const coverImageUrl = cm.coverImageUrl as string | undefined
    
    if (!coverImageUrl || !libraryId || !fileId) {
      setResolvedCoverImageUrl(coverImageUrl)
      return
    }
    
    // Wenn bereits absolute URL, verwende direkt
    if (coverImageUrl.startsWith('http://') || coverImageUrl.startsWith('https://') || coverImageUrl.startsWith('/api/storage/')) {
      setResolvedCoverImageUrl(coverImageUrl)
      return
    }
    
    // Relativer Pfad: Verwende ShadowTwinService API zur Auflösung
    let cancelled = false
    async function resolveCoverImage() {
      try {
        // Primär: API-Aufruf an ShadowTwinService
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/resolve-binary-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: fileId,
            sourceName: '',
            parentId: '',
            fragmentName: coverImageUrl,
          }),
        })

        if (res.ok) {
          const json = await res.json() as { resolvedUrl?: string }
          if (!cancelled && json.resolvedUrl) {
            setResolvedCoverImageUrl(json.resolvedUrl)
            return
          }
        }

        // Fallback: Dateisystem-Auflösung (für Kompatibilität)
        if (provider) {
          const baseItem = await provider.getItemById(fileId)
          if (baseItem && !cancelled) {
            const shadowTwinFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId || undefined
            // coverImageUrl ist hier immer ein String (wird oben geprüft)
            const fallbackUrl = await resolveShadowTwinImageUrl(
              baseItem,
              coverImageUrl!,
              provider,
              libraryId,
              shadowTwinFolderId
            )
            if (!cancelled) {
              setResolvedCoverImageUrl(fallbackUrl)
              return
            }
          }
        }

        // Kein Fallback möglich
        if (!cancelled) {
          setResolvedCoverImageUrl(coverImageUrl) // Original beibehalten
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
        setTemplateCoverImagePrompt(null)
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
        // Extrahiere Frontmatter zwischen den ersten beiden --- und lese die Keys/Values bis zu :
        const m = text.match(/^---[\s\S]*?---/)
        if (!m) return
        const fm = m[0]
        const keys: string[] = []
        let extractedCoverImagePrompt: string | null = null
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1).trim()
            if (k) keys.push(k)
            // Extrahiere coverImagePrompt aus Template-Frontmatter (höchste Priorität für Bildgenerierung)
            if (k === 'coverImagePrompt' && v) {
              extractedCoverImagePrompt = v
            }
          }
        }
        setTemplateFields(Array.from(new Set(keys)))
        setTemplateCoverImagePrompt(extractedCoverImagePrompt)
        
        if (extractedCoverImagePrompt) {
          UILogger.debug('JobReportTab', 'Template coverImagePrompt extrahiert', {
            templateName,
            coverImagePrompt: extractedCoverImagePrompt.substring(0, 100)
          })
        }
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

  // Speichert ein einzelnes Metadaten-Feld (Inline-Edit)
  const saveMetaField = useCallback(async (fieldName: string, newValue: string) => {
    if (!effectiveMdId || !fullContent) return
    
    setIsSaving(true)
    try {
      // Parse aktuelles Frontmatter
      const parsed = parseSecretaryMarkdownStrict(fullContent)
      const currentMeta = parsed.meta || {}
      
      // Aktualisiere das Feld
      // Versuche JSON zu parsen (für Arrays/Objekte)
      let parsedValue: unknown = newValue
      if (newValue.startsWith('[') || newValue.startsWith('{')) {
        try {
          parsedValue = JSON.parse(newValue)
        } catch {
          // Kein valides JSON, verwende als String
        }
      }
      currentMeta[fieldName] = parsedValue
      
      // Rekonstruiere Frontmatter
      const frontmatterLines = Object.entries(currentMeta)
        .map(([k, v]) => {
          if (v === null || v === undefined) return `${k}: null`
          if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`
          if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`
          if (typeof v === 'string' && (v.includes('\n') || v.includes(':') || v.includes('"'))) {
            // Multiline oder Sonderzeichen: YAML Block-Style oder Escaping
            if (v.includes('\n')) {
              return `${k}: |\n  ${v.split('\n').join('\n  ')}`
            }
            return `${k}: "${v.replace(/"/g, '\\"')}"`
          }
          return `${k}: ${v}`
        })
      const body = stripFrontmatter(fullContent)
      const newFullContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${body}`
      
      // Speichern
      if (isMongoShadowTwinId(effectiveMdId)) {
        const parts = parseMongoShadowTwinId(effectiveMdId)
        if (!parts) throw new Error('Ungültige Mongo-ID')
        await updateShadowTwinMarkdown(libraryId, parts, newFullContent)
      } else if (provider) {
        const item = await provider.getItemById(effectiveMdId)
        if (!item || !item.parentId) throw new Error('Datei nicht gefunden')
        const blob = new Blob([newFullContent], { type: 'text/markdown' })
        const file = new File([blob], item.metadata.name, { type: 'text/markdown' })
        await provider.deleteItem(item.id)
        await provider.uploadFile(item.parentId, file)
      }
      
      // Aktualisiere States
      setFullContent(newFullContent)
      setDebouncedContent(newFullContent)
      const newParsed = parseSecretaryMarkdownStrict(newFullContent)
      setFrontmatterMeta(newParsed.meta)
      setParseErrors(newParsed.errors || [])
      
      toast.success(`"${fieldName}" gespeichert`)
    } catch (e) {
      toast.error(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
    } finally {
      setIsSaving(false)
      setEditingField(null)
      setEditingValue('')
    }
  }, [effectiveMdId, fullContent, libraryId, provider, stripFrontmatter])
  
  // Exponiere Handler über Callbacks
  useEffect(() => {
    if (onEditClick) {
      // Speichere Handler in Callback-Ref
      const callbackRef = onEditClick as unknown as React.MutableRefObject<(() => void) | undefined>
      callbackRef.current = handleEditClick
    }
  }, [onEditClick, handleEditClick])
  
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
    // provider und effectiveMdId sind hier garantiert definiert (werden oben geprüft)
    const currentProvider = provider!
    const currentMdId = effectiveMdId!
    async function loadEditItem() {
      try {
        const item = await currentProvider.getItemById(currentMdId)
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
        const isMongoId = isMongoShadowTwinId(mdId)
        if (!provider && !isMongoId) return // Type guard fuer Filesystem
        
        // Ermittle den Dateinamen: zuerst aus shadowTwinState, dann aus dem Item
        let fileName: string | null = null
        if (shadowTwinState?.transformed?.metadata?.name) {
          // Transformierte Datei vorhanden
          fileName = shadowTwinState.transformed.metadata?.name || null
        } else if (shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0) {
          // Nur Transcript vorhanden (keine transformierte Datei)
          fileName = shadowTwinState.transcriptFiles[0].metadata?.name || null
        } else if (!isMongoId) {
          // Fallback: Lade Item-Name direkt
          try {
            const item = await provider.getItemById(mdId)
            fileName = item?.metadata?.name || null
          } catch (error) {
            UILogger.warn('JobReportTab', 'Fehler beim Laden des Item-Namens', { mdId, error })
            fileName = null
          }
        } else {
          fileName = fileName || 'Shadow-Twin (Mongo)'
        }
        setDisplayedFileName(fileName)
        
        try {
        let text = ''
        if (isMongoId) {
          const parts = parseMongoShadowTwinId(mdId)
          if (!parts) throw new Error('Mongo-ID ungueltig')
          text = await fetchShadowTwinMarkdown(libraryId, parts)
        } else {
          const bin = await provider.getBinary(mdId)
          text = await bin.blob.text()
        }
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

  // Validiere Shadow-Twin-Daten für schreibende Operationen
  // Prüft ob templateName für Transformationen vorhanden ist
  const validationResult = useMemo(() => {
    if (!shadowTwinState?.transformed) {
      return { valid: true, error: undefined, wasRepaired: false, repairInfo: undefined }
    }
    
    // Kopiere State und validiere
    const stateCopy = { ...shadowTwinState }
    validateAndRepairShadowTwin(
      stateCopy,
      frontmatterMeta ?? undefined,
      {
        // templateName ist nicht mehr Teil von LibraryChatConfig
        templateName: undefined,
        targetLanguage: 'de',
      }
    )
    
    return {
      valid: !stateCopy.validationError,
      error: stateCopy.validationError,
      wasRepaired: stateCopy.wasAutoRepaired,
      repairInfo: stateCopy.autoRepairInfo,
    }
  // Hinweis: templateName wurde aus LibraryChatConfig entfernt
  }, [shadowTwinState, frontmatterMeta])

  // Lade Bild-URL wenn coverImageUrl vorhanden ist (für "image" Tab)
  // Verwendet den ShadowTwinService via API für Storage-Abstraktion
  const coverImageUrl = frontmatterMeta?.coverImageUrl as string | undefined
  useEffect(() => {
    if (!coverImageUrl || !libraryId || !fileId) {
      setCoverImageDisplayUrl(null)
      return
    }

    let cancelled = false
    // coverImageUrl ist hier garantiert definiert (wird oben geprüft)
    const currentCoverImageUrl = coverImageUrl!
    async function loadImageUrl() {
      try {
        // Prüfe ob es bereits eine absolute URL ist
        if (currentCoverImageUrl.startsWith('http://') || currentCoverImageUrl.startsWith('https://') || currentCoverImageUrl.startsWith('/api/storage/')) {
          if (!cancelled) setCoverImageDisplayUrl(currentCoverImageUrl)
          return
        }

        // Relativer Pfad: Verwende ShadowTwinService API zur Auflösung
        // Dies funktioniert unabhängig vom Storage (Dateisystem oder MongoDB/Azure)
        UILogger.info('JobReportTab', 'Lade Cover-Bild via ShadowTwinService API', {
          libraryId,
          fileId,
          coverImageUrl: currentCoverImageUrl,
        })
        
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/resolve-binary-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: fileId,
            sourceName: '',  // Optional, Service holt es aus MongoDB
            parentId: '',    // Optional, Service holt es aus MongoDB
            fragmentName: currentCoverImageUrl,
          }),
        })

        if (!res.ok) {
          const errorJson = await res.json().catch(() => ({})) as { availableFragments?: string[] }
          UILogger.warn('JobReportTab', 'ShadowTwinService API Fehler', {
            status: res.status,
            fileId,
            coverImageUrl: currentCoverImageUrl,
            availableFragments: errorJson.availableFragments,
          })
          // Fallback: Versuche Dateisystem-Auflösung (für Kompatibilität)
          if (provider) {
            const baseItem = await provider.getItemById(fileId)
            if (baseItem && !cancelled) {
              const shadowTwinFolderId = shadowTwinState?.shadowTwinFolderId || fallbackFolderId || undefined
              const fallbackUrl = await resolveShadowTwinImageUrl(
                baseItem,
                currentCoverImageUrl,
                provider,
                libraryId,
                shadowTwinFolderId
              )
              if (!cancelled) setCoverImageDisplayUrl(fallbackUrl)
              return
            }
          }
          if (!cancelled) setCoverImageDisplayUrl(null)
          return
        }

        const json = await res.json() as { resolvedUrl?: string }
        if (!cancelled && json.resolvedUrl) {
          setCoverImageDisplayUrl(json.resolvedUrl)
        } else if (!cancelled) {
          setCoverImageDisplayUrl(null)
        }
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
  }, [coverImageUrl, libraryId, fileId, provider, shadowTwinState?.shadowTwinFolderId, fallbackFolderId])

  // Gemeinsame Funktion zum Speichern eines Coverbildes (für Upload und Generierung)
  // Verwendet die Shadow-Twin API - alle Logik liegt im ShadowTwinService
  const saveCoverImage = useCallback(async (file: File) => {
    if (!libraryId || !fileId) return

    setIsUploading(true)
    try {
      // Ermittle templateName aus verfügbaren Quellen (deterministische Architektur)
      // Für Transformationen ist templateName PFLICHT - kein Fallback/Raten!
      // Quellen in Prioritätsreihenfolge:
      // 1. Frontmatter (template_used)
      // 2. Job-Metadaten (cumulativeMeta.template_used)
      // 3. Mongo-ID (falls effectiveMdId eine mongo-shadow-twin ID ist)
      const templateName = 
        (frontmatterMeta?.template_used as string | undefined) ||
        (job?.cumulativeMeta?.template_used as string | undefined) ||
        (() => {
          // Letzte Möglichkeit: Aus der effectiveMdId extrahieren
          if (effectiveMdId && isMongoShadowTwinId(effectiveMdId)) {
            const parsed = parseMongoShadowTwinId(effectiveMdId)
            return parsed?.templateName
          }
          return undefined
        })()

      // WICHTIG: Für Transformationen ist templateName PFLICHT
      // Ohne templateName kann das Artefakt nicht eindeutig identifiziert werden
      if (!templateName) {
        const errorMsg = 'Template-Name nicht verfügbar. ' +
          'Das Dokument wurde möglicherweise nicht mit einem Template verarbeitet. ' +
          'Bitte verarbeiten Sie das Dokument zuerst mit einem Template.'
        UILogger.error('JobReportTab', errorMsg, {
          libraryId,
          fileId,
          effectiveMdId,
          hasFrontmatter: !!frontmatterMeta,
          hasJob: !!job,
        })
        toast.error(errorMsg)
        return
      }

      UILogger.info('JobReportTab', 'Starte Cover-Bild-Upload via ShadowTwinService', {
        libraryId,
        sourceId: fileId,
        fileName: file.name,
        mimeType: file.type,
        templateName,
      })

      // Kombinierte API: Upload + Frontmatter-Patch
      // Der ShadowTwinService kümmert sich um alles (Azure/MongoDB oder Dateisystem)
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceId', fileId)
      formData.append('kind', 'transformation') // Cover-Bilder gehören zur Transformation
      formData.append('targetLanguage', 'de')
      formData.append('templateName', templateName) // PFLICHT für Transformationen

      const uploadRes = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/upload-cover-image`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const errorJson = await uploadRes.json().catch(() => ({})) as { error?: string }
        throw new Error(errorJson.error || `Upload fehlgeschlagen: ${uploadRes.status}`)
      }

      const result = await uploadRes.json() as { 
        fragment: { 
          name: string
          resolvedUrl: string 
        }
        markdown: string
        artifactId: string
      }

      UILogger.info('JobReportTab', 'Cover-Bild erfolgreich gespeichert', {
        fileName: result.fragment.name,
        resolvedUrl: result.fragment.resolvedUrl,
        artifactId: result.artifactId,
      })

      // Aktualisiere lokalen State mit dem neuen Markdown
      setFullContent(result.markdown)
      setCoverImageDisplayUrl(result.fragment.resolvedUrl)
      
      // Parse aktualisiertes Frontmatter
      const { meta } = parseSecretaryMarkdownStrict(result.markdown)
      setFrontmatterMeta(meta)
    } catch (error) {
      UILogger.error('JobReportTab', 'Fehler beim Speichern des Cover-Bildes', error)
      throw error // Re-throw für Caller
    } finally {
      setIsUploading(false)
    }
  }, [libraryId, fileId, frontmatterMeta, job, effectiveMdId])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [saveCoverImage, provider, effectiveMdId])

  const handleGeneratedImage = useCallback(async (file: File) => {
    try {
      await saveCoverImage(file)
      // Toast wird bereits in saveCoverImage nicht mehr gesetzt, da es von handleFileUpload kommt
      // Aber für Generierung wollen wir eine eigene Nachricht
      toast.success('Bild generiert und gespeichert')
    } catch (error) {
      toast.error('Fehler beim Speichern: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'))
      throw error // Re-throw damit Dialog offen bleibt
    }
  }, [saveCoverImage])

  // Default-Prompt aus Metadaten ableiten via zentrale Utility
  // Priorität: 1. Template-Frontmatter coverImagePrompt (aus Template-Definition)
  //            2. Transformiertes Frontmatter coverImagePrompt (vom LLM generiert)
  //            3. Library-Config coverImagePrompt (Fallback)
  const defaultPromptResult = useMemo((): CoverImagePromptUIResult => {
    const base: Record<string, unknown> = sourceMode === 'frontmatter'
      ? {}
      : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
    const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
    
    // LLM-generierter coverImagePrompt aus transformierten Metadaten
    const llmGeneratedPrompt = cm.coverImagePrompt as string | undefined
    
    // Library-Config coverImagePrompt als Fallback (aus secretaryService)
    const libraryCoverImagePrompt = activeLibrary?.config?.secretaryService?.coverImagePrompt
    
    // Unterstütze sowohl Title/Teaser (großgeschrieben) als auch title/teaser (kleingeschrieben)
    const title = (cm.Title as string | undefined) || (cm.title as string | undefined)
    const teaser = (cm.Teaser as string | undefined) || (cm.teaser as string | undefined)
    
    // Zentrale Utility für UI-Anzeige verwenden (mit Quelle)
    return buildCoverImagePromptForUIWithSource({
      templatePrompt: templateCoverImagePrompt,
      frontmatterPrompt: llmGeneratedPrompt,
      libraryConfigPrompt: typeof libraryCoverImagePrompt === 'string' ? libraryCoverImagePrompt : undefined,
      title,
      summary: teaser,
    })
  }, [sourceMode, job, frontmatterMeta, activeLibrary, templateCoverImagePrompt])
  
  // Kompatibilität: defaultPrompt als String für bestehende Verwendungen
  const defaultPrompt = defaultPromptResult.prompt

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
            {/* Bearbeitungs-Toolbar (nur wenn im Bearbeitungsmodus) */}
            {isMarkdownEditing && (
              <div className="flex justify-end mb-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsMarkdownEditing(false)
                    setEditedContent('')
                  }}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4 mr-1" />
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!effectiveMdId) return
                    // Body mit Frontmatter wieder zusammenführen
                    const parsed = parseSecretaryMarkdownStrict(fullContent)
                    const frontmatterYaml = Object.entries(parsed.meta || {})
                      .map(([k, v]) => {
                        if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`
                        if (typeof v === 'string' && (v.includes('\n') || v.includes(':'))) return `${k}: "${v.replace(/"/g, '\\"')}"`
                        return `${k}: ${v}`
                      })
                      .join('\n')
                    const newFullContent = `---\n${frontmatterYaml}\n---\n\n${editedContent}`
                    
                    setIsSaving(true)
                    try {
                      if (isMongoShadowTwinId(effectiveMdId)) {
                        const parts = parseMongoShadowTwinId(effectiveMdId)
                        if (!parts) throw new Error('Ungültige Mongo-ID')
                        await updateShadowTwinMarkdown(libraryId, parts, newFullContent)
                      } else if (provider) {
                        const item = await provider.getItemById(effectiveMdId)
                        if (!item || !item.parentId) throw new Error('Datei nicht gefunden')
                        const blob = new Blob([newFullContent], { type: 'text/markdown' })
                        const file = new File([blob], item.metadata.name, { type: 'text/markdown' })
                        await provider.deleteItem(item.id)
                        await provider.uploadFile(item.parentId, file)
                      }
                      // Aktualisiere den Content-State
                      setFullContent(newFullContent)
                      setDebouncedContent(newFullContent)
                      // Parse Frontmatter neu
                      const newParsed = parseSecretaryMarkdownStrict(newFullContent)
                      setFrontmatterMeta(newParsed.meta)
                      setParseErrors(newParsed.errors || [])
                      toast.success('Gespeichert')
                      setIsMarkdownEditing(false)
                      setEditedContent('')
                    } catch (e) {
                      toast.error(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                  disabled={isSaving}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaving ? 'Speichern...' : 'Speichern'}
                </Button>
              </div>
            )}
            {/* Content: Rohtext-Editor (nur Body) oder formatierte Vorschau */}
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
                
                // Prüfe Verarbeitungsstatus
                const processingStatus = shadowTwinState?.processingStatus;
                const isReady = processingStatus === 'ready' || processingStatus === undefined;
                const isProcessing = processingStatus === 'processing';
                const isErrorStatus = processingStatus === 'error';
                
                if (isErrorStatus) {
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
                
                // Bearbeitungsmodus: Zeige Rohtext-Editor (nur Body, ohne Frontmatter)
                if (isMarkdownEditing) {
                  return (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="h-[70vh] w-full font-mono text-sm resize-none border-0 focus-visible:ring-0"
                      placeholder="Markdown-Inhalt bearbeiten..."
                      disabled={isSaving}
                    />
                  );
                }
                
                if (debouncedContent && debouncedContent.trim().length > 0 && isReady) {
                  return (
                    <MarkdownPreview 
                      content={stripFrontmatter(debouncedContent)} 
                      currentFolderId={currentFolderId}
                      provider={provider}
                      className="h-[70vh]"
                      onEdit={effectiveMdId ? () => {
                        // Starte Bearbeitungsmodus mit Body (ohne Frontmatter)
                        setEditedContent(stripFrontmatter(fullContent))
                        setIsMarkdownEditing(true)
                      } : undefined}
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
                          // Inline-Edit: Wenn dieses Feld bearbeitet wird, zeige Input
                          const isEditing = editingField === k
                          
                          return (
                            <tr key={k} className="border-t border-muted/40 group">
                              <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                              <td className="py-1 pr-2 align-top">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      value={editingValue}
                                      onChange={(e) => setEditingValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveMetaField(k, editingValue)
                                        } else if (e.key === 'Escape') {
                                          setEditingField(null)
                                          setEditingValue('')
                                        }
                                      }}
                                      onBlur={() => {
                                        // Speichern bei Blur (verzögert, um Klick auf Button zu ermöglichen)
                                        setTimeout(() => {
                                          if (editingField === k) {
                                            saveMetaField(k, editingValue)
                                          }
                                        }, 100)
                                      }}
                                      autoFocus
                                      disabled={isSaving}
                                      className="h-6 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => saveMetaField(k, editingValue)}
                                      disabled={isSaving}
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        setEditingField(null)
                                        setEditingValue('')
                                      }}
                                      disabled={isSaving}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span 
                                          className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top cursor-pointer hover:bg-muted/50 px-1 -mx-1 rounded transition-colors"
                                          onClick={() => {
                                            if (effectiveMdId) {
                                              setEditingField(k)
                                              setEditingValue(valueStr)
                                            }
                                          }}
                                          title={effectiveMdId ? 'Klicken zum Bearbeiten' : ''}
                                        >
                                          {valueStr || <span className="text-muted-foreground italic">–</span>}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="max-w-[80vw] whitespace-pre-wrap break-words">
                                          {valueStr || '(leer)'}
                                          {effectiveMdId && <div className="text-xs text-muted-foreground mt-1">Klicken zum Bearbeiten</div>}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
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
                  {/* Dateiname + Copy-Buttons */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Dateiname: <code className="font-mono bg-muted px-1 py-0.5 rounded">{coverImageUrl}</code></span>
                    {/* URL kopieren */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Bild-URL kopieren"
                      onClick={async () => {
                        if (coverImageDisplayUrl) {
                          await navigator.clipboard.writeText(coverImageDisplayUrl)
                          // Kurzes visuelles Feedback durch Toast wäre ideal,
                          // aber wir nutzen hier erstmal einen simplen Ansatz
                        }
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </Button>
                    {/* Dateiname kopieren */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      title="Dateiname kopieren"
                      onClick={async () => {
                        if (coverImageUrl) {
                          await navigator.clipboard.writeText(coverImageUrl)
                        }
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
                  Kein Coverbild vorhanden. Bitte laden Sie ein Bild hoch.
                </div>
              )}

              {/* Validierungsfehler anzeigen - blockiert schreibende Features */}
              {validationResult.error && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">
                    <strong>Daten inkonsistent:</strong> {validationResult.error}
                    <br />
                    <span className="text-muted-foreground">
                      Nutzen Sie &quot;Bearbeiten&quot;, um das Problem manuell zu beheben.
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {/* Info wenn Auto-Reparatur durchgeführt wurde */}
              {validationResult.wasRepaired && validationResult.repairInfo && (
                <Alert>
                  <AlertDescription className="text-xs">
                    <strong>Automatisch repariert:</strong> {validationResult.repairInfo}
                  </AlertDescription>
                </Alert>
              )}

              {/* Upload-Button */}
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading || !!validationResult.error}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading || !!validationResult.error}
                    className="text-xs"
                  >
                    {isUploading ? 'Lädt...' : 'Bild hochladen'}
                  </Button>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGeneratorDialogOpen(true)}
                  disabled={isUploading || !!validationResult.error}
                  className="text-xs"
                >
                  Bild generieren
                </Button>
              </div>

              {/* Cover-Image-Generator-Dialog */}
              <CoverImageGeneratorDialog
                open={isGeneratorDialogOpen}
                onOpenChange={setIsGeneratorDialogOpen}
                onGenerated={handleGeneratedImage}
                defaultPrompt={defaultPrompt}
                promptSource={defaultPromptResult.source}
                originalPrompt={defaultPromptResult.originalPrompt}
              />
            </div>
          </TabsContent>

          <TabsContent value="ingestion" className="mt-3">
            {ingestionTabMode === 'preview' ? (
              (() => {
                const base: Record<string, unknown> = sourceMode === 'frontmatter'
                  ? {}
                  : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
                const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
                
                // Ermittle den effektiven DetailViewType
                const autoDetectedType = getDetailViewType(cm, libraryConfig)
                const effectivePreviewType: TemplatePreviewDetailViewType = 
                  previewDetailViewType === 'auto' ? autoDetectedType : previewDetailViewType
                
                const body = debouncedContent ? stripFrontmatter(debouncedContent) : ''
                
                // Metadaten mit aufgelöster coverImageUrl (wird durch useEffect aktualisiert)
                const cmWithResolvedImage = resolvedCoverImageUrl !== undefined
                  ? { ...cm, coverImageUrl: resolvedCoverImageUrl }
                  : cm
                
                // Mapping für DocumentCard (Teaser-Vorschau)
                const docCardMeta: DocCardMeta = {
                  id: fileId,
                  title: typeof cm.title === 'string' ? cm.title : '',
                  shortTitle: typeof cm.shortTitle === 'string' ? cm.shortTitle : undefined,
                  fileName: fileName || '',
                  slug: typeof cm.slug === 'string' ? cm.slug : undefined,
                  year: typeof cm.year === 'number' ? cm.year : (typeof cm.year === 'string' ? parseInt(cm.year, 10) || undefined : undefined),
                  region: typeof cm.region === 'string' ? cm.region : undefined,
                  coverImageUrl: resolvedCoverImageUrl,
                  authors: Array.isArray(cm.authors) ? (cm.authors as unknown[]).filter((a): a is string => typeof a === 'string') : undefined,
                  speakers: Array.isArray(cm.speakers) ? (cm.speakers as unknown[]).filter((s): s is string => typeof s === 'string') : undefined,
                  pages: typeof cm.pages === 'number' ? cm.pages : undefined,
                  date: typeof cm.date === 'string' ? cm.date : undefined,
                  track: typeof cm.track === 'string' ? cm.track : undefined,
                  detailViewType: effectivePreviewType,
                  // Klimamaßnahmen-spezifische Felder
                  massnahme_nr: typeof cm.massnahme_nr === 'string' ? cm.massnahme_nr : (typeof cm.massnahme_nr === 'number' ? String(cm.massnahme_nr) : undefined),
                  arbeitsgruppe: typeof cm.arbeitsgruppe === 'string' ? cm.arbeitsgruppe : undefined,
                  lv_bewertung: typeof cm.lv_bewertung === 'string' ? cm.lv_bewertung : undefined,
                  // category mit Fallback auf handlungsfeld für ältere Daten in der DB
                  category: typeof cm.category === 'string' ? cm.category : (typeof cm.handlungsfeld === 'string' ? cm.handlungsfeld : undefined),
                }
                
                // Validierung: Pflichtfelder je nach DetailViewType prüfen
                const requiredFieldsByType: Record<TemplatePreviewDetailViewType, string[]> = {
                  book: ['title', 'summary'],
                  session: ['title', 'speakers'],
                  testimonial: ['title', 'teaser'],
                  blog: ['title', 'summary'],
                  climateAction: ['title', 'category', 'summary'],
                }
                const requiredFields = requiredFieldsByType[effectivePreviewType] || ['title']
                const missingFields = requiredFields.filter(field => {
                  const val = cm[field]
                  if (val === undefined || val === null) return true
                  if (typeof val === 'string' && val.trim() === '') return true
                  if (Array.isArray(val) && val.length === 0) return true
                  return false
                })
                
                return (
                  <div className="space-y-6">
                    {/* 1. Story Layout */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Story Layout</h4>
                      <Select 
                        value={previewDetailViewType} 
                        onValueChange={(v) => setPreviewDetailViewType(v as TemplatePreviewDetailViewType | 'auto')}
                      >
                        <SelectTrigger className="w-full max-w-[300px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatisch ({autoDetectedType})</SelectItem>
                          <SelectItem value="book">Book</SelectItem>
                          <SelectItem value="session">Session</SelectItem>
                          <SelectItem value="testimonial">Testimonial</SelectItem>
                          <SelectItem value="blog">Blog</SelectItem>
                          <SelectItem value="climateAction">ClimateAction</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Validierungswarnungen */}
                      {missingFields.length > 0 && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2">
                          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                          <span>Fehlende Felder: {missingFields.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* 2. Listung in der Galerieansicht (Teaser) */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Listung in der Galerieansicht</h4>
                      <div className="max-w-[300px]">
                        <DocumentCard doc={docCardMeta} />
                      </div>
                    </div>
                    
                    {/* 3. Detailansicht */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Detailansicht</h4>
                      <div className="border rounded-md p-3">
                        <DetailViewRenderer
                          detailViewType={effectivePreviewType}
                          metadata={cmWithResolvedImage}
                          markdown={body}
                          libraryId={libraryId}
                          provider={provider}
                          currentFolderId={currentFolderId}
                          showBackLink={false}
                        />
                      </div>
                    </div>
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
          provider={provider ?? null}
          libraryId={libraryId}
          onSaved={async (saved) => {
            // Lade aktualisierten Inhalt
            try {
              let refreshedText = ''
              if (isMongoShadowTwinId(saved.id)) {
                const parts = parseMongoShadowTwinId(saved.id)
                if (!parts) throw new Error('Mongo-ID ungueltig')
                refreshedText = await fetchShadowTwinMarkdown(libraryId, parts)
              } else {
                if (!provider) throw new Error('Storage-Provider fehlt')
                const refreshedContent = await provider.getBinary(saved.id)
                refreshedText = await refreshedContent.blob.text()
              }
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


