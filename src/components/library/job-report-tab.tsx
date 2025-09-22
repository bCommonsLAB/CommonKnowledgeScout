"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'
import { MarkdownPreview } from '@/components/library/markdown-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId, onJumpTo, rawContent, forcedTab }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [section, setSection] = useState<'meta' | 'chapters'>('meta')
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fullContent, setFullContent] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'markdown' | 'meta' | 'chapters' | 'process'>(forcedTab || 'markdown')

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab)
  }, [forcedTab])

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
        if (!templateName || !provider) return
        const rootItems = await provider.listItemsById('root')
        const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'))
        if (!templatesFolder) return
        const tplItems = await provider.listItemsById(templatesFolder.id)
        const match = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === templateName.toLowerCase()))
        if (!match) return
        const bin = await provider.getBinary(match.id)
        const text = await bin.blob.text()
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
  }, [job, provider])

  // Gemeinsamer strikter Parser
  const strictParseFrontmatter = (fm: string) => parseSecretaryMarkdownStrict(fm)

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (oder aus rawContent)
  const effectiveMdId = (() => {
    // Bevorzugt explizite mdFileId; sonst Ergebnis des Jobs; fallback auf fileId
    return (mdFileId && typeof mdFileId === 'string' && mdFileId.length > 0)
      ? mdFileId
      : ((job?.result?.savedItemId as string | undefined) || fileId)
  })()

  useEffect(() => {
    async function loadFrontmatter() {
      try {
        setParseErrors([])
        // Wenn roher Inhalt übergeben wurde, direkt daraus lesen
        if (sourceMode === 'frontmatter' && typeof rawContent === 'string' && rawContent.length > 0) {
          const text = rawContent
          setFullContent(text)
          const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
          UILogger.debug('JobReportTab', 'Frontmatter (raw): Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
          if (!frontmatter) { setFrontmatterMeta(null); return }
          setFrontmatterMeta(Object.keys(meta).length ? meta : null)
          setParseErrors(errors)
          return
        }

        if (!provider) return
        const mdId = effectiveMdId
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        setFullContent(text)
        const { frontmatter, meta, errors } = parseSecretaryMarkdownStrict(text)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!frontmatter, length: frontmatter ? frontmatter.length : 0 })
        if (!frontmatter) { setFrontmatterMeta(null); return }
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
        setParseErrors(errors)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, effectiveMdId, sourceMode, rawContent])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'metaOnly' && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid grid-cols-4 w-full gap-1">
            <TabsTrigger value="markdown" className="px-2 py-1 text-xs">Markdown</TabsTrigger>
            <TabsTrigger value="meta" className="px-2 py-1 text-xs">Metadaten</TabsTrigger>
            <TabsTrigger value="chapters" className="px-2 py-1 text-xs">Kapitel</TabsTrigger>
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter' ? {} : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              const processFields = new Set([
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ])
              const hasProcess = Object.keys(cm).some(k => processFields.has(k))
              return hasProcess ? <TabsTrigger value="process" className="px-2 py-1 text-xs">Prozessinfo</TabsTrigger> : null
            })()}
          </TabsList>

          <TabsContent value="markdown" className="mt-3">
            <div className="border rounded-md">
              <MarkdownPreview content={stripFrontmatter(fullContent || '')} />
            </div>
          </TabsContent>

          <TabsContent value="meta" className="mt-3">
            {/* Hinweise zu Parserfehlern (strikt) */}
            {parseErrors.length > 0 && (
              <div className="text-xs text-destructive mb-2">
                {parseErrors.map((e, i) => (<div key={i}>Parserfehler: {e}</div>))}
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

          <TabsContent value="process" className="mt-3">
            {(() => {
              const base: Record<string, unknown> = sourceMode === 'frontmatter'
                ? {}
                : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
              const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
              const processOrder = [
                'job_id','extract_status','template_status','ingest_status','summary_language',
                'source_file','source_file_id','source_file_size','source_file_type',
                'filename','path','pathHints','isScan'
              ]
              const keys = processOrder.filter(k => k in cm)
              if (keys.length === 0) return <div className="text-xs text-muted-foreground">Keine Prozessinformationen vorhanden.</div>
              return (
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-2 sticky left-0 bg-background z-10">Feld</th>
                        <th className="py-1 pr-2">Wert</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map(k => {
                        const val = cm[k]
                        const valueStr = val === null || val === undefined ? '' : Array.isArray(val) ? (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ') : typeof val === 'string' ? val : JSON.stringify(val)
                        return (
                          <tr key={k} className="border-t border-muted/40">
                            <td className="py-1 pr-2 align-top font-medium sticky left-0 bg-background z-10 whitespace-nowrap">{k}</td>
                            <td className="py-1 pr-2 align-top">
                              {valueStr ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-block max-w-[40vw] overflow-hidden text-ellipsis whitespace-nowrap align-top" title="">{valueStr}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="max-w-[80vw] whitespace-pre-wrap break-words">{valueStr}</div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : ''}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()}
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
                      const ev = typeof c.startEvidence === 'string' ? c.startEvidence : ''
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
              // Geplante Phasen ermitteln (neue Flags bevorzugt, sonst phases)
              const p = (job.parameters || {}) as Record<string, unknown>
              const hasNewFlags = typeof p['doExtractPDF'] === 'boolean' || typeof p['doExtractMetadata'] === 'boolean' || typeof p['doIngestRAG'] === 'boolean'
              const phases = hasNewFlags
                ? {
                    extract: p['doExtractPDF'] === true,
                    template: p['doExtractMetadata'] === true,
                    ingest: p['doIngestRAG'] === true,
                  }
                : ((p['phases'] as { extract?: boolean; template?: boolean; ingest?: boolean }) || {})

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
    </div>
  )
}


