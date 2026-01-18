"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { toast } from "sonner"
import { useAtomValue } from "jotai"

import type { StorageItem } from "@/lib/storage/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileLogger } from "@/lib/debug/logger"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowLeft, ExternalLink, FileText, PanelLeftClose, ScrollText, Settings, Sparkles } from "lucide-react"
import type { ShadowTwinTransformationEntry } from "@/components/library/flow/use-shadow-twin-artifacts"
import { PipelineSheet, type PipelinePolicies } from "@/components/library/flow/pipeline-sheet"
import { loadPdfDefaults } from "@/lib/pdf-defaults"
import { getEffectivePdfDefaults } from "@/atoms/pdf-defaults"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { TARGET_LANGUAGE_DEFAULT, type TargetLanguage } from "@/lib/chat/constants"

type MediaKind = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

const PdfPhaseSettings = React.lazy(() =>
  import("@/components/library/pdf-phase-settings").then(m => ({ default: m.PdfPhaseSettings }))
)

function getMediaKind(file: StorageItem): MediaKind {
  const name = (file.metadata?.name || "").toLowerCase()
  const mime = (file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

interface FlowActionsProps {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  streamingUrl: string | null
  backHref: string
  transformations: ShadowTwinTransformationEntry[]
  shadowTwinFolderId: string | null
  shouldPromptPipeline: boolean
}

interface JobUpdateWire {
  type: "job_update"
  jobId: string
  status?: string
  progress?: number
  message?: string
  updatedAt?: string
  jobType?: string
  libraryId?: string
  result?: { savedItemId?: string }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

async function enqueuePdfJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
  libraryConfigChatTargetLanguage?: TargetLanguage
  libraryConfigPdfTemplate?: string
}): Promise<string> {
  // Lade PDF-Defaults für diese Library (inkl. globaler Default mistral_ocr)
  const defaults = getEffectivePdfDefaults(
    args.libraryId,
    loadPdfDefaults(args.libraryId),
    {},
    args.libraryConfigChatTargetLanguage,
    args.libraryConfigPdfTemplate
  )
  const extractionMethod = typeof defaults.extractionMethod === 'string' ? defaults.extractionMethod : 'mistral_ocr'
  const isMistralOcr = extractionMethod === 'mistral_ocr'
  
  const fd = new FormData()
  fd.append("originalItemId", args.sourceFile.id)
  fd.append("parentId", args.parentId)
  fd.append("fileName", args.sourceFile.metadata.name)
  fd.append("mimeType", args.sourceFile.metadata.mimeType || "application/pdf")
  fd.append("targetLanguage", args.targetLanguage)
  fd.append("extractionMethod", extractionMethod)
  // Bei Mistral OCR: includePageImages immer true (erzwungen)
  if (isMistralOcr) {
    const includePageImages = defaults.includePageImages !== undefined ? defaults.includePageImages : true
    const includeOcrImages = defaults.includeOcrImages !== undefined ? defaults.includeOcrImages : true
    if (includePageImages) fd.append("includePageImages", "true")
    if (includeOcrImages) fd.append("includeOcrImages", "true")
  }
  fd.append("useCache", String(defaults.useCache ?? true))
  if (isNonEmptyString(args.templateName)) fd.append("template", args.templateName)
  fd.append("policies", JSON.stringify(args.policies))

  const res = await fetch("/api/secretary/process-pdf", {
    method: "POST",
    headers: { "X-Library-Id": args.libraryId },
    body: fd,
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueMediaJob(args: {
  endpoint: "/api/secretary/process-audio/job" | "/api/secretary/process-video/job"
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch(args.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      sourceLanguage: "auto",
      useCache: true,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

async function enqueueTextJob(args: {
  libraryId: string
  sourceFile: StorageItem
  parentId: string
  targetLanguage: string
  templateName?: string
  policies: { extract: string; metadata: string; ingest: string }
}): Promise<string> {
  const res = await fetch("/api/secretary/process-text/job", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Library-Id": args.libraryId,
    },
    body: JSON.stringify({
      originalItemId: args.sourceFile.id,
      parentId: args.parentId,
      fileName: args.sourceFile.metadata.name,
      mimeType: args.sourceFile.metadata.mimeType,
      targetLanguage: args.targetLanguage,
      ...(isNonEmptyString(args.templateName) ? { template: args.templateName } : {}),
      policies: args.policies,
    }),
  })
  const json = (await res.json().catch(() => ({} as Record<string, unknown>))) as {
    error?: unknown
    job?: { id?: unknown }
  }
  if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`)
  const jobId = typeof json.job?.id === "string" ? json.job.id : ""
  if (!jobId) throw new Error("Job-ID fehlt in Response")
  return jobId
}

export function FlowActions({
  libraryId,
  sourceFile,
  parentId,
  streamingUrl,
  backHref,
  transformations,
  shadowTwinFolderId,
  shouldPromptPipeline,
}: FlowActionsProps) {
  const router = useRouter()
  const [targetLanguage, setTargetLanguage] = useQueryState("targetLanguage", parseAsString.withDefault(""))
  const [templateName, setTemplateName] = useQueryState("templateName", parseAsString.withDefault(""))
  // mobile-first default: hide left/source pane unless user explicitly enables it
  const [leftPaneMode, setLeftPaneMode] = useQueryState("left", parseAsString.withDefault("off"))
  const [activeTransformationId, setActiveTransformationId] = useQueryState("transformationId", parseAsString.withDefault(""))
  // `pipeline` Query Param:
  // - ''  => nicht gesetzt (Initialzustand; Auto-Open darf einmal greifen)
  // - '1' => offen
  // - '0' => vom User explizit geschlossen (Auto-Open darf NICHT erneut öffnen)
  const [pipelineParam, setPipelineParam] = useQueryState("pipeline", parseAsString.withDefault(""))

  const [templates, setTemplates] = React.useState<string[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = React.useState(false)

  const [isRunning, setIsRunning] = React.useState(false)
  const [activeJob, setActiveJob] = React.useState<{ jobId: string; status?: string; progress?: number; message?: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)

  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryConfigChatTargetLanguage = activeLibrary?.config?.chat?.targetLanguage
  const libraryConfigPdfTemplate = activeLibrary?.config?.secretaryService?.pdfDefaults?.template

  const kind = getMediaKind(sourceFile)
  const transformationSelectValue = activeTransformationId || "__latest__"
  const isPdf = kind === "pdf"
  const isPipelineOpen = pipelineParam === "1"
  const defaults = getEffectivePdfDefaults(
    libraryId,
    loadPdfDefaults(libraryId),
    {},
    libraryConfigChatTargetLanguage,
    libraryConfigPdfTemplate
  )
  const effectiveTargetLanguage = typeof defaults.targetLanguage === "string"
    ? defaults.targetLanguage
    : TARGET_LANGUAGE_DEFAULT
  const effectiveTemplateName = typeof defaults.template === "string" ? defaults.template : ""

  const openPipeline = React.useCallback(() => {
    void setPipelineParam("1")
  }, [setPipelineParam])

  const closePipeline = React.useCallback(() => {
    void setPipelineParam("0")
  }, [setPipelineParam])
  const openSourceInNewTab = React.useCallback(() => {
    if (!streamingUrl) return
    window.open(streamingUrl, "_blank", "noopener,noreferrer")
  }, [streamingUrl])

  const goBack = React.useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  React.useEffect(() => {
    if (!shouldPromptPipeline) return
    // Auto-open NUR, wenn der Param noch nicht gesetzt ist.
    // Wenn der User einmal schließt (`pipeline=0`), respektieren wir das.
    if (pipelineParam !== "") return
    void setPipelineParam("1")
  }, [shouldPromptPipeline, pipelineParam, setPipelineParam])

  // Falls URL-Parameter fehlen, setze sie aus Defaults (inkl. Library-Config)
  React.useEffect(() => {
    if (!targetLanguage && effectiveTargetLanguage) {
      void setTargetLanguage(effectiveTargetLanguage)
    }
    if (!templateName && effectiveTemplateName) {
      void setTemplateName(effectiveTemplateName)
    }
  }, [targetLanguage, templateName, effectiveTargetLanguage, effectiveTemplateName, setTargetLanguage, setTemplateName])

  React.useEffect(() => {
    let cancelled = false
    async function loadTemplates() {
      if (!libraryId) return
      if (!isPipelineOpen) return
      setIsLoadingTemplates(true)
      try {
        const { listAvailableTemplates } = await import("@/lib/templates/template-service-client")
        const names = await listAvailableTemplates(libraryId)
        if (cancelled) return
        setTemplates(Array.isArray(names) ? names : [])
        // If current templateName is invalid, clear it (avoid resolver/transform confusion).
        if (isNonEmptyString(templateName) && !names.includes(templateName)) {
          void setTemplateName("")
        }
      } catch (err) {
        FileLogger.warn("flow-actions", "Templates konnten nicht geladen werden", {
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
  }, [libraryId, templateName, setTemplateName, isPipelineOpen])

  // Subscribe to SSE and update active job state (thin UI only; engine stays server-side).
  React.useEffect(() => {
    if (!activeJob?.jobId) return
    let cancelled = false
    const es = new EventSource("/api/external/jobs/stream")

    es.addEventListener("job_update", (e: MessageEvent) => {
      try {
        const evt = JSON.parse(e.data) as JobUpdateWire
        if (cancelled) return
        if (!evt || evt.type !== "job_update") return
        if (evt.jobId !== activeJob.jobId) return
        setActiveJob(prev => {
          if (!prev) return prev
          return {
            jobId: prev.jobId,
            status: typeof evt.status === "string" ? evt.status : prev.status,
            progress: typeof evt.progress === "number" ? evt.progress : prev.progress,
            message: typeof evt.message === "string" ? evt.message : prev.message,
          }
        })
      } catch {
        // ignore
      }
    })

    es.addEventListener("error", () => {
      // Non-fatal: die Seite bleibt nutzbar; Shadow‑Twin Artefakte sind die Wahrheit.
    })

    return () => {
      cancelled = true
      try {
        es.close()
      } catch {}
    }
  }, [activeJob?.jobId])

  const runPipeline = React.useCallback(
    async (args: { templateName?: string; targetLanguage: string; policies: PipelinePolicies }) => {
      if (!libraryId) {
        toast.error("Fehler", { description: "libraryId fehlt" })
        return
      }
      if (sourceFile.type !== "file") {
        toast.error("Fehler", { description: "Quelle ist keine Datei" })
        return
      }
      if (!parentId) {
        toast.error("Fehler", { description: "parentId fehlt" })
        return
      }

      setIsRunning(true)
      try {
        let jobId = ""
        if (kind === "pdf") {
          jobId = await enqueuePdfJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
            libraryConfigChatTargetLanguage,
            libraryConfigPdfTemplate,
          })
        } else if (kind === "audio") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-audio/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "video") {
          jobId = await enqueueMediaJob({
            endpoint: "/api/secretary/process-video/job",
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: args.policies,
          })
        } else if (kind === "markdown") {
          // Bei Markdown: extract immer "ignore" erzwingen (Textquelle bereits vorhanden)
          const markdownPolicies = {
            ...args.policies,
            extract: "ignore" as const,
          }
          jobId = await enqueueTextJob({
            libraryId,
            sourceFile,
            parentId,
            targetLanguage: args.targetLanguage,
            templateName: args.templateName,
            policies: markdownPolicies,
          })
        } else {
          toast.error("Nicht unterstützt", {
            description: `Flow Actions sind aktuell nur für PDF/Audio/Video/Markdown vorgesehen (Dateityp: ${kind}).`,
          })
          return
        }

        setActiveJob({ jobId, status: "queued", progress: 0, message: "queued" })
        toast.success("Job angelegt", { description: `Job ${jobId} wurde enqueued.` })

        // WICHTIG:
        // Jobs werden von `ExternalJobsWorker` gestartet. Wenn wir hier zusätzlich `/start` callen,
        // kommt es zu doppelten Worker-Requests und damit zu 2 Secretary-Jobs + callback_token mismatch (401).
        // Deshalb: nur enqueue. Der Worker startet den Job automatisch (Polling-Intervall i.d.R. <2s).
        toast.success("Job in Warteschlange", { description: "Worker startet den Job automatisch. Ergebnisse erscheinen im Shadow‑Twin." })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        FileLogger.error("flow-actions", "Action fehlgeschlagen", { msg })
        toast.error("Fehler", { description: msg })
      } finally {
        setIsRunning(false)
      }
    },
    [libraryId, sourceFile, parentId, kind, libraryConfigChatTargetLanguage, libraryConfigPdfTemplate]
  )

  return (
    <div className="border-b px-3 py-2">
      <TooltipProvider>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
          {/* Back first (Experten-Toolbar) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Zurück"
                onClick={goBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zurück</TooltipContent>
          </Tooltip>

          {/* Left pane controls (mobile-first: default hidden, user can enable) */}
          {isPdf ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "transcript" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Transcript"
                    aria-pressed={leftPaneMode === "transcript"}
                    onClick={() => void setLeftPaneMode("transcript")}
                  >
                    <ScrollText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Transcript</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="PDF-Standardwerte"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">PDF-Standardwerte</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "pdf" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel: Quelle"
                    aria-pressed={leftPaneMode === "pdf"}
                    onClick={() => void setLeftPaneMode("pdf")}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links: Quelle</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={leftPaneMode === "off" ? "secondary" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Linkes Panel ausblenden"
                    aria-pressed={leftPaneMode === "off"}
                    onClick={() => void setLeftPaneMode("off")}
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Links ausblenden</TooltipContent>
              </Tooltip>
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label="Quelle im neuen Tab öffnen"
                onClick={openSourceInNewTab}
                disabled={!streamingUrl}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Quelle im neuen Tab</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-6 w-px bg-border" />

          <div className="flex-1" />

          {/* Aktuelle Transformationsdatei (Shadow‑Twin Truth) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Transformieren</span>
                <Select
                  value={transformationSelectValue}
                  onValueChange={(v) => void setActiveTransformationId(v === "__latest__" ? "" : v)}
                  disabled={transformations.length === 0}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">neueste</SelectItem>
                    {transformations.map((t) => {
                      const label = `${t.templateName}${t.targetLanguage ? ` · ${t.targetLanguage}` : ""}`
                      return (
                        <SelectItem key={t.item.id} value={t.item.id}>
                          {label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {shadowTwinFolderId ? "Shadow‑Twin vorhanden" : "Kein Shadow‑Twin Ordner gefunden"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8"
                onClick={openPipeline}
                disabled={isRunning}
              >
                <Sparkles className="h-4 w-4" />
                Transformieren
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Story Creator öffnen</TooltipContent>
          </Tooltip>

          {activeJob ? (
            <div className="text-xs text-muted-foreground">
              <span className="font-mono">{activeJob.jobId}</span>
              {activeJob.status ? ` · ${activeJob.status}` : ""}
              {typeof activeJob.progress === "number" ? ` · ${Math.round(activeJob.progress)}%` : ""}
              {activeJob.message ? ` · ${activeJob.message}` : ""}
            </div>
          ) : null}
        </div>
      </TooltipProvider>

      {settingsOpen && (
        <React.Suspense>
          <PdfPhaseSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </React.Suspense>
      )}

      <PipelineSheet
        isOpen={isPipelineOpen}
        onOpenChange={(open) => (open ? void setPipelineParam("1") : closePipeline())}
        libraryId={libraryId}
        sourceFileName={sourceFile.metadata.name}
        kind={kind === "pdf" || kind === "audio" || kind === "video" || kind === "markdown" ? kind : "other"}
        targetLanguage={targetLanguage}
        onTargetLanguageChange={(v) => void setTargetLanguage(v)}
        templateName={templateName}
        onTemplateNameChange={(v) => void setTemplateName(v)}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        onStart={runPipeline}
      />
    </div>
  )
}


