'use client';

import * as React from 'react';
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ExternalLink, FileText, RefreshCw, Sparkles, Upload } from "lucide-react";
import { MarkdownPreview, type CompositeWikiPreviewOptions } from './markdown-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import './markdown-audio';
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { activeLibraryIdAtom, selectedFileAtom, activeLibraryAtom } from "@/atoms/library-atom";
import { StorageItem, StorageProvider } from "@/lib/storage/types";
import type { Library } from '@/types/library'
import { extractFrontmatter } from './markdown-metadata';
import { ImagePreview } from './image-preview';
import { DocumentPreview } from './document-preview';
import { FileLogger } from "@/lib/debug/logger"
import { JobReportTab } from './job-report-tab';
// PdfPhasesView ist bewusst NICHT mehr Teil der File-Preview (zu heavy). Flow-View ist der Expertenmodus.
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner'
import { resolveArtifactClient } from '@/lib/shadow-twin/artifact-client';
import { SourceAndTranscriptPane } from "@/components/library/shared/source-and-transcript-pane"
import { useResolvedTranscriptItem } from "@/components/library/shared/use-resolved-transcript-item"
import { ArtifactInfoPanel } from "@/components/library/shared/artifact-info-panel"
import { useStoryStatus } from "@/components/library/shared/use-story-status"
import { shadowTwinAnalysisTriggerAtom } from "@/atoms/shadow-twin-atom"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { IngestionDataProvider } from "@/components/library/shared/ingestion-data-context"
import type { StoryStepStatus, StoryStepState } from "@/components/library/shared/story-status"
import { ArtifactMarkdownPanel } from "@/components/library/shared/artifact-markdown-panel"
import { ArtifactEditDialog } from "@/components/library/shared/artifact-edit-dialog"
import { IngestionDetailPanel } from "@/components/library/shared/ingestion-detail-panel"
import { PipelineSheet, type PipelinePolicies, type CoverImageOptions, type LlmModelOption } from "@/components/library/flow/pipeline-sheet"
import { runPipelineForFile, getMediaKind, type MediaKind } from "@/lib/pipeline/run-pipeline"
import { fetchShadowTwinMarkdown } from "@/lib/shadow-twin/shadow-twin-mongo-client"
import { isMongoShadowTwinId, parseMongoShadowTwinId } from "@/lib/shadow-twin/mongo-shadow-twin-id"
import { parseSecretaryMarkdownStrict } from "@/lib/secretary/response-parser"
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { useShadowTwinFreshnessApi } from "@/hooks/use-shadow-twin-freshness"
import { ShadowTwinSyncBanner } from "@/components/library/shared/shadow-twin-sync-banner"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { TARGET_LANGUAGE_DEFAULT } from "@/lib/chat/constants"
import { jobInfoByItemIdAtom } from "@/atoms/job-status"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Extrahiert den Sprachcode aus dem Dateinamen eines Transkripts.
 * Erwartet das Pattern: `name.LANG.md` (z.B. "Voice-test.en.md" → "en").
 * Gibt den Code in Großbuchstaben zurück oder null, wenn kein Muster erkannt wird.
 */
function extractTranscriptLang(filename: string): string | null {
  const match = filename.match(/\.([a-z]{2})\.md$/i)
  return match ? match[1].toLowerCase() : null
}

function getTransformationLabel(item: StorageItem): string {
  const id = item.id
  if (isMongoShadowTwinId(id)) {
    const parsed = parseMongoShadowTwinId(id)
    if (parsed) {
      const lang = parsed.targetLanguage?.toLowerCase()
      const langLabel = lang ? (TRANSCRIPT_LANG_LABELS[lang] ?? lang.toUpperCase()) : "?"
      const template = parsed.templateName || "template"
      return `${lang ? lang.toUpperCase() : "?"} – ${langLabel} · ${template}`
    }
  }
  const filename = item.metadata.name
  const match = filename.match(/\.([^.]+)\.([a-z]{2})\.md$/i)
  if (match) {
    const template = match[1]
    const lang = match[2].toLowerCase()
    const langLabel = TRANSCRIPT_LANG_LABELS[lang] ?? lang.toUpperCase()
    return `${lang.toUpperCase()} – ${langLabel} · ${template}`
  }
  return filename
}

// Sprachlabels für die Dropdown-Anzeige
const TRANSCRIPT_LANG_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  am: "አማርኛ",
  ar: "العربية",
  sw: "Kiswahili",
  om: "Oromoo",
}

// Explizite React-Komponenten-Deklarationen für den Linter
const ImagePreviewComponent = ImagePreview;
const DocumentPreviewComponent = DocumentPreview;

// Job-Progress-Anzeige fuer laufende Jobs
interface JobProgressBarProps {
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  phase?: string;
}

