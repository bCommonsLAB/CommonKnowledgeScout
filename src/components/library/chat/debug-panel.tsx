"use client"

import type { QueryLog, QueryRetrievalStep } from '@/types/query-log'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { DebugStepTable } from './debug-step-table'
import { DebugTrace } from './debug-trace'
import { computeKpis, hasFilterDiff } from '@/lib/chat/debug-stats'
import { useMemo } from 'react'

export function DebugPanel({ log }: { log: QueryLog }) {
  const kpis = useMemo(() => computeKpis(log), [log])
  const filterDiff = useMemo(() => hasFilterDiff(log), [log])
  function simplifyLabel(stage: string, level: string): string {
    if (stage === 'embed' && level === 'question') return 'Schritt 1: Frage einbetten'
    if (stage === 'query' && level === 'chunk') return 'Schritt 2a: Chunks suchen'
    if (stage === 'query' && level === 'summary') return 'Schritt 2b: Summaries laden'
    if (stage === 'list' && level === 'summary') return 'Summaries auflisten'
    if (stage === 'fetchNeighbors' && level === 'chunk') return 'Schritt 3: Nachbarn laden'
    if (stage === 'llm' && level === 'answer') return 'Schritt 4: Antwort erzeugen'
    return `${stage} [${level}]`
  }
  const steps = (log.retrieval || []).map((s, i) => ({ key: `step-${i}`, label: simplifyLabel(s.stage, s.level), step: s }))

  function explainStepLabelFromStep(step: QueryRetrievalStep): string {
    if (step.stage === 'embed' && step.level === 'question') return 'Wir übersetzen Ihre Frage in eine Zahlenform (Vektor). Damit kann das System später „Ähnlichkeit“ zu Textstellen messen.'
    if (step.stage === 'query' && step.level === 'chunk') return 'Suche nach den passendsten Textausschnitten (Chunks). Ergebnis ist eine sortierte Trefferliste mit Relevanzwerten.'
    if (step.stage === 'query' && step.level === 'summary') return 'Kapitel‑Zusammenfassungen werden geladen und als kompakter Kontext verwendet (kein Ranking nötig).'
    if (step.stage === 'list' && step.level === 'summary') return 'Listet alle Kapitel‑Summaries gemäß Filter (rein tabellarisch, ohne Ranking).'
    if (step.stage === 'fetchNeighbors' && step.level === 'chunk') return 'Zu den besten Chunks werden die direkten Nachbarstellen geholt. So entsteht mehr Zusammenhang und weniger aus dem Kontext gerissene Sätze.'
    if (step.stage === 'llm' && step.level === 'answer') return 'Aus den ausgewählten Stellen wird eine verständliche Antwort formuliert. Die verwendeten Quellen werden unten aufgeführt.'
    return ''
  }

  const renderStepContent = (step: QueryRetrievalStep, label: string) => (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1 mb-1">{label}</div>
      <div className="text-xs text-muted-foreground mb-2">{explainStepLabelFromStep(step)}</div>
      <div className="rounded border p-2 text-sm mb-2 flex items-center gap-2">
        {typeof step.timingMs === 'number' && <span className="px-2 py-0.5 rounded border">{step.timingMs}ms</span>}
        {typeof step.topKRequested === 'number' && <span className="px-2 py-0.5 rounded border text-xs">topK {step.topKRequested} → {(step.topKReturned || (step.results?.length || 0))}</span>}
        <span className="ml-auto text-xs text-muted-foreground">{step.startedAt ? new Date(step.startedAt).toLocaleTimeString('de-DE') : ''}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded border p-2">
          <div className="text-sm font-medium mb-2">Filters (normalized)</div>
          <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(step.filtersEffective?.normalized || {}, null, 2)}</pre>
        </div>
        <div className={"rounded border p-2 " + (filterDiff.diff ? 'ring-0' : '')}>
          <div className="text-sm font-medium mb-2">Filters (pinecone)</div>
          <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(step.filtersEffective?.pinecone || {}, null, 2)}</pre>
        </div>
      </div>
      <div className="mt-3">
        <DebugStepTable step={step} />
      </div>
      {step.stage === 'llm' && step.level === 'answer' && (
        <div className="mt-4 space-y-4">
          <section>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Verwendete Quellen ({(log.sources || []).length})</div>
            <div className="space-y-2">
              {(log.sources || []).map((s, i) => (
                <div key={`${s.id}-${i}`} className="rounded border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="font-mono break-all flex-1">{s.fileName || s.id}</div>
                    {typeof s.score === 'number' && <span className="px-2 py-0.5 rounded border text-xs">Score {s.score.toFixed(3)}</span>}
                    {typeof s.chunkIndex === 'number' && <span className="px-2 py-0.5 rounded border text-xs">Chunk {s.chunkIndex}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Prompt</div>
            <div className="rounded border p-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                <div className="rounded border p-2">Provider<br /><span className="font-medium">{log.prompt?.provider || '-'}</span></div>
                <div className="rounded border p-2">Model<br /><span className="font-medium">{log.prompt?.model || '-'}</span></div>
                <div className="rounded border p-2">Temperature<br /><span className="font-medium">{typeof log.prompt?.temperature === 'number' ? log.prompt?.temperature : '-'}</span></div>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-words mt-3">{typeof log.prompt?.prompt === 'string' ? log.prompt?.prompt : ''}</pre>
            </div>
          </section>
        </div>
      )}
    </div>
  )
  return (
    <div className="space-y-3">
      <header className="sticky top-0 bg-background z-10 border-b pb-2">
        <div className="text-sm font-medium">Debug Query</div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
          <span className="px-2 py-0.5 rounded border">{log.status}</span>
          <span className="px-2 py-0.5 rounded border">{new Date(log.createdAt).toLocaleString('de-DE')}</span>
          {typeof log.queryId === 'string' ? (
            <span className="px-2 py-0.5 rounded border font-mono" title={log.queryId}>{log.queryId.slice(0, 8)}…</span>
          ) : null}
          <span className="px-2 py-0.5 rounded border">{log.mode}</span>
          {typeof log.timing?.retrievalMs === 'number' && <span className="px-2 py-0.5 rounded border">retrieval {log.timing.retrievalMs}ms</span>}
          {typeof log.timing?.llmMs === 'number' && <span className="px-2 py-0.5 rounded border">llm {log.timing.llmMs}ms</span>}
        </div>
        <div className="mt-1 text-sm truncate" title={typeof log.question === 'string' ? log.question : ''}>{typeof log.question === 'string' ? log.question : ''}</div>
      </header>

      {/* Einheitliche Akkordeon-Ansicht (alle Viewports) */}
      <Accordion type="single" collapsible defaultValue="overview">
        <AccordionItem value="overview" defaultOpen>
          <AccordionTrigger className="rounded-md bg-muted/60 data-[state=open]:bg-muted px-2">Overview</AccordionTrigger>
          <AccordionContent>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1 mb-2">Übersicht</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="p-2 rounded border text-sm">Treffer gesamt: <span className="font-medium">{kpis.totalResults}</span></div>
              <div className="p-2 rounded border text-sm">Unique Files: <span className="font-medium">{kpis.uniqueFiles}</span></div>
              <div className="p-2 rounded border text-sm">genutzte Quellen: <span className="font-medium">{kpis.usedSources}</span></div>
              <div className="p-2 rounded border text-sm">Model: <span className="font-medium">{kpis.model || '-'}</span> ({typeof kpis.temperature === 'number' ? kpis.temperature : '-'})</div>
            </div>
            <div className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">Summen je Ebene</div>
            <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(kpis.perLevel).map(([lvl, s]) => (
                <div key={lvl} className="rounded border p-2 text-xs leading-tight">
                  <div className="font-medium mb-1">{lvl}</div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>steps {s.steps}</span>
                    <span>topK {s.requested} → {s.returned}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <DebugTrace log={log} />
            </div>
          </AccordionContent>
        </AccordionItem>
        {steps.map(({ key, step, label }) => (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="rounded-md bg-muted/60 data-[state=open]:bg-muted px-2">{label}</AccordionTrigger>
            <AccordionContent>{renderStepContent(step, label)}</AccordionContent>
          </AccordionItem>
        ))}
        <AccordionItem value="json">
          <AccordionTrigger className="rounded-md bg-muted/60 data-[state=open]:bg-muted px-2">JSON</AccordionTrigger>
          <AccordionContent>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1 mb-2">Raw JSON</div>
            <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(log, null, 2)}</pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}


