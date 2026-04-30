'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
// Nach Phase 2d werden MarkdownPreview, Tabs, FileText, Sparkles, Upload,
// extractFrontmatter, ArtifactInfoPanel, IngestionDataProvider,
// ArtifactMarkdownPanel, ArtifactEditDialog, IngestionDetailPanel,
// PipelineSheet, JobProgressBar, ArtifactTabLabel, getStoryStep,
// JobReportTabWithShadowTwin, TranscriptToolbarActions, ReviewTranscriptSplit,
// WebsiteReviewOriginalIframe und DocumentPreview alle nur noch innerhalb
// der View-Komponenten unter file-preview/views/* verwendet — nicht mehr
// im Mutterfile.
import type { CompositeWikiPreviewOptions } from './markdown-preview';
import './markdown-audio';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom, reviewModeAtom } from "@/atoms/library-atom";
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import type { Library } from '@/types/library'
import { FileLogger } from "@/lib/debug/logger"
// PdfPhasesView ist bewusst NICHT mehr Teil der File-Preview (zu heavy). Flow-View ist der Expertenmodus.
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'
import { useResolvedTranscriptItem } from "@/components/library/shared/use-resolved-transcript-item"
import { useStoryStatus } from "@/components/library/shared/use-story-status"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { StoryStepStatus } from "@/components/library/shared/story-status"
import type { PipelinePolicies, CoverImageOptions, LlmModelOption } from "@/components/library/flow/pipeline-sheet"
import { runPipelineForFile, getMediaKind, type MediaKind } from "@/lib/pipeline/run-pipeline"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"
import { parseSecretaryMarkdownStrict } from "@/lib/secretary/response-parser"
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { isFilesystemBacked } from '@/lib/storage/library-capability'
import { useShadowTwinFreshnessApi } from "@/hooks/use-shadow-twin-freshness"
import { ShadowTwinSyncBanner } from "@/components/library/shared/shadow-twin-sync-banner"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants"
import { jobInfoByItemIdAtom } from "@/atoms/job-status"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// extractTranscriptLang, getTransformationLabel und TRANSCRIPT_LANG_LABELS
// wurden in src/components/library/file-preview/extension-map.ts ausgegliedert
// (Welle 3-II-a, Schritt 4b — siehe welle-3-archiv-detail-contracts.mdc §6).
import {
  extractTranscriptLang,
  getTransformationLabel,
  TRANSCRIPT_LANG_LABELS,
} from './file-preview/extension-map'

// Nach Phase 2d (Welle 3-II-a Abschluss) werden DocumentPreview,
// JobProgressBar und JobReportTabWithShadowTwin nur noch innerhalb der
// View-Komponenten unter file-preview/views/* verwendet — die Imports
// wurden hier entfernt.

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  /** Wird vor Aktivierung des Review-/Vergleichen-Modus aufgerufen (Ordner-Cache leeren), analog zum früheren LibraryHeader. */
  onClearCacheBeforeReview?: () => void;
}

// getFileType wurde in file-preview/extension-map.ts ausgegliedert
// (Welle 3-II-a). Re-Import oben (zusammen mit den Lang-Helpern):
import { getFileType } from './file-preview/extension-map'

// ContentLoader wird im FilePreview-Wrapper benoetigt (laedt Content
// aus dem Storage und triggert das React-Reducer-Update).
import { ContentLoader } from './file-preview/content-loader'
// View-Komponenten unter file-preview/views/* (Welle 3-II-a Phase 2a-2d):
// - AudioView: rendert die Audio-Detail-Tab-Pipeline (Phase 2a)
// - ImageView: rendert die Bild-Detail-Tab-Pipeline (kein Transcript-Tab, Phase 2a)
// - VideoView: rendert die Video-Detail-Tab-Pipeline (Phase 2b)
// - DefaultView: Fallback fuer unbekannte Dateitypen (Phase 2b)
// - PdfView: rendert die PDF-Detail-Tab-Pipeline (Phase 2c)
// - OfficeView: rendert docx/xlsx/pptx Detail-Pipeline (Phase 2c)
// - MarkdownView: rendert die Markdown-Detail-Pipeline mit Edit-Dialog (Phase 2d)
// - PresentationView: Praesentations-Wrapper (Phase 2d)
// - WebsiteView: rendert die .url-Detail-Pipeline mit Iframe (Phase 2d)
//
// Nach Phase 2d ist der PreviewContent-Switch komplett auf View-Komponenten
// reduziert — Ziel von Welle 3-II-a erreicht.
import { AudioView } from './file-preview/views/audio-view'
import { ImageView } from './file-preview/views/image-view'
import { VideoView } from './file-preview/views/video-view'
import { DefaultView } from './file-preview/views/default-view'
import { PdfView } from './file-preview/views/pdf-view'
import { OfficeView } from './file-preview/views/office-view'
import { MarkdownView } from './file-preview/views/markdown-view'
import { PresentationView } from './file-preview/views/presentation-view'
import { WebsiteView } from './file-preview/views/website-view'
import type { PreviewViewProps } from './file-preview/views/view-props'