// Mapping von Phase-Codes zu lesbaren Labels
function getPhaseLabel(phase?: string): string {
  if (!phase) return '';
  const normalized = phase.toLowerCase();
  
  // Ignoriere generische Status-Phasen (kommen vom Secretary-Service)
  const ignoredPhases = ['running', 'initializing', 'postprocessing', 'completed', 'progress'];
  if (ignoredPhases.includes(normalized)) return '';
  
  const phaseLabels: Record<string, string> = {
    extract: 'Transkript',
    extract_pdf: 'Transkript',
    extract_office: 'Transkript',
    extraction: 'Transkript',
    transcribe: 'Transkript',
    transcription: 'Transkript',
    transform: 'Transformation',
    transform_template: 'Transformation',
    transformation: 'Transformation',
    template: 'Transformation',
    metadata: 'Transformation',
    ingest: 'Story',
    ingest_rag: 'Story',
    ingestion: 'Story',
    publish: 'Story',
  };
  return phaseLabels[normalized] || '';
}

function JobProgressBar({ status, progress, message, phase }: JobProgressBarProps) {
  const phaseLabel = getPhaseLabel(phase);
  
  // Status-Label mit optionaler Phase
  const getStatusLabel = (): string => {
    if (status === 'queued') return 'In Warteschlange...';
    if (status === 'completed') return 'Abgeschlossen';
    if (status === 'failed') return 'Fehlgeschlagen';
    // running
    if (phaseLabel) {
      return `${phaseLabel} wird verarbeitet...`;
    }
    return 'Wird verarbeitet...';
  };
  
  // Bereinigte Message (entferne technische Details, zeige nur relevante Info)
  const getCleanMessage = (): string | undefined => {
    if (!message) return undefined;
    // Technische Messages filtern
    if (message.startsWith('Mistral-OCR:')) {
      // Extrahiere den relevanten Teil nach dem Doppelpunkt
      const parts = message.split(' - Args:');
      return parts[0].replace('Mistral-OCR: ', '');
    }
    return message;
  };

  const progressValue = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;
  const cleanMessage = getCleanMessage();

  return (
    <div className="mx-3 mt-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{getStatusLabel()}</span>
        {status === 'running' && (
          <span className="text-xs text-muted-foreground">{progressValue}%</span>
        )}
      </div>
      <Progress value={status === 'running' ? progressValue : status === 'queued' ? 0 : 100} className="h-2" />
      {cleanMessage && (
        <p className="mt-2 text-xs text-muted-foreground truncate">{cleanMessage}</p>
      )}
    </div>
  );
}

interface FilePreviewProps {
  className?: string;
  provider: StorageProvider | null;
  file?: StorageItem | null; // Neue prop für explizite Datei-Auswahl
  onRefreshFolder?: (folderId: string, items: StorageItem[], selectFileAfterRefresh?: StorageItem) => void;
}

// Helper function for file type detection
function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  
  switch(extension) {
    case 'txt':
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'webm':
    case 'mkv':
      return 'video';
    case 'mp3':
    case 'm4a':
    case 'wav':
    case 'ogg':
    case 'opus':
    case 'flac':
      return 'audio';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
    case 'ico':
      return 'image';
    case 'pdf':
      return 'pdf';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'odt':
      return 'docx';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'url':
      return 'website';
    default:
      // Für unbekannte Dateitypen prüfen wir, ob es sich um eine Textdatei handeln könnte
      const textExtensions = ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf', 'log', 'csv', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'bat', 'cmd', 'odt'];
      if (textExtensions.includes(extension || '')) {
        return 'markdown'; // Behandle als editierbare Textdatei
      }
      return 'unknown';
  }
}

function getStoryStep(steps: StoryStepStatus[], id: StoryStepStatus["id"]): StoryStepStatus | null {
  return steps.find((step) => step.id === id) ?? null
}

function stepStateClass(state: StoryStepState | null): string {
  if (state === "present") return "text-green-600"
  if (state === "running") return "text-amber-600"
  if (state === "error") return "text-destructive"
  return "text-muted-foreground"
}

function ArtifactTabLabel({
  icon: Icon,
  label,
  state,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  state: StoryStepState | null
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className={cn("h-4 w-4", stepStateClass(state))} />
      <span>{label}</span>
    </span>
  )
}

