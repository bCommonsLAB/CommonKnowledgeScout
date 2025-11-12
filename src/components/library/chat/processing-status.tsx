'use client'

import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { useTranslation } from '@/lib/i18n/hooks'

interface ProcessingStatusProps {
  steps: ChatProcessingStep[]
  isActive: boolean
}

interface StepDisplay {
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
  details?: string
  icon?: React.ReactNode
}

export function ProcessingStatus({ steps }: ProcessingStatusProps) {
  const { t } = useTranslation()
  
  // Wenn keine Steps vorhanden sind, nichts anzeigen
  if (steps.length === 0) {
    return null
  }

  // Konvertiere Steps zu Display-Format
  const displaySteps: StepDisplay[] = []

  // Cache-Check (muss zuerst angezeigt werden)
  const cacheCheckStep = steps.find(s => s.type === 'cache_check')
  const cacheCheckComplete = steps.find(s => s.type === 'cache_check_complete')
  if (cacheCheckStep) {
    const params = cacheCheckStep.parameters
    const paramParts: string[] = []
    if (params.targetLanguage) paramParts.push(`${t('configDisplay.language')} ${params.targetLanguage}`)
    if (params.character) paramParts.push(`${t('configDisplay.character')} ${params.character}`)
    if (params.socialContext) paramParts.push(`${t('configDisplay.context')} ${params.socialContext}`)
    if (params.filters && Object.keys(params.filters).length > 0) {
      const filterCount = Object.values(params.filters).reduce((sum: number, val: unknown) => {
        if (Array.isArray(val)) return sum + val.length
        return sum + 1
      }, 0)
      if (filterCount > 0) paramParts.push(`${filterCount} ${filterCount === 1 ? t('gallery.filter') : t('gallery.filters')}`)
    }
    
    const details = paramParts.length > 0 ? paramParts.join(' · ') : undefined
    const found = cacheCheckComplete?.found || false
    
    displaySteps.push({
      label: t('processing.checkCache'),
      status: cacheCheckComplete ? (found ? 'complete' : 'complete') : 'active',
      details: cacheCheckComplete 
        ? (found 
          ? t('processing.cacheFound', { queryId: cacheCheckComplete.queryId?.substring(0, 8) || '' })
          : t('processing.cacheNotFound'))
        : details,
      icon: cacheCheckComplete 
        ? (found 
          ? <CheckCircle2 className="h-3 w-3 text-green-600" />
          : <XCircle className="h-3 w-3 text-orange-600" />)
        : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // Frage-Analyse
  const analysisStep = steps.find(s => s.type === 'question_analysis_start')
  const analysisResult = steps.find(s => s.type === 'question_analysis_result')
  if (analysisStep) {
    const recommendationLabel = analysisResult?.recommendation === 'chunk' 
      ? t('processing.recommendationChunk')
      : analysisResult?.recommendation === 'summary'
      ? t('processing.recommendationSummary')
      : t('processing.recommendationUnclear')
    
    displaySteps.push({
      label: t('processing.analyzeQuestion'),
      status: analysisResult ? 'complete' : 'active',
      details: analysisResult 
        ? t('processing.recommendation', { recommendation: recommendationLabel, confidence: analysisResult.confidence })
        : undefined,
      icon: analysisResult ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // Retriever-Auswahl
  const retrieverStep = steps.find(s => s.type === 'retriever_selected')
  if (retrieverStep) {
    const retrieverLabel = retrieverStep.retriever === 'chunk' 
      ? t('processing.retrieverChunk')
      : t('processing.retrieverSummary')
    
    displaySteps.push({
      label: t('processing.selectRetriever'),
      status: 'complete',
      details: `${retrieverLabel}${retrieverStep.reason ? ` - ${retrieverStep.reason}` : ''}`,
      icon: <CheckCircle2 className="h-3 w-3 text-green-600" />,
    })
  }

  // Retriever-Start
  const retrievalStart = steps.find(s => s.type === 'retrieval_start')
  const retrievalProgress = steps.find(s => s.type === 'retrieval_progress')
  const retrievalComplete = steps.find(s => s.type === 'retrieval_complete')
  if (retrievalStart || retrievalProgress || retrievalComplete) {
    const details = retrievalComplete 
      ? (() => {
          const count = retrievalComplete.sourcesCount
          const fileCount = retrievalComplete.uniqueFileIdsCount
          const timingMs = retrievalComplete.timingMs
          
          // Wenn fileCount verfügbar ist, zeige erweiterte Information
          if (fileCount !== undefined && fileCount > 0) {
            // Verwende manuelle Pluralisierung für bessere Kompatibilität
            const documentLabel = fileCount === 1 
              ? t('processing.documentSingular')
              : t('processing.documentPlural')
            
            return count === 1
              ? t('processing.chunkFoundWithFiles', { count, fileCount, documentLabel, timingMs })
              : t('processing.chunksFoundWithFiles', { count, fileCount, documentLabel, timingMs })
          }
          
          // Fallback: Standard-Format ohne fileCount
          return count === 1
            ? t('processing.chunkFound', { count, timingMs })
            : t('processing.chunksFound', { count, timingMs })
        })()
      : retrievalProgress?.message || t('processing.searchingRelevant')
    
    displaySteps.push({
      label: t('processing.retrieveChunks'),
      status: retrievalComplete ? 'complete' : (retrievalStart || retrievalProgress ? 'active' : 'pending'),
      details,
      icon: retrievalComplete 
        ? <CheckCircle2 className="h-3 w-3 text-green-600" />
        : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // Prompt bauen
  const promptBuilding = steps.find(s => s.type === 'prompt_building')
  const promptComplete = steps.find(s => s.type === 'prompt_complete')
  if (promptBuilding || promptComplete) {
    const details = promptComplete 
      ? (promptComplete.documentsUsed === 1
          ? t('processing.chunkUsed', { count: promptComplete.documentsUsed, tokenCount: promptComplete.tokenCount.toLocaleString('de-DE') })
          : t('processing.chunksUsed', { count: promptComplete.documentsUsed, tokenCount: promptComplete.tokenCount.toLocaleString('de-DE') }))
      : promptBuilding?.message || undefined
    displaySteps.push({
      label: t('processing.buildPrompt'),
      status: promptComplete ? 'complete' : (promptBuilding ? 'active' : 'pending'),
      details,
      icon: promptComplete 
        ? <CheckCircle2 className="h-3 w-3 text-green-600" />
        : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // LLM-Aufruf
  const llmStart = steps.find(s => s.type === 'llm_start')
  const llmProgress = steps.find(s => s.type === 'llm_progress')
  const llmComplete = steps.find(s => s.type === 'llm_complete')
  if (llmStart || llmProgress || llmComplete) {
    const details = llmComplete 
      ? (() => {
          const parts: string[] = [t('processing.completeWithTiming', { timingMs: llmComplete.timingMs })]
          if (llmComplete.promptTokens !== undefined || llmComplete.completionTokens !== undefined) {
            const tokens: string[] = []
            if (llmComplete.promptTokens !== undefined) {
              tokens.push(t('processing.inputTokens', { count: llmComplete.promptTokens.toLocaleString('de-DE') }))
            }
            if (llmComplete.completionTokens !== undefined) {
              tokens.push(t('processing.outputTokens', { count: llmComplete.completionTokens.toLocaleString('de-DE') }))
            }
            if (tokens.length > 0) {
              parts.push(`${tokens.join(', ')} ${t('processing.tokens')}`)
            }
          }
          return parts.join(' - ')
        })()
      : llmProgress?.message || llmStart ? t('processing.model', { model: llmStart?.model || '...' }) : undefined
    displaySteps.push({
      label: t('processing.generateAnswer'),
      status: llmComplete ? 'complete' : (llmStart || llmProgress ? 'active' : 'pending'),
      details,
      icon: llmComplete 
        ? <CheckCircle2 className="h-3 w-3 text-green-600" />
        : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // Parsing
  const parsing = steps.find(s => s.type === 'parsing_response')
  const complete = steps.find(s => s.type === 'complete')
  if (parsing || complete) {
    displaySteps.push({
      label: t('processing.processAnswer'),
      status: complete ? 'complete' : (parsing ? 'active' : 'pending'),
      details: complete 
        ? t('processing.answerGenerated')
        : parsing?.message || undefined,
      icon: complete 
        ? <CheckCircle2 className="h-3 w-3 text-green-600" />
        : <Loader2 className="h-3 w-3 animate-spin text-blue-500" />,
    })
  }

  // Fehler
  const error = steps.find(s => s.type === 'error')
  if (error) {
    displaySteps.push({
      label: t('processing.error'),
      status: 'error',
      details: error.error,
      icon: <XCircle className="h-3 w-3 text-red-500" />,
    })
  }

  return (
    <div className="space-y-1.5">
      {displaySteps.map((step, index) => (
        <div key={index} className="flex items-start gap-2 text-sm">
          <div className="flex-shrink-0 mt-0.5">
            {step.icon || <Circle className="h-3 w-3 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-muted-foreground">{step.label}</div>
            {step.details && (
              <div className="text-xs text-muted-foreground/80 mt-0.5">{step.details}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}


