/**
 * Themenuebersicht aus dem Stream uebernehmen (D6, aus chat-panel.tsx
 * ausgegliedert): Kommt ein `complete`-Schritt einer TOC-Anfrage, werden die
 * Daten mit den aktuellen Parametern in den TOC-Hook gesetzt — auch ohne
 * `storyTopicsData`, damit der Generierungs-Zustand zurueckfaellt und keine
 * Endlosschleife entsteht. Verhalten 1:1 portiert, Debug-Logs entfallen.
 */

import { useEffect } from 'react'
import type { ChatResponse } from '@/types/chat-response'
import type { ChatProcessingStep } from '@/types/chat-processing'
import { TOC_QUESTION } from '@/lib/chat/constants'
import type { ChatMessage } from '../../utils/chat-utils'
import type { UseChatTOCResult } from '../../hooks/use-chat-toc/types'

type TocParams = Pick<
  Parameters<UseChatTOCResult['setTOCData']>[0],
  'answerLength' | 'retriever' | 'targetLanguage' | 'character' | 'accessPerspective' | 'socialContext' | 'facetsSelected' | 'llmModel'
>

export interface UseTocCompleteStepParams {
  processingSteps: ChatProcessingStep[]
  messages: ChatMessage[]
  setTOCData: UseChatTOCResult['setTOCData']
  params: TocParams
}

export function useTocCompleteStep({ processingSteps, messages, setTOCData, params }: UseTocCompleteStepParams): void {
  useEffect(() => {
    if (processingSteps.length === 0) return
    const lastStep = processingSteps[processingSteps.length - 1]
    if (lastStep.type !== 'complete') return

    // TOC-Anfrage erkennen: ueber den Verlauf, den Retriever-Schritt oder die Daten selbst
    // (die Nachricht ist beim complete-Schritt womoeglich noch nicht im Verlauf).
    const isTOCQueryInMessages = messages.some((msg) => msg.type === 'question' && msg.content.trim() === TOC_QUESTION.trim())
    const isTOCQueryInSteps = processingSteps.some(
      (step) => step.type === 'retriever_selected' && step.reason?.includes('TOC query'),
    )
    if (!(isTOCQueryInMessages || isTOCQueryInSteps || !!lastStep.storyTopicsData)) return

    setTOCData({
      storyTopicsData: lastStep.storyTopicsData,
      answer: lastStep.answer || '',
      references: Array.isArray(lastStep.references)
        ? lastStep.references.filter(
            (r): r is ChatResponse['references'][number] =>
              typeof r === 'object' && r !== null && 'number' in r && 'fileId' in r && 'description' in r,
          )
        : [],
      suggestedQuestions: Array.isArray(lastStep.suggestedQuestions)
        ? lastStep.suggestedQuestions.filter((q: unknown): q is string => typeof q === 'string')
        : [],
      queryId: typeof lastStep.queryId === 'string' ? lastStep.queryId : `temp-${Date.now()}`,
      ...params,
    })
    // Nur auf neue Schritte reagieren — die Parameter sind beim complete-Schritt die aktuellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingSteps.length, processingSteps])
}
