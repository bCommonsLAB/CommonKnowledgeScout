"use client"

import type { QueryLog, QueryRetrievalStep } from '@/types/query-log'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { DebugStepTable } from './debug-step-table'
import { DebugTrace } from './debug-trace'
import { computeKpis, hasFilterDiff } from '@/lib/chat/debug-stats'
import { useMemo } from 'react'
import { RETRIEVER_LABELS } from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'

export function DebugPanel({ log }: { log: QueryLog }) {
  const { t } = useTranslation()
  const kpis = useMemo(() => computeKpis(log), [log])
  const filterDiff = useMemo(() => hasFilterDiff(log), [log])
  function simplifyLabel(stage: string, level: string): string {
    if (stage === 'embed' && level === 'question') return 'Step 1: Embed question'
    if (stage === 'query' && level === 'chunk') return 'Step 2a: Search chunks'
    if (stage === 'query' && level === 'summary') return 'Step 2b: Load summaries'
    if (stage === 'list' && level === 'summary') return 'List summaries'
    if (stage === 'list' && level === 'chunkSummary') return 'List documents (for all chunks)'
    if (stage === 'query' && level === 'chunkSummary') return 'Load all chunks (without embedding search)'
    if (stage === 'fetchNeighbors' && level === 'chunk') return 'Step 3: Load neighbors'
    if (stage === 'llm' && level === 'answer') return 'Step 4: Generate answer'
    return `${stage} [${level}]`
  }
  // Hilfsfunktion für Retriever-Label
  function getRetrieverLabel(retriever?: string): string {
    if (!retriever) return '-'
    return RETRIEVER_LABELS[retriever as keyof typeof RETRIEVER_LABELS] || retriever
  }

  // Hilfsfunktion für Antwortlänge-Label
  function getAnswerLengthLabel(answerLength?: string): string {
    if (!answerLength) return '-'
    try {
      return t(`chat.answerLengthLabels.${answerLength}` as 'chat.answerLengthLabels.kurz' | 'chat.answerLengthLabels.mittel' | 'chat.answerLengthLabels.ausführlich' | 'chat.answerLengthLabels.unbegrenzt') || answerLength
    } catch {
      return answerLength
    }
  }

  // Prüft ob Empfehlung mit verwendetem Retriever übereinstimmt
  function recommendationMatches(retriever?: string, recommendation?: string): boolean {
    if (!retriever || !recommendation) return false
    if (recommendation === 'unclear') return false
    if (recommendation === 'chunk' && retriever === 'chunk') return true
    if (recommendation === 'summary' && (retriever === 'summary' || retriever === 'doc')) return true
    return false
  }

  const steps = (log.retrieval || []).map((s, i) => ({ key: `step-${i}`, label: simplifyLabel(s.stage, s.level), step: s }))

  function explainStepLabelFromStep(step: QueryRetrievalStep): string {
    if (step.stage === 'embed' && step.level === 'question') return 'Your question is translated into a numerical form (vector). This allows the system to measure "similarity" to text passages later.'
    if (step.stage === 'query' && step.level === 'chunk') return 'Search for the most relevant text passages (chunks). Result is a sorted hit list with relevance scores.'
    if (step.stage === 'query' && step.level === 'summary') return 'Chapter summaries are loaded and used as compact context (no ranking needed).'
    if (step.stage === 'list' && step.level === 'summary') return 'Lists all chapter summaries according to filters (purely tabular, without ranking).'
    if (step.stage === 'list' && step.level === 'chunkSummary') return 'Lists all documents and loads all their chunks without embedding search.'
    if (step.stage === 'query' && step.level === 'chunkSummary') return 'Loads all chunks of filtered documents without semantic search (metadata filter only).'
    if (step.stage === 'fetchNeighbors' && step.level === 'chunk') return 'For the best chunks, the direct neighboring passages are fetched. This creates more context and fewer sentences taken out of context.'
    if (step.stage === 'llm' && step.level === 'answer') return 'A comprehensible answer is formulated from the selected passages. The sources used are listed below.'
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
          {log.retriever && (
            <span className="px-2 py-0.5 rounded border bg-blue-50 dark:bg-blue-950" title="Retriever-Methode">
              {getRetrieverLabel(log.retriever)}
            </span>
          )}
          {log.questionAnalysis && (
            <span className={`px-2 py-0.5 rounded border ${
              log.questionAnalysis.confidence === 'high' 
                ? 'bg-green-50 dark:bg-green-950' 
                : log.questionAnalysis.confidence === 'medium'
                ? 'bg-yellow-50 dark:bg-yellow-950'
                : 'bg-orange-50 dark:bg-orange-950'
            }`} title="Automatische Analyse">
              Analyse: {log.questionAnalysis.recommendation === 'chunk' ? 'Chunk' : log.questionAnalysis.recommendation === 'summary' ? 'Summary' : 'Unklar'} ({log.questionAnalysis.confidence})
            </span>
          )}
          {log.answerLength && (
            <span className="px-2 py-0.5 rounded border bg-green-50 dark:bg-green-950" title="Antwortlänge">
              {getAnswerLengthLabel(log.answerLength)}
            </span>
          )}
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
            
            {/* Retriever-Analyse Sektion */}
            {log.questionAnalysis && (
              <div className="mt-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Retriever-Auswahl (automatisch)</div>
                <div className="rounded-lg border-2 p-3 bg-muted/30">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      log.questionAnalysis.recommendation === 'chunk' 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' 
                        : log.questionAnalysis.recommendation === 'summary'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                    }`}>
                      {log.questionAnalysis.recommendation === 'chunk' ? 'C' : log.questionAnalysis.recommendation === 'summary' ? 'S' : '?'}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <div className="text-sm font-medium">
                          Empfehlung: {log.questionAnalysis.recommendation === 'chunk' ? 'Chunk-Modus' : log.questionAnalysis.recommendation === 'summary' ? 'Summary-Modus' : 'Unklar'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Konfidenz: {log.questionAnalysis.confidence === 'high' ? '🔴 Hoch' : log.questionAnalysis.confidence === 'medium' ? '🟡 Mittel' : '🟢 Niedrig'}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground bg-background/50 rounded p-2 border">
                        <div className="font-medium mb-1">Begründung:</div>
                        <div className="whitespace-pre-wrap">{log.questionAnalysis.reasoning}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Verwendet:</span> {getRetrieverLabel(log.retriever)}
                        {log.questionAnalysis && !recommendationMatches(log.retriever, log.questionAnalysis.recommendation) && (
                          <span className="ml-2 text-yellow-600 dark:text-yellow-400">⚠️ Abweichung von Empfehlung</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Query-Parameter Sektion */}
            <div className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">Query-Parameter</div>
            <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="p-2 rounded border text-sm">
                <div className="text-xs text-muted-foreground mb-1">Retriever-Methode</div>
                <div className="font-medium">{getRetrieverLabel(log.retriever)}</div>
              </div>
              <div className="p-2 rounded border text-sm">
                <div className="text-xs text-muted-foreground mb-1">Antwortlänge</div>
                <div className="font-medium">{getAnswerLengthLabel(log.answerLength)}</div>
              </div>
              <div className="p-2 rounded border text-sm">
                <div className="text-xs text-muted-foreground mb-1">Mode</div>
                <div className="font-medium">{log.mode}</div>
              </div>
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
        {log.questionAnalysis && (
          <AccordionItem value="analysis">
            <AccordionTrigger className="rounded-md bg-muted/60 data-[state=open]:bg-muted px-2">
              Retriever-Analyse
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <div className="rounded-lg border-2 p-4 bg-muted/30">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      log.questionAnalysis.recommendation === 'chunk' 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200' 
                        : log.questionAnalysis.recommendation === 'summary'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                        : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                    }`}>
                      {log.questionAnalysis.recommendation === 'chunk' ? 'C' : log.questionAnalysis.recommendation === 'summary' ? 'S' : '?'}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="text-base font-semibold mb-1">
                          Empfehlung: {log.questionAnalysis.recommendation === 'chunk' ? 'Chunk-Modus' : log.questionAnalysis.recommendation === 'summary' ? 'Summary-Modus' : 'Unklar'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Konfidenz: <span className="font-medium">{log.questionAnalysis.confidence === 'high' ? '🔴 Hoch' : log.questionAnalysis.confidence === 'medium' ? '🟡 Mittel' : '🟢 Niedrig'}</span>
                        </div>
                      </div>
                      <div className="bg-background rounded-lg p-3 border">
                        <div className="text-sm font-semibold mb-2">Begründung:</div>
                        <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                          {log.questionAnalysis.reasoning}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Empfohlen:</span>{' '}
                          <span className="font-medium">{log.questionAnalysis.recommendation === 'chunk' ? 'Chunk-Modus' : log.questionAnalysis.recommendation === 'summary' ? 'Summary-Modus' : 'Unklar'}</span>
                        </div>
                        <div className="text-muted-foreground">→</div>
                        <div>
                          <span className="text-muted-foreground">Verwendet:</span>{' '}
                          <span className="font-medium">{getRetrieverLabel(log.retriever)}</span>
                        </div>
                        {log.questionAnalysis && !recommendationMatches(log.retriever, log.questionAnalysis.recommendation) && (
                          <span className="ml-auto px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-medium">
                            ⚠️ Abweichung
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 border">
                  <div className="font-medium mb-1">Wie funktioniert die Analyse?</div>
                  <div className="space-y-1">
                    <div>• <strong>Chunk-Modus</strong>: Für spezifische Fragen nach Details, Formeln, Code-Beispielen</div>
                    <div>• <strong>Summary-Modus</strong>: Für breite Fragen über Themen, Konzepte oder mehrere Dokumente</div>
                    <div>• <strong>Unklar</strong>: Frage zu vage → System schlägt präzisierte Fragen vor</div>
                  </div>
                </div>
                
                <div className="rounded-lg border p-3 bg-background">
                  <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Ablauf</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-[10px]">1</div>
                      <div>Frage wird analysiert</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center font-bold text-[10px]">2</div>
                      <div>Empfehlung: <strong>{log.questionAnalysis.recommendation === 'chunk' ? 'Chunk' : log.questionAnalysis.recommendation === 'summary' ? 'Summary' : 'Unklar'}</strong> (Konfidenz: {log.questionAnalysis.confidence})</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center font-bold text-[10px]">3</div>
                      <div>Retriever wird gestartet: <strong>{getRetrieverLabel(log.retriever)}</strong></div>
                    </div>
                    {log.questionAnalysis && recommendationMatches(log.retriever, log.questionAnalysis.recommendation) ? (
                      <div className="ml-8 text-xs text-green-600 dark:text-green-400">✓ Empfehlung wurde befolgt</div>
                    ) : log.questionAnalysis && log.questionAnalysis.recommendation !== 'unclear' ? (
                      <div className="ml-8 text-xs text-yellow-600 dark:text-yellow-400">⚠ Abweichung: Expliziter Parameter überschreibt Analyse</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
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


