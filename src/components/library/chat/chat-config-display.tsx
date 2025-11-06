'use client'

import {
  ANSWER_LENGTH_LABELS,
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
  const configItems: string[] = []

  if (answerLength) {
    configItems.push(`Antwortlänge: ${ANSWER_LENGTH_LABELS[answerLength] || answerLength}`)
  }

  if (retriever) {
    configItems.push(`Methode: ${RETRIEVER_LABELS[retriever] || retriever}`)
  }

  if (targetLanguage) {
    configItems.push(`Sprache: ${TARGET_LANGUAGE_LABELS[targetLanguage] || targetLanguage}`)
  }

  if (character) {
    const charLabel = typeof character === 'string' ? (CHARACTER_LABELS[character as Character] || character) : ''
    if (charLabel) {
      configItems.push(`Charakter: ${charLabel}`)
    }
  }

  if (socialContext) {
    configItems.push(`Kontext: ${SOCIAL_CONTEXT_LABELS[socialContext] || socialContext}`)
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

