"use client";

import { useEffect, useState } from 'react'
import { UILogger } from '@/lib/debug/logger'
import type { StorageProvider } from '@/lib/storage/types'

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

export function JobReportTab({ libraryId, fileId, fileName, provider, sourceMode = 'merged', viewMode = 'full', mdFileId, onJumpTo }: JobReportTabProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobDto | null>(null)
  const [templateFields, setTemplateFields] = useState<string[] | null>(null)
  const [frontmatterMeta, setFrontmatterMeta] = useState<Record<string, unknown> | null>(null)
  const [section, setSection] = useState<'meta' | 'chapters'>('meta')

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
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
  }, [libraryId, fileId])

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

  // Frontmatter aus der gespeicherten Markdown-Datei lesen (Fallback, falls cumulativeMeta unvollständig ist)
  useEffect(() => {
    async function loadFrontmatter() {
      try {
        if (!provider) return
        const mdId = (mdFileId || (job?.result?.savedItemId as string | undefined) || fileId)
        UILogger.info('JobReportTab', 'Frontmatter: Lade Datei', { mdId, sourceMode })
        if (!mdId) return
        const bin = await provider.getBinary(mdId)
        const text = await bin.blob.text()
        const m = text.match(/^---[\s\S]*?---/)
        UILogger.debug('JobReportTab', 'Frontmatter: Block gefunden?', { found: !!m, length: m ? m[0].length : 0 })
        if (!m) { setFrontmatterMeta(null); return }
        const fm = m[0]
        const meta: Record<string, unknown> = {}
        // Einfache Parser-Heuristiken für häufige Felder (JSON-ähnliche Werte werden geparst)
        const tryParse = (val: string): unknown => {
          const trimmed = val.trim()
          if (!trimmed) return ''
          if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
          if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
          if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try { return JSON.parse(trimmed) } catch { return trimmed }
          }
          return trimmed.replace(/^"|"$/g, '')
        }
        // Versuche kompakte Arrays (z. B. authors: ["..."])
        for (const line of fm.split('\n')) {
          const t = line.trim()
          if (!t || t === '---') continue
          const idx = t.indexOf(':')
          if (idx > 0) {
            const k = t.slice(0, idx).trim()
            const v = t.slice(idx + 1)
            meta[k] = tryParse(v)
          }
        }
        // Spezialfälle: mehrzeilige JSON-Blöcke für chapters/toc extrahieren
        const cap = /\nchapters:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (cap && cap[1]) {
          try { meta['chapters'] = JSON.parse(cap[1]) } catch { /* ignore */ }
        }
        const tocCap = /\ntoc:\s*(\[[\s\S]*?\])\s*\n/m.exec(fm)
        if (tocCap && tocCap[1]) {
          try { meta['toc'] = JSON.parse(tocCap[1]) } catch { /* ignore */ }
        }
        UILogger.info('JobReportTab', 'Frontmatter: Keys & Counts', {
          keys: Object.keys(meta),
          chapters: Array.isArray(meta['chapters']) ? (meta['chapters'] as unknown[]).length : 0,
          toc: Array.isArray(meta['toc']) ? (meta['toc'] as unknown[]).length : 0,
        })
        setFrontmatterMeta(Object.keys(meta).length ? meta : null)
      } catch {
        setFrontmatterMeta(null)
      }
    }
    void loadFrontmatter()
  }, [provider, fileId, mdFileId, job?.result?.savedItemId, sourceMode])

  if (sourceMode !== 'frontmatter') {
    if (loading) return <div className="p-4 text-sm text-muted-foreground">Lade Job…</div>
    if (error) return <div className="p-4 text-sm text-destructive">{error}</div>
    if (!job) return <div className="p-4 text-sm text-muted-foreground">Kein Job zur Datei gefunden.</div>
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      {viewMode === 'metaOnly' && (
        <div className="inline-flex rounded border overflow-hidden">
          <button
            type="button"
            onClick={() => setSection('meta')}
            className={`px-3 py-1 text-xs ${section === 'meta' ? 'bg-primary text-primary-foreground' : 'bg-background'} border-r`}
            aria-pressed={section === 'meta'}
          >
            Metadaten
          </button>
          <button
            type="button"
            onClick={() => setSection('chapters')}
            className={`px-3 py-1 text-xs ${section === 'chapters' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            aria-pressed={section === 'chapters'}
          >
            Kapitel
          </button>
        </div>
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

      {/* Metadaten (flach) – je nach sourceMode: nur Frontmatter oder Merge */}
      {section === 'meta' && (() => {
        const base: Record<string, unknown> = sourceMode === 'frontmatter'
          ? {}
          : ((job?.cumulativeMeta as unknown as Record<string, unknown>) || {})
        const cm = frontmatterMeta ? { ...base, ...frontmatterMeta } : base
        const baseKeys = Array.isArray(templateFields) && templateFields.length > 0
          ? templateFields
          : Object.keys(cm)
        const flatKeys = baseKeys.filter(k => k !== 'chapters' && k !== 'toc')
        if (flatKeys.length === 0) return null
        return (
        <div>
          <div className="font-medium mb-1">Metadaten (Template vs. Ergebnis)</div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2">Feld</th>
                  <th className="py-1 pr-2">Wert</th>
                </tr>
              </thead>
              <tbody>
                {flatKeys.map((k) => {
                  const val = cm[k]
                  let valueStr = ''
                  if (Array.isArray(val)) valueStr = (val as Array<unknown>).map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ')
                  else valueStr = val === null || val === undefined ? '' : typeof val === 'string' ? val : JSON.stringify(val)
                  return (
                    <tr key={k} className="border-t border-muted/40">
                      <td className="py-1 pr-2 align-top font-medium">{k}</td>
                      <td className="py-1 pr-2 align-top whitespace-pre-wrap break-words">{valueStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Kapitel (hierarchisch, TOC-Ansicht mit Einrückung & Aufklappen) */}
      {section === 'chapters' && (() => {
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
              const endPage = typeof c.endPage === 'number' ? c.endPage : ''
              const pageCount = typeof c.pageCount === 'number' ? c.pageCount : ''
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
                          <span className="text-[10px] px-1 rounded bg-muted">L{lvl}</span>
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


