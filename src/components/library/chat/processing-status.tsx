'use client'

import { Loader2, CheckCircle2, Circle, XCircle } from 'lucide-react'
import type { ChatProcessingStep } from '@/types/chat-processing'

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
  // Wenn keine Steps vorhanden sind, nichts anzeigen
  if (steps.length === 0) {
    return null
  }

  // Konvertiere Steps zu Display-Format
  const displaySteps: StepDisplay[] = []

  // Frage-Analyse
  const analysisStep = steps.find(s => s.type === 'question_analysis_start')
  const analysisResult = steps.find(s => s.type === 'question_analysis_result')
  if (analysisStep) {
    displaySteps.push({
      label: 'Frage analysieren',
      status: analysisResult ? 'complete' : 'active',
      details: analysisResult 
        ? `Empfehlung: ${analysisResult.recommendation === 'chunk' ? 'Spezifisch' : analysisResult.recommendation === 'summary' ? 'Übersichtlich' : 'Unklar'} (${analysisResult.confidence})`
        : undefined,
      icon: analysisResult ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    })
  }

  // Retriever-Auswahl
  const retrieverStep = steps.find(s => s.type === 'retriever_selected')
  if (retrieverStep) {
    displaySteps.push({
      label: 'Retriever auswählen',
      status: 'complete',
      details: `${retrieverStep.retriever === 'chunk' ? 'Spezifisch' : 'Übersichtlich'}${retrieverStep.reason ? ` - ${retrieverStep.reason}` : ''}`,
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    })
  }

  // Retriever-Start
  const retrievalStart = steps.find(s => s.type === 'retrieval_start')
  const retrievalProgress = steps.find(s => s.type === 'retrieval_progress')
  const retrievalComplete = steps.find(s => s.type === 'retrieval_complete')
  if (retrievalStart || retrievalProgress || retrievalComplete) {
    displaySteps.push({
      label: 'Text-Chunks abrufen',
      status: retrievalComplete ? 'complete' : (retrievalStart || retrievalProgress ? 'active' : 'pending'),
      details: retrievalComplete 
        ? `${retrievalComplete.sourcesCount} Text-Chunk${retrievalComplete.sourcesCount !== 1 ? 's' : ''} gefunden (${retrievalComplete.timingMs}ms)`
        : retrievalProgress?.message || 'Suche nach relevanten Inhalten...',
      icon: retrievalComplete 
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    })
  }

  // Prompt bauen
  const promptBuilding = steps.find(s => s.type === 'prompt_building')
  const promptComplete = steps.find(s => s.type === 'prompt_complete')
  if (promptBuilding || promptComplete) {
    const details = promptComplete 
      ? `${promptComplete.documentsUsed} Text-Chunk${promptComplete.documentsUsed !== 1 ? 's' : ''} verwendet, ${promptComplete.tokenCount.toLocaleString('de-DE')} Token`
      : promptBuilding?.message || undefined
    displaySteps.push({
      label: 'Prompt zusammenstellen',
      status: promptComplete ? 'complete' : (promptBuilding ? 'active' : 'pending'),
      details,
      icon: promptComplete 
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    })
  }

  // LLM-Aufruf
  const llmStart = steps.find(s => s.type === 'llm_start')
  const llmProgress = steps.find(s => s.type === 'llm_progress')
  const llmComplete = steps.find(s => s.type === 'llm_complete')
  if (llmStart || llmProgress || llmComplete) {
    const details = llmComplete 
      ? (() => {
          const parts: string[] = [`Fertig (${llmComplete.timingMs}ms)`]
          if (llmComplete.promptTokens !== undefined || llmComplete.completionTokens !== undefined) {
            const tokens: string[] = []
            if (llmComplete.promptTokens !== undefined) {
              tokens.push(`${llmComplete.promptTokens.toLocaleString('de-DE')} Input`)
            }
            if (llmComplete.completionTokens !== undefined) {
              tokens.push(`${llmComplete.completionTokens.toLocaleString('de-DE')} Output`)
            }
            if (tokens.length > 0) {
              parts.push(`${tokens.join(', ')} Token`)
            }
          }
          return parts.join(' - ')
        })()
      : llmProgress?.message || llmStart ? `Modell: ${llmStart?.model || '...'}` : undefined
    displaySteps.push({
      label: 'Antwort generieren',
      status: llmComplete ? 'complete' : (llmStart || llmProgress ? 'active' : 'pending'),
      details,
      icon: llmComplete 
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    })
  }

  // Parsing
  const parsing = steps.find(s => s.type === 'parsing_response')
  const complete = steps.find(s => s.type === 'complete')
  if (parsing || complete) {
    displaySteps.push({
      label: 'Antwort verarbeiten',
      status: complete ? 'complete' : (parsing ? 'active' : 'pending'),
      details: complete 
        ? 'Fertig - Antwort erfolgreich generiert'
        : parsing?.message || undefined,
      icon: complete 
        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
        : <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    })
  }

  // Fehler
  const error = steps.find(s => s.type === 'error')
  if (error) {
    displaySteps.push({
      label: 'Fehler',
      status: 'error',
      details: error.error,
      icon: <XCircle className="h-4 w-4 text-red-500" />,
    })
  }

  return (
    <div className="bg-muted/30 border rounded-lg p-3 mb-4">
      <div className="space-y-2">
        {displaySteps.map((step, index) => (
          <div key={index} className="flex items-start gap-2 text-sm">
            <div className="flex-shrink-0 mt-0.5">
              {step.icon || <Circle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{step.label}</div>
              {step.details && (
                <div className="text-xs text-muted-foreground mt-0.5">{step.details}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


