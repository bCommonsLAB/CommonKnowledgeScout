'use client'

import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'
import { Settings } from 'lucide-react'
import type { Character, AnswerLength, Retriever, TargetLanguage, SocialContext } from '@/lib/chat/constants'
import {
  ANSWER_LENGTH_VALUES,
  ANSWER_LENGTH_LABELS,
  RETRIEVER_VALUES,
  RETRIEVER_LABELS,
} from '@/lib/chat/constants'

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
  character: Character
  socialContext: SocialContext
  onGenerateTOC: () => Promise<void>
  onSavePreferences: (prefs: {
    targetLanguage: TargetLanguage
    character: Character
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
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="font-medium text-sm mb-3">Erweiterte Einstellungen</div>
          
          {/* Antwortlänge */}
          <div>
            <div className="text-sm font-medium mb-2">Antwortlänge:</div>
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
                  {ANSWER_LENGTH_LABELS[v]}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Methode */}
          <div>
            <div className="text-sm font-medium mb-2">Methode:</div>
            <div className="flex gap-1 flex-wrap">
              {RETRIEVER_VALUES.filter(v => v !== 'summary').map((v) => {
                const label = RETRIEVER_LABELS[v]
                const tip = v === 'auto'
                  ? 'Das System analysiert Ihre Frage automatisch und wählt die beste Methode (Spezifisch oder Übersichtlich).'
                  : v === 'chunk'
                  ? 'Für die Frage interessante Textstellen (Chunks) suchen und daraus die Antwort generieren. Nur spezifische Inhalte – dafür präziser.'
                  : 'Aus den Zusammenfassungen aller Kapitel/Dokumente eine Antwort kreieren. Mehr Überblick – dafür etwas ungenauer.'
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
              <div className="text-xs font-medium">Gendergerechte Formulierung</div>
              <div className="text-xs text-muted-foreground">
                Verwende geschlechtsneutrale Formulierungen in den Antworten
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
              Themenübersicht anzeigen
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}


