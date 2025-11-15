'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Settings } from 'lucide-react'
import type { Character, AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import {
  ANSWER_LENGTH_VALUES,
  RETRIEVER_VALUES,
  RETRIEVER_LABELS,
} from '@/lib/chat/constants'
import { useTranslation } from '@/lib/i18n/hooks'

interface ChatConfigPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  answerLength: AnswerLength
  setAnswerLength: (value: AnswerLength) => void
  retriever: Retriever
  setRetriever: (value: Retriever) => void
  genderInclusive: boolean
  setGenderInclusive: (value: boolean) => void
  targetLanguage: TargetLanguage
  character: Character[] // Array (kann leer sein)
  socialContext: SocialContext
  onGenerateTOC: () => Promise<void>
  onSavePreferences: (prefs: {
    targetLanguage: TargetLanguage
    character: Character[] // Array (kann leer sein)
    socialContext: SocialContext
    genderInclusive: boolean
  }) => Promise<void>
}

/**
 * Popover für erweiterte Chat-Einstellungen
 * 
 * Enthält:
 * - Antwortlänge
 * - Methode (Retriever)
 * - Gendergerechte Formulierung
 * - Button für Themenübersicht
 */
export function ChatConfigPopover({
  open,
  onOpenChange,
  answerLength,
  setAnswerLength,
  retriever,
  setRetriever,
  genderInclusive,
  setGenderInclusive,
  targetLanguage,
  character,
  socialContext,
  onGenerateTOC,
  onSavePreferences,
}: ChatConfigPopoverProps) {
  const { t } = useTranslation()
  
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="font-medium text-sm mb-3">{t('configPopover.advancedSettings')}</div>
          
          {/* Antwortlänge */}
          <div>
            <div className="text-sm font-medium mb-2">{t('configPopover.answerLength')}</div>
            <div className="flex gap-1 flex-wrap">
              {ANSWER_LENGTH_VALUES.map((v) => (
                <Button 
                  key={v} 
                  type="button" 
                  size="sm" 
                  variant={answerLength===v? 'default':'outline'} 
                  onClick={() => setAnswerLength(v)} 
                  className="h-7 px-2 text-xs"
                >
                  {t(`chat.answerLengthLabels.${v}`)}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Methode */}
          <div>
            <div className="text-sm font-medium mb-2">{t('configPopover.method')}</div>
            <div className="flex gap-1 flex-wrap">
              {RETRIEVER_VALUES.filter(v => v !== 'summary').map((v) => {
                const label = v === 'chunk'
                  ? t('processing.retrieverChunk')
                  : v === 'doc'
                  ? t('processing.retrieverSummary')
                  : v === 'auto'
                  ? t('processing.retrieverAuto')
                  : RETRIEVER_LABELS[v] || v
                const tip = v === 'auto'
                  ? t('configPopover.retrieverAutoTooltip')
                  : v === 'chunk'
                  ? t('configPopover.retrieverChunkTooltip')
                  : t('configPopover.retrieverDocTooltip')
                return (
                  <Tooltip key={v}>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant={retriever===v? 'default':'outline'} 
                        onClick={() => setRetriever(v)} 
                        className="h-7 px-2 text-xs"
                      >
                        {label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px] text-xs">
                      <div className="max-w-[280px]">{tip}</div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
          
          {/* Gendergerechte Formulierung */}
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <div className="space-y-0.5">
              <div className="text-xs font-medium">{t('configPopover.genderInclusive')}</div>
              <div className="text-xs text-muted-foreground">
                {t('configPopover.genderInclusiveDescription')}
              </div>
            </div>
            <Switch
              checked={genderInclusive}
              onCheckedChange={setGenderInclusive}
            />
          </div>
          
          {/* Themenübersicht anzeigen */}
          <div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={async () => {
                await onSavePreferences({
                  targetLanguage,
                  character,
                  socialContext,
                  genderInclusive,
                })
                await onGenerateTOC()
                onOpenChange(false)
              }}
            >
              {t('configPopover.showTopicOverview')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}