// Separate Komponente für die Vorschau
function PreviewContent({ 
  item, 
  fileType, 
  content, 
  error, 
  activeLibraryId,
  provider,
  contentCache,
  onContentUpdated,
  onRefreshFolder,
  storySteps,
  // editHandlerRef entfernt - wird derzeit nicht verwendet
  effectiveMdIdRef,
  pipelineOpenerRef,
  onClearCacheBeforeReview,
}: {
  item: StorageItem;
  fileType: string;
  content: string;
  error: string | null;
  activeLibraryId: string;
  provider: StorageProvider | null;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentUpdated: (content: string) => void;
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
  storySteps: StoryStepStatus[];
  effectiveMdIdRef?: React.MutableRefObject<string | null>;
  /** Ref, über den FilePreview die Pipeline-Öffnung triggern kann (Freshness-Banner) */
  pipelineOpenerRef?: React.MutableRefObject<(() => void) | null>;
  onClearCacheBeforeReview?: () => void;
}) {
  const [infoTab, setInfoTab] = React.useState<"original" | "transcript" | "transform" | "story" | "overview">("original")
  const transcript = useResolvedTranscriptItem({
    provider,
    libraryId: activeLibraryId,
    sourceFile: ['pdf', 'audio', 'video', 'image', 'docx', 'xlsx', 'pptx'].includes(fileType) ? item : null,
    targetLanguage: "de",
  })
  // Ausgewähltes Transkript aus der Liste aller verfügbaren Transkripte
  const [selectedTranscriptIdx, setSelectedTranscriptIdx] = React.useState<number>(0)
  const [selectedTransformationIdx, setSelectedTransformationIdx] = React.useState<number>(0)
  const [transformItem, setTransformItem] = React.useState<StorageItem | null>(null)
  const [transformError, setTransformError] = React.useState<string | null>(null)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isSplittingPages, setIsSplittingPages] = React.useState(false)

  // Statusabfrage-States (derzeit nicht genutzt – bei Bedarf aktivieren)
  // const [ragLoading, setRagLoading] = React.useState(false);
  // const [ragError, setRagError] = React.useState<string | null>(null);
  // const [ragStatus, setRagStatus] = React.useState<{
  //   status: 'ok' | 'stale' | 'not_indexed';
  //   fileName?: string;
  //   chunkCount?: number;
  //   upsertedAt?: string;
  //   docModifiedAt?: string;
  //   docMeta?: Record<string, unknown>;
  //   toc?: Array<Record<string, unknown>>;
  //   totals?: { docs: number; chunks: number };
  //   analyze?: { chapters?: Array<Record<string, unknown>>; toc?: Array<Record<string, unknown>> };
  // } | null>(null);
  const setSelectedFile = useSetAtom(selectedFileAtom);
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const [isReviewMode, setReviewMode] = useAtom(reviewModeAtom)
  /** Review/Vergleichen: vor dem Einschalten optional Cache leeren (Library übergibt clearCache). */
  const handleReviewModeToggle = React.useCallback(() => {
    setReviewMode((prev) => {
      if (!prev) {
        onClearCacheBeforeReview?.()
      }
      return !prev
    })
  }, [onClearCacheBeforeReview, setReviewMode])

  // Review: eine gemeinsame Tab-Leiste — Vergleich nur im Transkript-Tab (Split), nicht zwei FilePreviews.
  React.useEffect(() => {
    if (isReviewMode) {
      setInfoTab("transcript")
    }
  }, [isReviewMode])

  /** Namen → fileId im Ordner der aktuellen Datei (für Composite-Wikilinks / resolve-binary-url). */
  const [wikiSiblingMap, setWikiSiblingMap] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    if (!activeLibraryId || !item.id) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/sibling-files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: item.id }),
        })
        if (!res.ok || cancelled) return
        const json = await res.json() as { files: Array<{ id: string; name: string }> }
        const m: Record<string, string> = {}
        for (const f of json.files ?? []) m[f.name] = f.id
        if (!cancelled) setWikiSiblingMap(m)
      } catch {
        if (!cancelled) setWikiSiblingMap({})
      }
    })()
    return () => { cancelled = true }
  }, [activeLibraryId, item.id])

  const onWikiNavigateToFile = React.useCallback(
    async (targetFileId: string, options?: { openTranscriptTab?: boolean }) => {
      if (!provider) return
      try {
        const target = await provider.getItemById(targetFileId)
        if (target) {
          setSelectedFile(target)
          if (options?.openTranscriptTab) setInfoTab('transcript')
        }
      } catch (err) {
        FileLogger.warn('PreviewContent', 'Wiki-Navigation zu Datei fehlgeschlagen', { err })
      }
    },
    [provider, setSelectedFile]
  )

  // Hole Shadow-Twin-State für die aktuelle Datei
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  const shadowTwinState = shadowTwinStates.get(item.id);
  // Job-Status fuer diese Datei aus dem globalen Atom lesen.
  // WICHTIG: Dieser Block muss vor Effects stehen, die currentJobInfo in Dependencies nutzen.
  const jobInfoByItemId = useAtomValue(jobInfoByItemIdAtom)
  const currentJobInfo = jobInfoByItemId[item.id]
  const STALE_JOB_THRESHOLD_MS = 10 * 60 * 1000
  const isJobStale = React.useMemo(() => {
    if (!currentJobInfo?.updatedAt) return true
    const age = Date.now() - new Date(currentJobInfo.updatedAt).getTime()
    return age > STALE_JOB_THRESHOLD_MS
  }, [currentJobInfo?.updatedAt, STALE_JOB_THRESHOLD_MS])
  const hasActiveJob = !isJobStale && (currentJobInfo?.status === 'queued' || currentJobInfo?.status === 'running')

  // Alle verfügbaren Transkripte (alle Sprachen) aus MongoDB laden.
  // Die Batch-Resolve-API liefert nur ein Transkript pro Source, daher holen wir
  // bei der ausgewählten Datei alle Sprach-Varianten über die Shadow-Twins-API.
  const [allTranscriptFiles, setAllTranscriptFiles] = React.useState<StorageItem[]>([])
  const [allTransformationFiles, setAllTransformationFiles] = React.useState<StorageItem[]>([])
  // Lokaler Trigger: Erhöhung erzwingt erneutes Laden aller Artefakte (loadAllArtifacts-Effect).
  // Wird vom Fallback-Polling gesetzt, wenn der Job als abgeschlossen erkannt wird.
  const [artifactsRefreshTrigger, setArtifactsRefreshTrigger] = React.useState(0)
  React.useEffect(() => {
    if (!activeLibraryId || !item.id) return
    let cancelled = false
    async function loadAllArtifacts() {
      try {
        const res = await fetch(
          `/api/library/${encodeURIComponent(activeLibraryId)}/shadow-twins/${encodeURIComponent(item.id)}?ts=${Date.now()}`,
          { cache: 'no-store' }
        )
        if (!res.ok || cancelled) return
        const data = await res.json() as {
          artifacts?: Array<{ kind: string; targetLanguage: string; markdownLength: number; updatedAt: string; templateName?: string }>
        }
        if (cancelled || !data.artifacts) return
        // Nur Transkripte filtern und als virtuelle StorageItems erstellen
        const transcriptArtifacts = data.artifacts
          .filter((a) => a.kind === 'transcript')
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        const transformationArtifacts = data.artifacts
          .filter((a) => a.kind === 'transformation')
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        if (transcriptArtifacts.length <= 1) {
          // Nur ein Transkript → kein Dropdown nötig, bleibe bei der bestehenden Logik
          setAllTranscriptFiles([])
        } else {
          const baseName = item.metadata.name.replace(/\.[^.]+$/, '')
          const virtualItems: StorageItem[] = transcriptArtifacts.map((a) => {
            const fileName = `${baseName}.${a.targetLanguage}.md`
            // Mongo-Shadow-Twin-ID (Format: mongo-shadow-twin:<libraryId>::<sourceId>::<kind>::<lang>::<template?>)
            const parts = [activeLibraryId, item.id, 'transcript', a.targetLanguage, ''].map(encodeURIComponent)
            const mongoId = `mongo-shadow-twin:${parts.join('::')}`
            return {
              id: mongoId,
              parentId: item.parentId ?? '',
              type: 'file' as const,
              metadata: {
                name: fileName,
                size: a.markdownLength ?? 0,
                modifiedAt: new Date(a.updatedAt ?? Date.now()),
                mimeType: 'text/markdown',
                isTwin: true,
              },
            }
          })
          if (!cancelled) setAllTranscriptFiles(virtualItems)
        }

        const baseName = item.metadata.name.replace(/\.[^.]+$/, '')
        const virtualTransformItems: StorageItem[] = transformationArtifacts.map((a) => {
          const templateName = typeof a.templateName === 'string' && a.templateName.trim().length > 0
            ? a.templateName
            : 'template'
          const fileName = `${baseName}.${templateName}.${a.targetLanguage}.md`
          const parts = [activeLibraryId, item.id, 'transformation', a.targetLanguage, templateName].map(encodeURIComponent)
          const mongoId = `mongo-shadow-twin:${parts.join('::')}`
          return {
            id: mongoId,
            parentId: item.parentId ?? '',
            type: 'file' as const,
            metadata: {
              name: fileName,
              size: a.markdownLength ?? 0,
              modifiedAt: new Date(a.updatedAt ?? Date.now()),
              mimeType: 'text/markdown',
              isTwin: true,
            },
          }
        })
        if (!cancelled) setAllTransformationFiles(virtualTransformItems)
      } catch {
        // Fehler ignorieren – Dropdown bleibt ausgeblendet
      }
    }
    void loadAllArtifacts()
    return () => { cancelled = true }
    // transcript.transcriptItem triggert Neuladen, wenn ein neues Transkript erstellt wird
    // currentJobInfo aktualisiert Artefakte direkt nach Job-Ende (ohne Dateiwechsel)
    // artifactsRefreshTrigger: direkter Fallback-Trigger vom Polling-Mechanismus
  }, [
    activeLibraryId,
    item.id,
    item.metadata.name,
    item.parentId,
    transcript.transcriptItem,
    shadowTwinState?.transformed?.id,
    currentJobInfo?.status,
    currentJobInfo?.updatedAt,
    artifactsRefreshTrigger,
  ])

  // Verfügbare Transkripte: bevorzuge die vollständige Liste aus der API,
  // Fallback auf die Einzeldatei aus dem Shadow-Twin-State
  const availableTranscripts = allTranscriptFiles.length > 0
    ? allTranscriptFiles
    : (shadowTwinState?.transcriptFiles ?? [])
  const displayTranscriptItem = React.useMemo(() => {
    if (availableTranscripts.length > 0) {
      const idx = Math.min(selectedTranscriptIdx, availableTranscripts.length - 1)
      return availableTranscripts[idx] ?? null
    }
    return transcript.transcriptItem
  }, [availableTranscripts, selectedTranscriptIdx, transcript.transcriptItem])

  const availableTransformations = React.useMemo(() => {
    if (allTransformationFiles.length > 0) return allTransformationFiles
    return shadowTwinState?.transformed ? [shadowTwinState.transformed] : []
  }, [allTransformationFiles, shadowTwinState?.transformed])

  const displayTransformationItem = React.useMemo(() => {
    if (availableTransformations.length === 0) return null
    const idx = Math.min(selectedTransformationIdx, availableTransformations.length - 1)
    return availableTransformations[idx] ?? null
  }, [availableTransformations, selectedTransformationIdx])

  // Sprach-Dropdown als headerExtra für ArtifactMarkdownPanel
  const transcriptHeaderExtra = React.useMemo(() => {
    if (availableTranscripts.length <= 1) return undefined
    return (
      <Select
        value={String(Math.min(selectedTranscriptIdx, availableTranscripts.length - 1))}
        onValueChange={(v) => setSelectedTranscriptIdx(Number(v))}
      >
        <SelectTrigger className="h-7 w-auto min-w-[80px] text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableTranscripts.map((tf, idx) => {
            const lang = extractTranscriptLang(tf.metadata.name)
            const label = lang
              ? (TRANSCRIPT_LANG_LABELS[lang] ?? lang.toUpperCase())
              : tf.metadata.name
            return (
              <SelectItem key={tf.id} value={String(idx)}>
                {lang ? `${lang.toUpperCase()} – ${label}` : label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    )
  }, [availableTranscripts, selectedTranscriptIdx])

  const transformHeaderExtra = React.useMemo(() => {
    if (availableTransformations.length <= 1) return null
    return (
      <Select
        value={String(Math.min(selectedTransformationIdx, availableTransformations.length - 1))}
        onValueChange={(v) => setSelectedTransformationIdx(Number(v))}
      >
        <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableTransformations.map((tf, idx) => (
            <SelectItem key={tf.id} value={String(idx)}>
              {getTransformationLabel(tf)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }, [availableTransformations, selectedTransformationIdx])

  // Bestimme das Verzeichnis für Bild-Auflösung im Markdown-Viewer:
  // 
  // Strategie:
  // 1. Wenn shadowTwinFolderId aus dem Shadow-Twin-State verfügbar ist, verwende es
  //    (für PDF-Dateien, deren Markdown im JobReportTab angezeigt wird)
  // 2. Wenn die Datei selbst eine Markdown-Datei im Shadow-Twin-Verzeichnis ist,
  //    dann ist item.parentId bereits das Shadow-Twin-Verzeichnis - verwende es
  // 3. Sonst verwende item.parentId (normale Dateien)
  //
  // WICHTIG: Für Markdown-Dateien, die im Shadow-Twin-Verzeichnis liegen, ist item.parentId
  // bereits das Shadow-Twin-Verzeichnis. Dies ist die korrekte Basis für Bild-Referenzen.
  // Der Shadow-Twin-State wird für die PDF-Datei gespeichert, nicht für die Markdown-Datei,
  // daher müssen wir item.parentId verwenden, wenn die Markdown-Datei direkt geöffnet wird.
  const currentFolderId = shadowTwinState?.shadowTwinFolderId || item.parentId;

  /**
   * Sammeltranskript / Bild-Sammelanalyse: Wikilink-Aufloesung und optional
   * Mongo-„Transkript pruefen“ im Viewer.
   *
   * Wir aktivieren denselben `compositeWikiPreview`-Hook fuer beide Container-
   * Arten, weil beide `siblingNameToId` brauchen, um eingebettete Quellen
   * korrekt aufzuloesen:
   * - `composite-transcript`: Wikilinks auf Geschwister, Transkript-pruefen-Links
   * - `composite-multi`: Bild-Embeds als Grid (`replaceCompositeMultiPreviewBlock`)
   */
  const compositeWikiPreview = React.useMemo((): CompositeWikiPreviewOptions | null => {
    if (!activeLibraryId || fileType !== 'markdown' || !content?.trim()) return null
    const { meta } = parseFrontmatter(content)
    const isCompositeContainer = meta?.kind === 'composite-transcript' || meta?.kind === 'composite-multi'
    if (!isCompositeContainer) return null
    // Storage-agnostischer Helper: liefert true, wenn die Library auf einem
    // Filesystem-Backend persistiert. UI muss `primaryStore` nicht mehr selbst lesen
    // (siehe `.cursor/rules/storage-contracts.mdc` §5).
    const transcriptOnFs = isFilesystemBacked(activeLibrary as Library | null | undefined)
    return {
      libraryId: activeLibraryId,
      parentFolderId: item.parentId ?? '',
      siblingNameToId: wikiSiblingMap,
      injectMongoTranscriptLinks: !transcriptOnFs,
      onNavigateToFile: onWikiNavigateToFile,
    }
  }, [
    activeLibraryId,
    fileType,
    content,
    activeLibrary,
    item.parentId,
    wikiSiblingMap,
    onWikiNavigateToFile,
  ])
  
  // Debug-Log für PreviewContent
  React.useEffect(() => {
    FileLogger.info('PreviewContent', 'PreviewContent gerendert', {
      itemId: item.id,
      itemName: item.metadata.name,
      fileType,
      contentLength: content.length,
      hasError: !!error,
      hasProvider: !!provider,
      activeLibraryId,
      currentFolderId,
      shadowTwinFolderId: shadowTwinState?.shadowTwinFolderId,
      parentId: item.parentId,
      hasShadowTwinState: !!shadowTwinState,
      shadowTwinStateKeys: shadowTwinState ? Object.keys(shadowTwinState) : []
    });
  }, [item.id, item.metadata.name, fileType, content.length, error, provider, activeLibraryId, currentFolderId, shadowTwinState?.shadowTwinFolderId, item.parentId, shadowTwinState]);
  
  React.useEffect(() => {
    setInfoTab("original");
    setSelectedTranscriptIdx(0);
    setSelectedTransformationIdx(0);
    setAllTranscriptFiles([]);
    setAllTransformationFiles([]);
  }, [item.id]);

  React.useEffect(() => {
    let cancelled = false

    // DIAGNOSE: Zeigt den genauen Zustand von shadowTwinState.transformed
    FileLogger.info('PreviewContent', 'Transform-Effect ausgelöst', {
      itemId: item.id,
      itemName: item.metadata.name,
      hasShadowTwinState: !!shadowTwinState,
      hasTransformed: !!displayTransformationItem,
      transformedId: displayTransformationItem?.id ?? 'N/A',
      transformedName: displayTransformationItem?.metadata?.name ?? 'N/A',
      isMongoId: displayTransformationItem?.id?.startsWith('mongo-shadow-twin:') ?? false,
    });

    async function loadTransformItem() {
      if (!displayTransformationItem?.id) {
        setTransformItem(null)
        setTransformError(null)
        return
      }
      
      const transformedId = displayTransformationItem.id
      
      // Prüfe, ob die ID eine Mongo-Shadow-Twin-ID ist
      // Diese IDs haben das Format: "mongo-shadow-twin:..."
      // In diesem Fall brauchen wir keinen Provider-Aufruf, da das Artefakt in MongoDB liegt
      if (transformedId.startsWith('mongo-shadow-twin:')) {
        // Für Mongo-Artefakte: Verwende die Metadaten direkt
        // Das Artefakt wird über /api/library/.../shadow-twins/content geladen
        if (cancelled) return
        setTransformItem(displayTransformationItem)
        setTransformError(null)
        return
      }
      
      // Für Filesystem-Artefakte: Lade über Provider
      if (!provider) {
        setTransformItem(null)
        setTransformError(null)
        return
      }
      try {
        const loaded = await provider.getItemById(transformedId)
        if (cancelled) return
        setTransformItem(loaded)
        setTransformError(null)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        setTransformItem(null)
        setTransformError(message)
      }
    }

    void loadTransformItem()
    return () => {
      cancelled = true
    }
  }, [provider, displayTransformationItem])

  // Pipeline-Sheet State und Logik
  // Korrekturhinweis aus localStorage laden (persistent pro Datei)
  const customHintStorageKey = `customHint:${activeLibraryId}:${item.id}`
  const [savedCustomHint, setSavedCustomHint] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    const v = localStorage.getItem(customHintStorageKey) ?? ''
    console.log('[file-preview] savedCustomHint init:', { customHintStorageKey, value: v, length: v.length })
    return v
  })
  const [isPipelineOpen, setIsPipelineOpen] = React.useState(false)

  // Registriere Pipeline-Opener für Freshness-Banner (ref-basiert, um Prop-Drilling zu vermeiden)
  React.useEffect(() => {
    if (pipelineOpenerRef) {
      pipelineOpenerRef.current = () => setIsPipelineOpen(true)
    }
    return () => {
      if (pipelineOpenerRef) pipelineOpenerRef.current = null
    }
  }, [pipelineOpenerRef])

  // DEBUG: Log wenn Pipeline geöffnet und defaultCustomHint an PipelineSheet übergeben wird
  React.useEffect(() => {
    if (isPipelineOpen) {
      console.log('[file-preview] PipelineSheet wird geöffnet mit defaultCustomHint:', {
        savedCustomHint,
        savedCustomHintLength: savedCustomHint?.length ?? 0,
      })
    }
  }, [isPipelineOpen, savedCustomHint])

  // Korrekturhinweis aus Metadaten des transformierten Artefakts laden, wenn Feld leer
  // (localStorage ist oft leer nach Reload; Metadaten sind die Quelle der Wahrheit)
  React.useEffect(() => {
    if (!isPipelineOpen || !activeLibraryId) return
    if (savedCustomHint && savedCustomHint.length > 0) return
    const transformedId = shadowTwinState?.transformed?.id
    if (!transformedId) return

    let cancelled = false
    async function loadFromMetadata() {
      try {
        let markdown = ''
        if (isMongoShadowTwinId(transformedId)) {
          const parts = parseMongoShadowTwinId(transformedId)
          if (!parts || cancelled) return
          markdown = await fetchShadowTwinMarkdown(activeLibraryId, parts)
        } else if (provider && transformedId) {
          const bin = await provider.getBinary(transformedId)
          markdown = await bin.blob.text()
        }
        if (cancelled || !markdown) return
        const { meta } = parseSecretaryMarkdownStrict(markdown)
        const hint = typeof meta?.customHint === 'string' ? meta.customHint.trim() : ''
        if (hint) {
          setSavedCustomHint(hint)
          localStorage.setItem(customHintStorageKey, hint)
        }
      } catch (err) {
        FileLogger.warn('file-preview', 'customHint aus Metadaten laden fehlgeschlagen', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    void loadFromMetadata()
    return () => {
      cancelled = true
    }
  }, [isPipelineOpen, activeLibraryId, savedCustomHint, shadowTwinState?.transformed?.id, customHintStorageKey, provider])

  const [pipelineDefaultSteps, setPipelineDefaultSteps] = React.useState<{ extract: boolean; metadata: boolean; ingest: boolean } | undefined>(undefined)
  const [pipelineDefaultForce, setPipelineDefaultForce] = React.useState(false)
  const [targetLanguage, setTargetLanguage] = React.useState<string>("")
  // Quellsprache für Transkription (Whisper). 'auto' = automatische Erkennung
  const [sourceLanguage, setSourceLanguage] = React.useState<string>("auto")
  const [templateName, setTemplateName] = React.useState<string>("")
  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)
  const [isRunningPipeline, setIsRunningPipeline] = React.useState(false)
  // Hält die jobId des zuletzt gestarteten Jobs (wird für Fallback-Polling genutzt)
  const [pendingJobId, setPendingJobId] = React.useState<string | null>(null)
  
  // LLM-Modell-State
  const [llmModel, setLlmModel] = React.useState<string>("")
  const [llmModels, setLlmModels] = React.useState<LlmModelOption[]>([])
  const [isLoadingLlmModels, setIsLoadingLlmModels] = React.useState(false)

  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.template
  const libraryConfigLlmModel = activeLibrary?.config?.secretaryService?.llmModel

  const kind: MediaKind = React.useMemo(() => getMediaKind(item), [item])
  const defaults = React.useMemo(() => {
    if (!activeLibraryId) return null
    return getEffectivePdfDefaults(
      activeLibraryId,
      loadPdfDefaults(activeLibraryId),
      {},
      libraryConfigChatTargetLanguage,
      libraryConfigPdfTemplate
    )
  }, [activeLibraryId, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate])
  
  const effectiveTargetLanguage = React.useMemo(() => {
    if (targetLanguage) return targetLanguage
    return typeof defaults?.targetLanguage === "string" ? defaults.targetLanguage : TARGET_LANGUAGE_DEFAULT
  }, [targetLanguage, defaults])

  // Templates laden wenn Pipeline-Sheet geöffnet ist
  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!activeLibraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(activeLibraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // Falls kein Template ausgewählt: Library-Default verwenden, wenn verfügbar
        if (!templateName && names.length > 0 && libraryConfigPdfTemplate) {
          const defaultExists = names.some(n => n.toLowerCase() === libraryConfigPdfTemplate.toLowerCase())
          if (defaultExists) {
            // Finde den exakten Namen (Case-sensitiv) aus der Liste
            const exactName = names.find(n => n.toLowerCase() === libraryConfigPdfTemplate.toLowerCase())
            if (exactName) setTemplateName(exactName)
          }
        }
      } catch (err) {
        FileLogger.warn("file-preview", "Templates konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setTemplates([])
      } finally {
        if (!cancelled) setIsLoadingTemplates(false)
      }
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [activeLibraryId, isPipelineOpen, templateName, libraryConfigPdfTemplate])

  // LLM-Modelle laden wenn Pipeline-Sheet geöffnet ist
  React.useEffect(() => {
    let cancelled = false
    async function loadLlmModels() {
      if (!isPipelineOpen) return
      setIsLoadingLlmModels(true)
      try {
        const res = await fetch("/api/public/llm-models")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as Array<{ _id: string; modelId: string; name: string; strengths?: string }>
        if (cancelled) return
        const models: LlmModelOption[] = data
          .filter(m => !!m.modelId)
          .map(m => ({
            modelId: m.modelId,
            name: m.name,
            strengths: m.strengths,
          }))
        setLlmModels(models)
        // Falls kein Modell ausgewählt: Library-Default verwenden, sonst erstes Modell
        if (!llmModel && models.length > 0) {
          const defaultModel = libraryConfigLlmModel && models.some(m => m.modelId === libraryConfigLlmModel)
            ? libraryConfigLlmModel
            : models[0].modelId
          setLlmModel(defaultModel)
        }
      } catch (err) {
        FileLogger.warn("file-preview", "LLM-Modelle konnten nicht geladen werden", {
          error: err instanceof Error ? err.message : String(err),
        })
        if (!cancelled) setLlmModels([])
      } finally {
        if (!cancelled) setIsLoadingLlmModels(false)
      }
    }
    void loadLlmModels()
    return () => {
      cancelled = true
    }
  }, [isPipelineOpen, llmModel, libraryConfigLlmModel])

  // Öffne Pipeline-Sheet mit Defaults basierend auf fehlender Phase
  // force=true oeffnet die Maske mit aktiviertem "Bestehende Assets ueberschreiben"
  const openPipelineForPhase = React.useCallback((phase: "transcript" | "transform" | "story", force = false) => {
    if (phase === "transcript") {
      // Nur Extract aktiv
      setPipelineDefaultSteps({ extract: true, metadata: false, ingest: false })
    } else if (phase === "transform") {
      // Nur Transformation aktiv
      setPipelineDefaultSteps({ extract: false, metadata: true, ingest: false })
    } else if (phase === "story") {
      // Nur Ingestion aktiv
      setPipelineDefaultSteps({ extract: false, metadata: false, ingest: true })
    }
    setPipelineDefaultForce(force)
    // Korrekturhinweis bei jedem Öffnen aus localStorage aktualisieren,
    // damit der zuletzt gespeicherte Wert immer angezeigt wird.
    if (typeof window !== 'undefined') {
      const fromStorage = localStorage.getItem(customHintStorageKey) ?? ''
      console.log('[file-preview] openPipelineForPhase – customHint:', {
        customHintStorageKey,
        fromStorage,
        fromStorageLength: fromStorage.length,
        phase,
        force,
      })
      setSavedCustomHint(fromStorage)
    }
    setIsPipelineOpen(true)
  }, [customHintStorageKey])

  // Pipeline starten
  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; sourceLanguage?: string; policies: PipelinePolicies; coverImage?: CoverImageOptions; llmModel?: string; customHint?: string }) => {
      if (!activeLibraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (item.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!item.parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunningPipeline(true)
      try {
        const { jobId } = await runPipelineForFile({
          libraryId: activeLibraryId!,
          sourceFile: item,
          parentId: item.parentId,
          kind,
          targetLanguage: args.targetLanguage,
          // Quellsprache für Transkription (Whisper) – nur setzen wenn explizit angegeben
          sourceLanguage: args.sourceLanguage,
          templateName: args.templateName,
          policies: args.policies,
          libraryConfigChatTargetLanguage,
          libraryConfigPdfTemplate,
          // Cover-Bild-Generierung
          generateCoverImage: args.coverImage?.generateCoverImage,
          coverImagePrompt: args.coverImage?.coverImagePrompt,
          // Korrekturhinweis des Anwenders (optional, wird ans Prompt angehängt)
          customHint: args.customHint,
          // LLM-Modell für Template-Transformation
          llmModel: args.llmModel,
        })

        // Korrekturhinweis für Re-Open in localStorage speichern
        if (args.customHint) {
          localStorage.setItem(customHintStorageKey, args.customHint)
          setSavedCustomHint(args.customHint)
          console.log('[file-preview] runPipeline – customHint gespeichert:', {
            customHintStorageKey,
            customHint: args.customHint,
            customHintLength: args.customHint.length,
          })
        } else {
          localStorage.removeItem(customHintStorageKey)
          setSavedCustomHint('')
          console.log('[file-preview] runPipeline – customHint entfernt (war leer)', { customHintStorageKey })
        }

        // Job-ID speichern – Fallback-Polling prüft ob die Verarbeitung abgeschlossen ist,
        // falls SSE-Events nicht ankommen (z.B. Panel war geschlossen, Verbindungsfehler).
        setPendingJobId(jobId)
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
        setIsPipelineOpen(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("file-preview", "Pipeline fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunningPipeline(false)
      }
    },
    [activeLibraryId, item, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate, customHintStorageKey]
  )

  // Fallback-Polling: wenn nach einem Pipeline-Start die SSE-Events ausbleiben
  // (z.B. weil der Job-Monitor-Panel-SSE noch nicht verbunden war), prüfen wir
  // alle 8 Sekunden den Job-Status direkt über die REST-API.
  // Sobald der Job abgeschlossen ist, wird loadAllArtifacts automatisch neu getriggert,
  // indem currentJobInfo über den Jotai-Atom aktualisiert wird.
  // Alternativ: direkte Shadow-Twin-Analyse neu triggern, falls currentJobInfo fehlt.
  React.useEffect(() => {
    if (!pendingJobId || !activeLibraryId) return

    let stopped = false
    let pollCount = 0
    const MAX_POLLS = 30 // max ~4 Minuten

    const poll = async () => {
      if (stopped || pollCount >= MAX_POLLS) return
      pollCount++
      try {
        const res = await fetch(`/api/external/jobs/${encodeURIComponent(pendingJobId)}`, { cache: 'no-store' })
        if (!res.ok || stopped) return
        const data = await res.json() as { status?: string }
        if (data.status === 'completed' || data.status === 'failed') {
          // Job fertig: Artefakte direkt neu laden (direkter Trigger für loadAllArtifacts-Effect)
          setArtifactsRefreshTrigger((v) => v + 1)
          setPendingJobId(null)
          stopped = true
        }
      } catch {
        // Polling-Fehler ignorieren – nächster Versuch in 8s
      }
    }

    // Sofort + alle 8s pollen
    void poll()
    const interval = setInterval(() => { void poll() }, 8000)
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [pendingJobId, activeLibraryId, setArtifactsRefreshTrigger])

  // async function loadRagStatus() {
  //   try {
  //     setRagLoading(true);
  //     setRagError(null);
  //     const docMod = (() => {
  //       const d = item.metadata.modifiedAt as unknown as Date | string | number | undefined;
  //       const dt = d instanceof Date ? d : (d ? new Date(d) : undefined);
  //       return dt ? dt.toISOString() : undefined;
  //     })();
  //     const res = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/file-status?fileId=${encodeURIComponent(item.id)}${docMod ? `&docModifiedAt=${encodeURIComponent(docMod)}` : ''}`, { cache: 'no-store' });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Status konnte nicht geladen werden');
  //     // Library-Stats parallel
  //     const statsRes = await fetch(`/api/chat/${encodeURIComponent(activeLibraryId)}/stats`, { cache: 'no-store' });
  //     const stats = await statsRes.json().catch(() => ({}));
  //     setRagStatus({ ...data, totals: stats?.totals });
  //   } catch (e) {
  //     setRagError(e instanceof Error ? e.message : 'Unbekannter Fehler');
  //   } finally {
  //     setRagLoading(false);
  //   }
  // }

  if (error) {
    FileLogger.error('PreviewContent', 'Fehler in PreviewContent', {
      itemId: item.id,
      itemName: item.metadata.name,
      error
    });
    return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  }

  // Gemeinsames Props-Bundle fuer alle View-Komponenten unter
  // file-preview/views/* (Welle 3-II-a Phase 2a).
  // Pro View-Typ extrahiert aus PreviewContent-Closure; spaetere
  // Sub-Wellen reichen dasselbe Bundle in image-view, video-view etc.
  const viewProps: PreviewViewProps = {
    item,
    provider,
    activeLibraryId,
    activeLibrary,
    fileType,
    kind,
    infoTab,
    setInfoTab,
    shadowTwinState,
    storySteps,
    transcript,
    displayTranscriptItem,
    transcriptHeaderExtra,
    transformItem,
    transformError,
    transformHeaderExtra,
    hasActiveJob,
    currentJobInfo,
    isRunningPipeline,
    openPipelineForPhase,
    effectiveMdIdRef,
    isReviewMode,
    handleReviewModeToggle,
    isSplittingPages,
    setIsSplittingPages,
    onRefreshFolder,
    isPipelineOpen,
    setIsPipelineOpen,
    effectiveTargetLanguage,
    setTargetLanguage,
    sourceLanguage,
    setSourceLanguage,
    templateName,
    setTemplateName,
    templates,
    isLoadingTemplates,
    llmModel,
    setLlmModel,
    llmModels,
    isLoadingLlmModels,
    runPipeline,
    pipelineDefaultSteps,
    pipelineDefaultForce,
    savedCustomHint,
    // Markdown-/Website-View-spezifische Felder (Welle 3-II-a Phase 2d).
    content,
    currentFolderId,
    compositeWikiPreview,
    isEditOpen,
    setIsEditOpen,
    contentCache,
    onContentUpdated,
    setSelectedFile,
  }

  switch (fileType) {
    case 'audio':
      return <AudioView {...viewProps} />

    case 'image':
      return <ImageView {...viewProps} />

    case 'video':
      return <VideoView {...viewProps} />
    case 'markdown':
      return <MarkdownView {...viewProps} />

    case 'pdf':
      return <PdfView {...viewProps} />
    case 'docx':
    case 'xlsx':
    case 'pptx':
      return <OfficeView {...viewProps} />
    case 'presentation':
      return <PresentationView {...viewProps} />
    case 'website':
      return <WebsiteView {...viewProps} />
    default:
      return <DefaultView {...viewProps} />
  }

  // Pipeline-Sheet für alle Dateitypen verfügbar (wird nach dem Switch gerendert)
  // Da wir verschiedene Returns haben, müssen wir das PipelineSheet in jedem Case hinzufügen
  // oder eine Wrapper-Komponente verwenden. Für jetzt fügen wir es am Ende hinzu.
}

// Definiere einen Typ für den State
interface FilePreviewState {
  content: string;
  error: string | null;
  hasMetadata: boolean;
}

// Hauptkomponente
export function FilePreview({ 
  className,
  provider,
  file,
  onRefreshFolder,
  onClearCacheBeforeReview,
}: FilePreviewProps) {
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  const selectedFileFromAtom = useAtomValue(selectedFileAtom);
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom)
  const [, setShadowTwinAnalysisTrigger] = useAtom(shadowTwinAnalysisTriggerAtom)
  
  // Verwende explizite file prop oder fallback zum selectedFileAtom
  const displayFile = file || selectedFileFromAtom;
  const shadowTwinState = displayFile ? shadowTwinStates.get(displayFile.id) : undefined
  const storyStatus = useStoryStatus({
    libraryId: activeLibraryId,
    file: displayFile,
    shadowTwinState,
  })
  
  // Freshness-Check: Vollständiger Vergleich Source vs. MongoDB vs. Storage (via API)
  const freshness = useShadowTwinFreshnessApi(activeLibraryId, displayFile, shadowTwinState)

  // Ref-basierter Callback, um die Pipeline aus dem Banner heraus zu öffnen
  const pipelineOpenerRef = React.useRef<(() => void) | null>(null)
  const [isSyncing, setIsSyncing] = React.useState(false)

  // Stiller Auto-Sync: Bei storage-newer oder storage-missing automatisch synchronisieren
  // Kein Banner, kein Klick nötig – wird beim Öffnen des FilePreview ausgelöst
  const autoSyncRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const status = freshness.status
    const fileId = displayFile?.id
    // Nur einmal pro Datei + Status syncen (verhindert Endlosschleifen)
    const syncKey = `${fileId}-${status}`
    if (autoSyncRef.current === syncKey) return
    if (status !== 'storage-newer' && status !== 'storage-missing') return
    if (!activeLibraryId || !displayFile || isSyncing) return

    autoSyncRef.current = syncKey
    const direction = status === 'storage-newer' ? 'from-storage' : 'to-storage'
    const endpoint = direction === 'from-storage'
      ? `/api/library/${encodeURIComponent(activeLibraryId)}/shadow-twins/sync-from-storage`
      : `/api/library/${encodeURIComponent(activeLibraryId)}/shadow-twins/sync-to-storage`

    setIsSyncing(true)
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: displayFile.id, parentId: displayFile.parentId }),
    })
      .then(async (res) => {
        if (!res.ok) return
        const result = await res.json()
        const count = result[direction === 'from-storage' ? 'synced' : 'written'] || 0
        if (count > 0) {
          toast.info(
            direction === 'from-storage' ? 'Auto-Sync: Cache aktualisiert' : 'Auto-Sync: In Storage geschrieben',
            { description: `${count} Artefakt${count > 1 ? 'e' : ''} synchronisiert.`, duration: 3000 },
          )
        }
      })
      .catch(() => { /* Stiller Fehler – nicht kritisch */ })
      .finally(() => setIsSyncing(false))
  }, [freshness.status, activeLibraryId, displayFile, isSyncing])

  // Request-Update: Nur für source-newer / no-twin → Pipeline öffnen
  const handleRequestUpdate = React.useCallback(() => {
    if (pipelineOpenerRef.current) {
      pipelineOpenerRef.current()
    } else {
      toast.info("Pipeline nicht verfügbar", {
        description: "Bitte verwende den Verarbeitungs-Button in der Toolbar.",
      })
    }
  }, [])

  // Refs für Handler von JobReportTab (für Header-Buttons)
  // editHandlerRef wurde entfernt - wird derzeit nicht verwendet
  const effectiveMdIdRef = React.useRef<string | null>(null)
  
  // Debug-Log für FilePreview-Hauptkomponente
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      FileLogger.info('FilePreview', 'FilePreview-Hauptkomponente gerendert', {
        hasExplicitFile: !!file,
        hasSelectedFileFromAtom: !!selectedFileFromAtom,
        displayFileId: displayFile?.id,
        displayFileName: displayFile?.metadata.name,
        hasProvider: !!provider,
        providerName: provider?.name,
        activeLibraryId
      });
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [file, selectedFileFromAtom, displayFile, provider, activeLibraryId]);
  
  // Gemeinsamer Cache für den Inhalt von Dateien
  const contentCache = React.useRef<Map<string, { content: string; hasMetadata: boolean }>>(new Map());
  
  // Passe den Reducer an
  const reducer = React.useCallback((state: FilePreviewState, action: { type: string; content?: string; hasMetadata?: boolean; error?: string }) => {
    switch (action.type) {
      case 'SET_CONTENT':
        return { ...state, content: action.content ?? '', hasMetadata: action.hasMetadata ?? false };
      case 'SET_ERROR':
        return { ...state, error: action.error ?? null };
      case 'UPDATE_CONTENT':
        return { ...state, content: action.content ?? '' };
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = React.useReducer(reducer, {
    content: '',
    error: null,
    hasMetadata: false
  });

  // Memoize computed values
  const fileType = React.useMemo(() => 
    displayFile ? getFileType(displayFile.metadata.name) : 'unknown', 
    [displayFile]
  );
  
  // Entfernt: isAudioFile und isVideoFile, da sie nicht verwendet werden

  // Debug-Log für computed values
  React.useEffect(() => {
    if (displayFile) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Computed values aktualisiert', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          fileType,
          mimeType: displayFile.metadata.mimeType
        });
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile, fileType]);

  // Memoize content loader callback
  const handleContentLoaded = React.useCallback((content: string, hasMetadata: boolean) => {
    dispatch({ type: 'SET_CONTENT', content, hasMetadata });
  }, []);
  
  // Callback für direkte Aktualisierung des Inhalts
  const handleContentUpdated = React.useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', content });
  }, []);

  // Cache leeren, wenn sich die Item-ID ändert
  React.useEffect(() => {
    if (displayFile?.id) {
      const timeoutId = setTimeout(() => {
        FileLogger.debug('FilePreview', 'Neues Item geladen, Cache wird geprüft', {
          itemId: displayFile.id,
          itemName: displayFile.metadata.name,
          cacheSize: contentCache.current.size
        });
      }, 0);
      
      // Nur Cache-Einträge löschen, die nicht zur aktuellen Datei gehören
      const currentCache = contentCache.current.get(displayFile.id);
      if (!currentCache) {
        // Wenn die aktuelle Datei nicht im Cache ist, lösche alte Einträge
        Array.from(contentCache.current.keys()).forEach(key => {
          if (key !== displayFile.id) {
            contentCache.current.delete(key);
          }
        });
      }
      
      return () => clearTimeout(timeoutId);
    }
  }, [displayFile?.id, displayFile?.metadata.name]);

  if (!displayFile) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <p className="text-muted-foreground">Keine Datei ausgewählt</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">Vorschau</div>
          <div className="truncate text-sm font-medium">{displayFile.metadata.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShadowTwinAnalysisTrigger((v) => v + 1)}
                  aria-label="Shadow-Twin Status aktualisieren"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Status aktualisieren</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {provider ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  // Bei .url-Dateien: Die enthaltene Website-URL öffnen statt der Rohdatei
                  if (fileType === 'website' && state.content) {
                    const parsedUrl = state.content.match(/URL=(.*)/i)?.[1]?.trim()
                    if (parsedUrl) {
                      window.open(parsedUrl, "_blank", "noopener,noreferrer")
                      return
                    }
                  }
                  const url = await provider.getStreamingUrl(displayFile.id)
                  window.open(url, "_blank", "noopener,noreferrer")
                } catch (error) {
                  // Quelle-Button: Wenn der Streaming-URL-Resolve fehlschlaegt
                  // (z.B. virtuelle Mongo-ID, Provider-Auth abgelaufen), bleibt
                  // der Tab geschlossen — der Anwender bemerkt es. Wir loggen
                  // den Fehler aber, damit er nicht still verschwindet
                  // (.cursor/rules/no-silent-fallbacks.mdc).
                  FileLogger.warn('FilePreview', 'Quelle-Button: getStreamingUrl fehlgeschlagen', {
                    fileId: displayFile.id,
                    error: error instanceof Error ? error.message : String(error),
                  })
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Quelle
            </Button>
          ) : null}
        </div>
      </div>
      {/* Freshness-Banner: Warnung wenn Quelldatei und Shadow-Twin nicht synchron */}
      <ShadowTwinSyncBanner
        freshness={freshness}
        onRequestUpdate={handleRequestUpdate}
        isUpdating={isSyncing}
        fileId={displayFile?.id}
        parentId={displayFile?.parentId}
        libraryId={activeLibraryId || undefined}
        shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId}
        onReconstructed={() => {
          // Nach Rekonstruktion: Shadow-Twin-Analyse neu triggern
          setShadowTwinAnalysisTrigger((v) => v + 1)
        }}
      />
      <ContentLoader
        item={displayFile}
        provider={provider}
        fileType={fileType}
        contentCache={contentCache}
        onContentLoaded={handleContentLoaded}
      />
      <div className="flex-1 overflow-auto">
        <PreviewContent
          item={displayFile}
          fileType={fileType}
          content={state.content}
          error={state.error}
          activeLibraryId={activeLibraryId}
          provider={provider}
          contentCache={contentCache}
          pipelineOpenerRef={pipelineOpenerRef}
          onContentUpdated={handleContentUpdated}
          onRefreshFolder={onRefreshFolder}
          storySteps={storyStatus.steps}
          effectiveMdIdRef={effectiveMdIdRef}
          onClearCacheBeforeReview={onClearCacheBeforeReview}
        />
      </div>
    </div>
  );
}