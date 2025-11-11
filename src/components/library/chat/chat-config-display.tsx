'use client'

import {
  RETRIEVER_LABELS,
  TARGET_LANGUAGE_LABELS,
  CHARACTER_LABELS,
  SOCIAL_CONTEXT_LABELS,
  type Character,
} from '@/lib/chat/constants'

import type {
  AnswerLength,
  Retriever,
  TargetLanguage,
  SocialContext,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useStoryContext } from '@/hooks/use-story-context'

interface ChatConfigDisplayProps {
  answerLength?: AnswerLength
  retriever?: Retriever
  targetLanguage?: TargetLanguage
  character?: string
  socialContext?: SocialContext
}

/**
 * Komponente zur Anzeige der Chat-Konfiguration
 * 
 * Zeigt dezent die Konfigurationsparameter unter einer Frage oder unter dem Chat-Panel an.
 */
export function ChatConfigDisplay({
  answerLength,
  retriever,
  targetLanguage,
  character,
  socialContext,
}: ChatConfigDisplayProps) {
  const { t } = useTranslation()
  const { targetLanguageLabels, characterLabels, socialContextLabels } = useStoryContext()
  const configItems: string[] = []

  if (answerLength) {
    configItems.push(`${t('configDisplay.answerLength')} ${t(`chat.answerLengthLabels.${answerLength}`)}`)
  }

  if (retriever) {
    // Retriever-Labels werden aus den Übersetzungen geholt
    const retrieverLabel = retriever === 'chunk' 
      ? t('processing.retrieverChunk')
      : retriever === 'summary' || retriever === 'doc'
      ? t('processing.retrieverSummary')
      : retriever === 'auto'
      ? t('processing.retrieverAuto')
      : RETRIEVER_LABELS[retriever] || retriever
    configItems.push(`${t('configDisplay.method')} ${retrieverLabel}`)
  }

  if (targetLanguage) {
    const langLabel = targetLanguageLabels[targetLanguage] || TARGET_LANGUAGE_LABELS[targetLanguage] || targetLanguage
    configItems.push(`${t('configDisplay.language')} ${langLabel}`)
  }

  if (character) {
    const charLabel = typeof character === 'string' ? (characterLabels[character as Character] || CHARACTER_LABELS[character as Character] || character) : ''
    if (charLabel) {
      configItems.push(`${t('configDisplay.character')} ${charLabel}`)
    }
  }

  if (socialContext) {
    const contextLabel = socialContextLabels[socialContext] || SOCIAL_CONTEXT_LABELS[socialContext] || socialContext
    configItems.push(`${t('configDisplay.context')} ${contextLabel}`)
  }

  if (configItems.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1 flex-wrap">
        {configItems.map((item, index) => (
          <span key={index}>
            {item}
            {index < configItems.length - 1 && <span className="mx-1">·</span>}
          </span>
        ))}
      </span>
    </div>
  )
}

