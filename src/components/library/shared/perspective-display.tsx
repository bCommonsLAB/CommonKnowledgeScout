'use client'

import { useMemo } from 'react'
import {
  RETRIEVER_LABELS,
  TARGET_LANGUAGE_LABELS,
  CHARACTER_LABELS,
  ACCESS_PERSPECTIVE_LABELS,
  SOCIAL_CONTEXT_LABELS,
  type Character,
  type AccessPerspective,
  type AnswerLength,
  type Retriever,
  type TargetLanguage,
  type SocialContext,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'
import { useStoryContext } from '@/hooks/use-story-context'

interface PerspectiveDisplayProps {
  /** Variante der Anzeige: 'header' zeigt "Deine Perspektive:" mit Labels, 'inline' zeigt kompakt mit · */
  variant?: 'header' | 'inline'
  /** Zeige Antwortlänge (nur für inline-Variante) */
  showAnswerLength?: boolean
  /** Zeige Retriever/Methode (nur für inline-Variante) */
  showRetriever?: boolean
  /** Antwortlänge (optional) */
  answerLength?: AnswerLength
  /** Retriever/Methode (optional) */
  retriever?: Retriever
  /** 
   * Zielsprache (optional)
   * - Bei 'header'-Variante: Falls nicht angegeben, wird useStoryContext verwendet
   * - Bei 'inline'-Variante: Muss explizit übergeben werden (aus QueryLog), kein Fallback
   */
  targetLanguage?: TargetLanguage
  /** 
   * Character/Interessenprofil (optional)
   * - Bei 'header'-Variante: Falls nicht angegeben, wird useStoryContext verwendet
   * - Bei 'inline'-Variante: Muss explizit übergeben werden (aus QueryLog), kein Fallback
   */
  character?: Character[]
  /** 
   * Zugangsperspektive (optional)
   * - Bei 'header'-Variante: Falls nicht angegeben, wird useStoryContext verwendet
   * - Bei 'inline'-Variante: Muss explizit übergeben werden (aus QueryLog), kein Fallback
   */
  accessPerspective?: AccessPerspective[]
  /** 
   * Sozialer Kontext/Sprachstil (optional)
   * - Bei 'header'-Variante: Falls nicht angegeben, wird useStoryContext verwendet
   * - Bei 'inline'-Variante: Muss explizit übergeben werden (aus QueryLog), kein Fallback
   */
  socialContext?: SocialContext
  /** Padding links (für Header-Variante, um mit Buttons ausgerichtet zu sein) */
  paddingLeft?: string
}

/**
 * Gemeinsame Komponente zur Anzeige der Perspektive/Konfiguration
 * 
 * Unterstützt zwei Varianten:
 * - 'header': Zeigt "Deine Perspektive: Sprache: ..., Interessenprofil: ..." (wie in StoryHeader)
 * - 'inline': Zeigt "Antwortlänge: ... · Methode: ... · Sprache: ..." (wie in ChatConfigDisplay)
 * 
 * Verwendet useStoryContext als Fallback für Parameter, die nicht explizit übergeben werden.
 */
export function PerspectiveDisplay({
  variant = 'header',
  showAnswerLength = false,
  showRetriever = false,
  answerLength,
  retriever,
  targetLanguage: targetLanguageProp,
  character: characterProp,
  accessPerspective: accessPerspectiveProp,
  socialContext: socialContextProp,
  paddingLeft,
}: PerspectiveDisplayProps) {
  const { t } = useTranslation()
  const {
    targetLanguage: targetLanguageContext,
    character: characterContext,
    accessPerspective: accessPerspectiveContext,
    socialContext: socialContextContext,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  } = useStoryContext()

  // Verwende Props falls vorhanden, sonst Context als Fallback
  // WICHTIG: Bei 'inline'-Variante (für Antworten) KEIN Fallback auf Context,
  // da die Parameter aus dem QueryLog kommen müssen und unterschiedlich sein können
  const targetLanguage = variant === 'header' 
    ? (targetLanguageProp ?? targetLanguageContext)
    : targetLanguageProp
  const character = variant === 'header'
    ? (characterProp ?? characterContext)
    : characterProp
  const accessPerspective = variant === 'header'
    ? (accessPerspectiveProp ?? accessPerspectiveContext)
    : accessPerspectiveProp
  const socialContext = variant === 'header'
    ? (socialContextProp ?? socialContextContext)
    : socialContextProp

  // Erstelle Items für beide Varianten
  const items = useMemo(() => {
    const result: Array<{ label: string; value: string }> = []

    // Für inline-Variante: Antwortlänge und Methode zuerst
    if (variant === 'inline') {
      if (showAnswerLength && answerLength) {
        result.push({
          label: t('configDisplay.answerLength'),
          value: t(`chat.answerLengthLabels.${answerLength}`),
        })
      }

      if (showRetriever && retriever) {
        const retrieverLabel = retriever === 'chunk' 
          ? t('processing.retrieverChunk')
          : retriever === 'summary' || retriever === 'doc'
          ? t('processing.retrieverSummary')
          : retriever === 'auto'
          ? t('processing.retrieverAuto')
          : RETRIEVER_LABELS[retriever] || retriever
        result.push({
          label: t('configDisplay.method'),
          value: retrieverLabel,
        })
      }
    }

    // Sprache
    if (targetLanguage) {
      const langLabel = targetLanguageLabels[targetLanguage] || TARGET_LANGUAGE_LABELS[targetLanguage] || targetLanguage
      result.push({
        label: variant === 'header' ? t('gallery.storyMode.perspective.language') : t('configDisplay.language'),
        value: langLabel,
      })
    }

    // Interessenprofil (Character)
    if (character && character.length > 0) {
      const charLabels = character.map(char => characterLabels[char] || CHARACTER_LABELS[char] || char).join(', ')
      result.push({
        label: variant === 'header' ? t('gallery.storyMode.perspective.character') : t('configDisplay.character'),
        value: charLabels,
      })
    }

    // Zugangsperspektive
    if (accessPerspective && accessPerspective.length > 0) {
      const apLabels = accessPerspective.map(ap => accessPerspectiveLabels[ap] || ACCESS_PERSPECTIVE_LABELS[ap] || ap).join(', ')
      result.push({
        label: variant === 'header' ? t('gallery.storyMode.perspective.accessPerspective') : t('configDisplay.accessPerspective'),
        value: apLabels,
      })
    }

    // Sprachstil (SocialContext)
    if (socialContext) {
      const contextLabel = socialContextLabels[socialContext] || SOCIAL_CONTEXT_LABELS[socialContext] || socialContext
      result.push({
        label: variant === 'header' ? t('gallery.storyMode.perspective.socialContext') : t('configDisplay.context'),
        value: contextLabel,
      })
    }

    return result
  }, [
    variant,
    showAnswerLength,
    showRetriever,
    answerLength,
    retriever,
    targetLanguage,
    character,
    accessPerspective,
    socialContext,
    t,
    targetLanguageLabels,
    characterLabels,
    accessPerspectiveLabels,
    socialContextLabels,
  ])

  if (items.length === 0) {
    return null
  }

  // Header-Variante: "Deine Perspektive: Sprache: ..., Interessenprofil: ..."
  if (variant === 'header') {
    return (
      <div 
        className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-0.5 min-w-0 w-full"
        style={paddingLeft ? { paddingLeft } : undefined}
      >
        <span className="break-words min-w-0 flex-shrink">{t('gallery.storyMode.perspective.title')}:</span>
        {items.map((item, index) => (
          <span key={index} className="break-words min-w-0 flex-shrink">
            {item.label}: {item.value}
          </span>
        ))}
      </div>
    )
  }

  // Inline-Variante: "Antwortlänge: ... · Methode: ... · Sprache: ..."
  return (
    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1 flex-wrap">
        {items.map((item, index) => (
          <span key={index}>
            {item.label} {item.value}
            {index < items.length - 1 && <span className="mx-1">·</span>}
          </span>
        ))}
      </span>
    </div>
  )
}