// Komponente, die JobReportTab mit Shadow-Twin-Unterstützung umschließt
// Verwendet jetzt den zentralen resolveArtifactClient statt lokaler Heuristik
function JobReportTabWithShadowTwin({
  libraryId,
  fileId,
  fileName,
  parentId,
  provider,
  ingestionTabMode = "status",
  onEditClick,
  effectiveMdIdRef,
  resolvedMdFileId,
}: {
  libraryId: string;
  fileId: string;
  fileName: string;
  parentId: string;
  provider: StorageProvider | null;
  ingestionTabMode?: 'status' | 'preview';
  onEditClick?: () => void;
  effectiveMdIdRef?: React.MutableRefObject<string | null>;
  resolvedMdFileId?: string;
}) {
  const [mdFileId, setMdFileId] = React.useState<string | null>(null);
  const [baseFileId, setBaseFileId] = React.useState<string>(fileId);
  const [isLoading, setIsLoading] = React.useState(true);

  // Variante C: Vollständig über API - kein lokales Parsing mehr
  React.useEffect(() => {
    if (resolvedMdFileId) {
      setMdFileId(resolvedMdFileId);
      setBaseFileId(fileId);
      setIsLoading(false);
      return;
    }

    async function resolveArtifact() {
      setIsLoading(true);

      // Rufe zentrale Resolver-API auf
      // Priorität 1: Transformation (hat Frontmatter)
      let resolved = await resolveArtifactClient({
        libraryId,
        sourceId: fileId,
        sourceName: fileName,
        parentId,
        targetLanguage: 'de', // Standard-Sprache
        preferredKind: 'transformation',
      });

      // Priorität 2: Fallback zu Transcript wenn keine Transformation gefunden
      if (!resolved) {
        resolved = await resolveArtifactClient({
          libraryId,
          sourceId: fileId,
          sourceName: fileName,
          parentId,
          targetLanguage: 'de', // Standard-Sprache
          preferredKind: 'transcript',
        });
      }

      if (resolved) {
        setMdFileId(resolved.fileId);
        setBaseFileId(fileId); // Basis-Datei bleibt fileId
        FileLogger.debug('JobReportTabWithShadowTwin', 'Artefakt über Resolver gefunden', {
          originalFileId: fileId,
          resolvedFileId: resolved.fileId,
          resolvedFileName: resolved.fileName,
          kind: resolved.kind,
          location: resolved.location,
        });
      } else {
        // Kein Artefakt gefunden - verwende Basis-Datei direkt
        setMdFileId(null);
        setBaseFileId(fileId);
        FileLogger.debug('JobReportTabWithShadowTwin', 'Kein Shadow-Twin-Artefakt gefunden, verwende Basis-Datei', {
          fileId,
          fileName,
          parentId,
        });
      }

      setIsLoading(false);
    }

    if (libraryId && fileId && parentId) {
      resolveArtifact().catch((error) => {
        FileLogger.error('JobReportTabWithShadowTwin', 'Fehler bei Artefakt-Auflösung', {
          fileId,
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        setIsLoading(false);
        setMdFileId(null);
        setBaseFileId(fileId);
      });
    } else {
      setIsLoading(false);
    }
  }, [libraryId, fileId, fileName, parentId, resolvedMdFileId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Lade Metadaten...</p>
      </div>
    );
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
  );
}

// Separate Komponente für den Content Loader
function ContentLoader({ 
  item, 
  provider, 
  fileType, 
  contentCache,
  onContentLoaded 
}: {
  item: StorageItem | null;
  provider: StorageProvider | null;
  fileType: string;
  contentCache: React.MutableRefObject<Map<string, { content: string; hasMetadata: boolean }>>;
  onContentLoaded: (content: string, hasMetadata: boolean) => void;
}) {
  const loadingIdRef = React.useRef<string | null>(null);

  // Prüft ob eine Datei ein Template ist
  const isTemplateFile = React.useCallback((name?: string): boolean => {
    if (!name) return false;
    return name.includes('{{') && name.includes('}}');
  }, []);

  const loadContent = React.useCallback(async () => {
    if (!item?.id || !provider) {
      FileLogger.debug('ContentLoader', 'loadContent abgebrochen', {
        hasItem: !!item?.id,
        hasProvider: !!provider
      });
      return;
    }
    
    // Prüfe, ob es sich um einen Ordner handelt (root ist ein Ordner)
    if (item.type === 'folder' || item.id === 'root') {
      FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Ordner', {
        itemId: item.id,
        itemName: item.metadata.name,
        itemType: item.type
      });
      contentCache.current.set(item.id, { content: '', hasMetadata: false });
      onContentLoaded('', false);
      return;
    }
    
    FileLogger.info('ContentLoader', 'Lade Content für Datei', {
      itemId: item.id,
      itemName: item.metadata.name,
      cacheSize: contentCache.current.size
    });
    
    // Prüfen ob Inhalt bereits im Cache
    const cachedContent = contentCache.current.get(item.id);
    if (cachedContent) {
      FileLogger.info('ContentLoader', 'Content aus Cache geladen', {
        itemId: item.id,
        contentLength: cachedContent.content.length,
        hasMetadata: cachedContent.hasMetadata
      });
      onContentLoaded(cachedContent.content, cachedContent.hasMetadata);
      return;
    }

    // Prüfen ob bereits ein Ladevorgang läuft
    if (loadingIdRef.current === item.id) {
      FileLogger.debug('ContentLoader', 'Ladevorgang läuft bereits', {
        itemId: item.id
      });
      return;
    }
    
    loadingIdRef.current = item.id;
    
    try {
      // Wenn es eine Template-Datei ist, zeigen wir eine Warnung an
      if (isTemplateFile(item.metadata.name)) {
        const content = "---\nstatus: template\n---\n\n> **Hinweis**: Diese Datei enthält nicht aufgelöste Template-Variablen.\n> Bitte stellen Sie sicher, dass alle Variablen korrekt definiert sind.";
        contentCache.current.set(item.id, { content, hasMetadata: true });
        onContentLoaded(content, true);
        return;
      }

      // Liste der Dateitypen, die als Binärdateien behandelt werden sollen
      const binaryFileTypes = ['audio', 'image', 'video', 'pdf', 'docx', 'pptx', 'xlsx'];
      
      if (!binaryFileTypes.includes(fileType) && fileType !== 'unknown') {
        FileLogger.debug('ContentLoader', 'Lade Textinhalt von Provider', {
          itemId: item.id,
          fileType
        });
        const content = await provider.getBinary(item.id).then(({ blob }) => blob.text());
        const hasMetadata = !!extractFrontmatter(content);
        
        FileLogger.info('ContentLoader', 'Content geladen und in Cache gespeichert', {
          itemId: item.id,
          contentLength: content.length,
          hasMetadata
        });
        
        contentCache.current.set(item.id, { content, hasMetadata });
        onContentLoaded(content, hasMetadata);
      } else {
        FileLogger.debug('ContentLoader', 'Überspringe Content-Laden für Binary/Unknown-Datei', {
          itemId: item.id,
          fileType,
          isBinary: binaryFileTypes.includes(fileType),
          isUnknown: fileType === 'unknown'
        });
        contentCache.current.set(item.id, { content: '', hasMetadata: false });
        onContentLoaded('', false);
      }
    } catch (err) {
      FileLogger.error('ContentLoader', 'Failed to load file', err);
      // Bei Fehler zeigen wir eine Fehlermeldung im Markdown-Format
      const errorContent = "---\nstatus: error\n---\n\n> **Fehler**: Die Datei konnte nicht geladen werden.\n> Bitte überprüfen Sie die Konsole für weitere Details.";
      contentCache.current.set(item.id, { content: errorContent, hasMetadata: true });
      onContentLoaded(errorContent, true);
    } finally {
      loadingIdRef.current = null;
    }
  }, [item?.id, item?.type, item?.metadata?.name, provider, fileType, onContentLoaded, isTemplateFile, contentCache]);

  // Cleanup bei Unmount
  React.useEffect(() => {
    return () => {
      loadingIdRef.current = null;
    };
  }, []);

  // Nur laden wenn sich die ID ändert
  React.useEffect(() => {
    if (item?.id) {
      loadContent();
    }
  }, [item?.id, loadContent]);

  return null;
}

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
}) {
  const [infoTab, setInfoTab] = React.useState<"original" | "transcript" | "transform" | "story" | "overview">("original")
  const transcript = useResolvedTranscriptItem({
    provider,
    libraryId: activeLibraryId,
    sourceFile: ['pdf', 'audio', 'video', 'docx', 'xlsx', 'pptx'].includes(fileType) ? item : null,
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
  }, [
    activeLibraryId,
    item.id,
    item.metadata.name,
    item.parentId,
    transcript.transcriptItem,
    shadowTwinState?.transformed?.id,
    currentJobInfo?.status,
    currentJobInfo?.updatedAt,
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

  /** Sammeltranskript: Wikilink-Auflösung und optional Mongo-„Transkript prüfen“ im Viewer. */
  const compositeWikiPreview = React.useMemo((): CompositeWikiPreviewOptions | null => {
    if (!activeLibraryId || fileType !== 'markdown' || !content?.trim()) return null
    const { meta } = parseFrontmatter(content)
    if (meta?.kind !== 'composite-transcript') return null
    // ClientLibrary enthält dieselbe config.shadowTwin-Struktur wie Library; Typ nur für Server-Library strenger.
    const st = getShadowTwinConfig(activeLibrary as Library | null | undefined)
    const transcriptOnFs = st.primaryStore === 'filesystem' || st.persistToFilesystem
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
          libraryId: activeLibraryId,
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

  switch (fileType) {
    case 'audio': {
      FileLogger.debug('PreviewContent', 'Audio-Player wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          {/* Job-Progress-Anzeige wenn ein Job laeuft */}
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  libraryId={activeLibraryId}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="audio"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original transkribiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  headerExtra={transcriptHeaderExtra}
                  item={displayTranscriptItem}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    !transcript.transcriptItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transcript")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : transcript.transcriptItem && ['pdf', 'audio', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType) ? (
                      <>
                        {(fileType as string) === 'pdf' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSplittingPages || !provider}
                          onClick={async () => {
                            if (!activeLibraryId || !transcript.transcriptItem?.id) return
                            // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                            // Verarbeitet die Transcript-Datei und splittet sie in einzelne Seiten-Dateien in einem Unterverzeichnis.
                            setIsSplittingPages(true)
                            try {
                              const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sourceFileId: transcript.transcriptItem.id,
                                  originalFileId: item.id,
                                  targetLanguage: 'de',
                                }),
                              })
                              const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                              if (!res.ok) {
                                const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                                throw new Error(msg)
                              }
                              toast.success("Seiten gesplittet", {
                                description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                              })
                              // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                              // Verwende die parentId des Originals, nicht die der Transcript-Datei
                              if (onRefreshFolder && item.parentId) {
                                const refreshed = await provider?.listItemsById(item.parentId)
                                if (refreshed) onRefreshFolder(item.parentId, refreshed)
                              }
                            } catch (error) {
                              toast.error("Split fehlgeschlagen", {
                                description: error instanceof Error ? error.message : "Unbekannter Fehler"
                              })
                            } finally {
                              setIsSplittingPages(false)
                            }
                          }}
                        >
                          Seiten splitten
                        </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPipelineForPhase("transcript", true)}
                          disabled={isRunningPipeline || hasActiveJob}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Neu generieren
                        </Button>
                      </>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {transformHeaderExtra}
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                    </div>
                    {publishStep?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind={(["pdf", "audio", "video", "markdown"].includes(kind) ? kind : (["docx", "xlsx", "pptx"].includes(kind) ? "office" : "other")) as "pdf" | "audio" | "video" | "markdown" | "office" | "other"}
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: publishStep?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    case 'image':
      FileLogger.info('PreviewContent', 'ImagePreview wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name,
        mimeType: item.metadata.mimeType,
        hasProvider: !!provider,
        providerName: provider?.name
      });
      return (
        <ImagePreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
          showTransformControls={false}
        />
      );
    case 'video': {
      FileLogger.debug('PreviewContent', 'Video-Pipeline wird gerendert', {
        itemId: item.id,
        itemName: item.metadata.name
      });
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const videoDocModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const videoTextStep = getStoryStep(storySteps, "text")
      const videoTransformStep = getStoryStep(storySteps, "transform")
      const videoPublishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={videoDocModifiedAt}
          includeChapters={true}
        >
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={videoTextStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={videoTransformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={videoPublishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  libraryId={activeLibraryId}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="video"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original transkribiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  headerExtra={transcriptHeaderExtra}
                  item={displayTranscriptItem}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    !transcript.transcriptItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transcript")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : transcript.transcriptItem && ['pdf', 'audio', 'video', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transcript", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {transformHeaderExtra}
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                    </div>
                    {videoPublishStep?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind={(["pdf", "audio", "video", "markdown"].includes(kind) ? kind : (["docx", "xlsx", "pptx"].includes(kind) ? "office" : "other")) as "pdf" | "audio" | "video" | "markdown" | "office" | "other"}
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: videoPublishStep?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    case 'markdown': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          {/* Job-Progress-Anzeige wenn ein Job laeuft */}
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground font-normal">
                    Original (Markdown-Datei)
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsEditOpen(true)} disabled={!provider}>
                    Bearbeiten
                  </Button>
                </div>
                <div className="rounded border">
                  <MarkdownPreview 
                    content={content}
                    currentFolderId={currentFolderId}
                    provider={provider}
                    className="max-h-[70vh]"
                    compact
                    onRefreshFolder={onRefreshFolder}
                    compositeWikiPreview={compositeWikiPreview}
                    onTransform={() => {
                      // Transform-Button wurde geklickt - wechsle zum Transform-Tab
                      setInfoTab("transform")
                    }}
                  />
                </div>
                <ArtifactEditDialog
                  open={isEditOpen}
                  onOpenChange={setIsEditOpen}
                  item={item}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  onSaved={(saved) => {
                    if (!provider) return
                    const loadSavedContent = async () => {
                      const { blob } = await provider.getBinary(saved.id)
                      const text = await blob.text()
                      contentCache.current.delete(item.id)
                      contentCache.current.set(saved.id, { content: text, hasMetadata: !!extractFrontmatter(text) })
                      onContentUpdated(text)
                      setSelectedFile(saved)
                      if (onRefreshFolder) {
                        const updatedItems = await provider.listItemsById(saved.parentId)
                        onRefreshFolder(saved.parentId, updatedItems, saved)
                      }
                    }
                    loadSavedContent().catch((error) => {
                      FileLogger.error('FilePreview', 'Fehler beim Aktualisieren nach Edit', { error })
                    })
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                {/* Bei Mongo-Mode: Transkript aus MongoDB anzeigen (enthält Quellen-Referenzen + Korpus-Text).
                    Ohne MongoDB-Transkript: Original als Fallback anzeigen. */}
                {shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0 ? (
                  <ArtifactMarkdownPanel
                    title="Transkript (Quellen + Korpus-Text)"
                    titleClassName="text-xs text-muted-foreground font-normal"
                    headerExtra={transcriptHeaderExtra}
                    item={displayTranscriptItem ?? shadowTwinState.transcriptFiles[0]}
                    provider={provider}
                    libraryId={activeLibraryId || undefined}
                    emptyHint="Transkript konnte nicht geladen werden."
                    stripFrontmatter={true}
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      Kein separates Transkript vorhanden. Das Original wird als Fallback angezeigt.
                    </div>
                    <div className="border-t pt-3">
                      <ArtifactMarkdownPanel
                        title="Original-Inhalt"
                        titleClassName="text-xs text-muted-foreground font-normal"
                        item={item}
                        provider={provider}
                        libraryId={activeLibraryId || undefined}
                        emptyHint="Kein Inhalt verfügbar"
                        stripFrontmatter={false}
                        onSaved={(saved) => {
                          if (!provider) return
                          const loadSavedContent = async () => {
                            const { blob } = await provider.getBinary(saved.id)
                            const text = await blob.text()
                            contentCache.current.delete(item.id)
                            contentCache.current.set(saved.id, { content: text, hasMetadata: !!extractFrontmatter(text) })
                            onContentUpdated(text)
                            setSelectedFile(saved)
                            if (onRefreshFolder) {
                              const updatedItems = await provider.listItemsById(saved.parentId)
                              onRefreshFolder(saved.parentId, updatedItems, saved)
                            }
                          }
                          loadSavedContent().catch((error) => {
                            FileLogger.error('FilePreview', 'Fehler beim Aktualisieren nach Edit', { error })
                          })
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Original transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {transformHeaderExtra}
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                    </div>
                    {publishStep?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind={(["pdf", "audio", "video", "markdown"].includes(kind) ? kind : (["docx", "xlsx", "pptx"].includes(kind) ? "office" : "other")) as "pdf" | "audio" | "video" | "markdown" | "office" | "other"}
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: publishStep?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    case 'pdf': {
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAt = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStep = getStoryStep(storySteps, "text")
      const transformStep = getStoryStep(storySteps, "transform")
      const publishStep = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAt}
          includeChapters={true}
        >
          {/* Job-Progress-Anzeige wenn ein Job laeuft */}
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            {/* Tabs folgen dem Artefakt-Lebenszyklus (Original -> Transcript -> Transform -> Story -> Uebersicht). */}
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={publishStep?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  libraryId={activeLibraryId}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original transkribiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  headerExtra={transcriptHeaderExtra}
                  item={displayTranscriptItem}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    !transcript.transcriptItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transcript")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : transcript.transcriptItem && ['pdf', 'audio', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType) ? (
                      <>
                        {(fileType as string) === 'pdf' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSplittingPages || !provider}
                          onClick={async () => {
                            if (!activeLibraryId || !transcript.transcriptItem?.id) return
                            // Erklärung: Split läuft serverseitig, weil große PDFs im Browser zu schwer sind.
                            // Verarbeitet die Transcript-Datei und splittet sie in einzelne Seiten-Dateien in einem Unterverzeichnis.
                            setIsSplittingPages(true)
                            try {
                              const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sourceFileId: transcript.transcriptItem.id,
                                  originalFileId: item.id,
                                  targetLanguage: 'de',
                                }),
                              })
                              const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                              if (!res.ok) {
                                const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                                throw new Error(msg)
                              }
                              toast.success("Seiten gesplittet", {
                                description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                              })
                              // UI-Liste aktualisieren, damit der neue Ordner sichtbar wird.
                              // Verwende die parentId des Originals, nicht die der Transcript-Datei
                              if (onRefreshFolder && item.parentId) {
                                const refreshed = await provider?.listItemsById(item.parentId)
                                if (refreshed) onRefreshFolder(item.parentId, refreshed)
                              }
                            } catch (error) {
                              toast.error("Split fehlgeschlagen", {
                                description: error instanceof Error ? error.message : "Unbekannter Fehler"
                              })
                            } finally {
                              setIsSplittingPages(false)
                            }
                          }}
                        >
                          Seiten splitten
                        </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPipelineForPhase("transcript", true)}
                          disabled={isRunningPipeline || hasActiveJob}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Neu generieren
                        </Button>
                      </>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {transformHeaderExtra}
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt) · Diese Ansicht entspricht der Gallery-Detail Ansicht.
                    </div>
                    {publishStep?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind={(["pdf", "audio", "video", "markdown"].includes(kind) ? kind : (["docx", "xlsx", "pptx"].includes(kind) ? "office" : "other")) as "pdf" | "audio" | "video" | "markdown" | "office" | "other"}
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: publishStep?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    case 'docx':
    case 'xlsx':
    case 'pptx': {
      // Office-Dateien: volle Pipeline-UI wie PDF (Transkript, Transformation, Story)
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const docModifiedAtOffice = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStepOffice = getStoryStep(storySteps, "text")
      const transformStepOffice = getStoryStep(storySteps, "transform")
      const publishStepOffice = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAtOffice}
          includeChapters={true}
        >
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStepOffice?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStepOffice?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={publishStepOffice?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border">
                <SourceAndTranscriptPane
                  provider={provider}
                  libraryId={activeLibraryId}
                  sourceFile={item}
                  streamingUrl={null}
                  transcriptItem={transcript.transcriptItem}
                  leftPaneMode="pdf"
                />
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                <ArtifactMarkdownPanel
                  title="Transcript (aus dem Original extrahiert)"
                  titleClassName="text-xs text-muted-foreground font-normal"
                  item={transcript.transcriptItem}
                  provider={provider}
                  libraryId={activeLibraryId || undefined}
                  emptyHint="Noch kein Transkript vorhanden."
                  additionalActions={
                    !transcript.transcriptItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transcript")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : transcript.transcriptItem && ['pdf', 'audio', 'markdown', 'docx', 'xlsx', 'pptx'].includes(fileType) ? (
                      <>
                        {(fileType as string) === 'pdf' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSplittingPages || !provider}
                          onClick={async () => {
                            if (!activeLibraryId || !transcript.transcriptItem?.id) return
                            setIsSplittingPages(true)
                            try {
                              const res = await fetch(`/api/library/${encodeURIComponent(activeLibraryId)}/markdown/split-pages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  sourceFileId: transcript.transcriptItem.id,
                                  originalFileId: item.id,
                                  targetLanguage: 'de',
                                }),
                              })
                              const json = (await res.json().catch(() => ({}))) as { error?: unknown; folderName?: string; created?: number }
                              if (!res.ok) {
                                const msg = typeof json.error === 'string' ? json.error : `HTTP ${res.status}`
                                throw new Error(msg)
                              }
                              toast.success("Seiten gesplittet", {
                                description: `${json.created ?? 0} Seiten in Ordner "${json.folderName || 'pages'}" gespeichert.`
                              })
                              if (onRefreshFolder && item.parentId) {
                                const refreshed = await provider?.listItemsById(item.parentId)
                                if (refreshed) onRefreshFolder(item.parentId, refreshed)
                              }
                            } catch (error) {
                              toast.error("Split fehlgeschlagen", {
                                description: error instanceof Error ? error.message : "Unbekannter Fehler"
                              })
                            } finally {
                              setIsSplittingPages(false)
                            }
                          }}
                        >
                          Seiten splitten
                        </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPipelineForPhase("transcript", true)}
                          disabled={isRunningPipeline || hasActiveJob}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Neu generieren
                        </Button>
                      </>
                    ) : null
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {transformHeaderExtra}
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt)
                    </div>
                    {publishStepOffice?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind="office"
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: publishStepOffice?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    case 'presentation':
      return (
        <DocumentPreviewComponent
          provider={provider}
          activeLibraryId={activeLibraryId}
          onRefreshFolder={onRefreshFolder}
        />
      );
    case 'website': {
      // .url-Dateien: Volle Pipeline-UI wie andere Dateitypen
      if (!provider) {
        return <div className="text-sm text-muted-foreground">Kein Provider verfügbar.</div>;
      }
      const urlContent = content.match(/URL=(.*)/i)?.[1]?.trim();
      const docModifiedAtWeb = shadowTwinState?.transformed?.metadata.modifiedAt
        ? new Date(shadowTwinState.transformed.metadata.modifiedAt).toISOString()
        : undefined
      const textStepWeb = getStoryStep(storySteps, "text")
      const transformStepWeb = getStoryStep(storySteps, "transform")
      const publishStepWeb = getStoryStep(storySteps, "publish")

      return (
        <IngestionDataProvider
          libraryId={activeLibraryId}
          fileId={item.id}
          docModifiedAt={docModifiedAtWeb}
          includeChapters={true}
        >
          {hasActiveJob && currentJobInfo && (
            <JobProgressBar 
              status={currentJobInfo.status} 
              progress={currentJobInfo.progress} 
              message={currentJobInfo.message}
              phase={currentJobInfo.phase}
            />
          )}
          <Tabs value={infoTab} onValueChange={(v) => setInfoTab(v as typeof infoTab)} className="flex h-full flex-col">
            <TabsList className="mx-3 mt-3 w-fit">
              <TabsTrigger value="original">Original</TabsTrigger>
              <TabsTrigger value="transcript">
                <ArtifactTabLabel label="Transkript" icon={FileText} state={textStepWeb?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArtifactTabLabel label="Transformation" icon={Sparkles} state={transformStepWeb?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="story">
                <ArtifactTabLabel label="Story" icon={Upload} state={publishStepWeb?.state || null} />
              </TabsTrigger>
              <TabsTrigger value="overview">Übersicht</TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border flex flex-col">
                {urlContent ? (
                  <>
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
                      <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <a href={urlContent} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate text-sm">
                        {urlContent}
                      </a>
                    </div>
                    <div className="relative flex-1 min-h-0">
                      <iframe 
                        src={urlContent}
                        title={item.metadata.name}
                        className="w-full h-full absolute inset-0"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      />
                      <div className="absolute inset-0 flex items-center justify-center -z-10 text-muted-foreground text-sm">
                        <p>Website blockiert möglicherweise die Einbettung.</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                    Keine gültige URL gefunden.
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="min-h-0 flex-1 overflow-hidden p-3">
              <div className="h-full overflow-hidden rounded border p-3">
                {shadowTwinState?.transcriptFiles && shadowTwinState.transcriptFiles.length > 0 ? (
                  <ArtifactMarkdownPanel
                    title="Transkript (Website-Inhalt)"
                    titleClassName="text-xs text-muted-foreground font-normal"
                    headerExtra={transcriptHeaderExtra}
                    item={displayTranscriptItem ?? shadowTwinState.transcriptFiles[0]}
                    provider={provider}
                    libraryId={activeLibraryId || undefined}
                    emptyHint="Transkript konnte nicht geladen werden."
                    stripFrontmatter={true}
                  />
                ) : (
                  <ArtifactMarkdownPanel
                    title="Transkript"
                    titleClassName="text-xs text-muted-foreground font-normal"
                    item={transcript.transcriptItem}
                    provider={provider}
                    libraryId={activeLibraryId || undefined}
                    emptyHint="Noch kein Transkript vorhanden."
                    additionalActions={
                      !transcript.transcriptItem ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openPipelineForPhase("transcript")}
                          disabled={isRunningPipeline || hasActiveJob}
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Jetzt erstellen
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPipelineForPhase("transcript", true)}
                          disabled={isRunningPipeline || hasActiveJob}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Neu generieren
                        </Button>
                      )
                    }
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="transform" className="min-h-0 flex-1 overflow-auto p-3">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Story-Inhalte und Metadaten (aus dem Transkript transformiert)
                  </div>
                  <div className="flex items-center gap-2">
                    {!transformItem ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("transform")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("transform", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                </div>
                {transformError ? (
                  <Alert variant="destructive">
                    <AlertDescription>{transformError}</AlertDescription>
                  </Alert>
                ) : !transformItem ? (
                  <div className="rounded border p-3 text-sm text-muted-foreground">
                    Keine Transformationsdaten vorhanden. Bitte stellen Sie sicher, dass die Datei verarbeitet wurde.
                  </div>
                ) : (
                  <div className="rounded border">
                    <JobReportTabWithShadowTwin 
                      libraryId={activeLibraryId} 
                      fileId={item.id} 
                      fileName={item.metadata.name}
                      parentId={item.parentId}
                      provider={provider}
                      resolvedMdFileId={transformItem?.id ?? undefined}
                      ingestionTabMode="preview"
                      effectiveMdIdRef={effectiveMdIdRef}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="story" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "story" ? (
                <div className="h-full overflow-auto rounded border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      veröffentlichte Story (aus den Artefakten der Transformation erstellt)
                    </div>
                    {publishStepWeb?.state === "missing" ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => openPipelineForPhase("story")}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Jetzt erstellen
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openPipelineForPhase("story", true)}
                        disabled={isRunningPipeline || hasActiveJob}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Erneut publizieren
                      </Button>
                    )}
                  </div>
                  <IngestionDetailPanel libraryId={activeLibraryId} fileId={item.id} />
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto p-3">
              {infoTab === "overview" ? (
                <div className="rounded border">
                  <ArtifactInfoPanel
                    libraryId={activeLibraryId}
                    sourceFile={item}
                    shadowTwinFolderId={shadowTwinState?.shadowTwinFolderId || null}
                    transcriptFiles={shadowTwinState?.transcriptFiles}
                    transformed={shadowTwinState?.transformed}
                    targetLanguage="de"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind="other"
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: !!transcript.transcriptItem,
              hasTransformed: !!shadowTwinState?.transformed,
              hasIngested: publishStepWeb?.state !== "missing",
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </IngestionDataProvider>
      )
    }
    default:
      return (
        <>
          <div className="text-center text-muted-foreground">
            Keine Vorschau verfügbar für diesen Dateityp.
          </div>
          <PipelineSheet
            isOpen={isPipelineOpen}
            onOpenChange={setIsPipelineOpen}
            libraryId={activeLibraryId}
            sourceFileName={item.metadata.name}
            kind={(["pdf", "audio", "video", "markdown"].includes(kind) ? kind : (["docx", "xlsx", "pptx"].includes(kind) ? "office" : "other")) as "pdf" | "audio" | "video" | "markdown" | "office" | "other"}
            targetLanguage={effectiveTargetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            sourceLanguage={sourceLanguage}
            onSourceLanguageChange={setSourceLanguage}
            templateName={templateName}
            onTemplateNameChange={setTemplateName}
            templates={templates}
            isLoadingTemplates={isLoadingTemplates}
            llmModel={llmModel}
            onLlmModelChange={setLlmModel}
            llmModels={llmModels}
            isLoadingLlmModels={isLoadingLlmModels}
            onStart={runPipeline}
            defaultSteps={pipelineDefaultSteps}
            defaultForce={pipelineDefaultForce}
            existingArtifacts={{
              hasTranscript: false,
              hasTransformed: false,
              hasIngested: false,
            }}
            defaultGenerateCoverImage={activeLibrary?.config?.secretaryService?.generateCoverImage}
            defaultCustomHint={savedCustomHint}
          />
        </>
      );
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
  onRefreshFolder
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
                } catch {}
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
        />
      </div>
    </div>
  );
}