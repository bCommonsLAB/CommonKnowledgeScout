'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Send } from 'lucide-react'
import type { AnswerLength } from '@/lib/chat/constants'
import { ANSWER_LENGTH_VALUES } from '@/lib/chat/constants'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/hooks'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSend: (asTOC?: boolean) => void
  isSending: boolean
  answerLength: AnswerLength
  setAnswerLength: (value: AnswerLength) => void
  placeholder?: string
  variant?: 'default' | 'embedded'
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Chat-Input-Komponente für Frage-Eingabe
 * 
 * Unterstützt zwei Varianten:
 * - embedded: Kollabierbares Symbol links, das sich zu einem Input-Panel ausklappt
 * - default: Border-top mit flexibler Position
 */
export function ChatInput({
  input,
  setInput,
  onSend,
  isSending,
  answerLength,
  setAnswerLength,
  placeholder,
  variant = 'default',
  inputRef: externalInputRef,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
}: ChatInputProps) {
  const { t } = useTranslation()
  const internalInputRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = externalInputRef || internalInputRef
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [asTOC, setAsTOC] = useState(false)
  
  // Verwende externen State wenn vorhanden, sonst internen
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen
  const setIsOpen = externalOnOpenChange || setInternalIsOpen
  
  // Auto-öffnen wenn Input gesetzt wird (z.B. durch Frage-Klick) - nur wenn Input vorher leer war
  const prevInputRef = useRef(input)
  useEffect(() => {
    if (variant === 'embedded' && input.trim() && !prevInputRef.current.trim()) {
      // Input wurde gerade gesetzt (war vorher leer) -> öffne Panel
      if (externalOnOpenChange) {
        // Verwende externen Handler wenn vorhanden
        externalOnOpenChange(true)
      } else {
        // Verwende internen State
        setInternalIsOpen(true)
      }
    }
    prevInputRef.current = input
  }, [input, variant, externalOnOpenChange])
  
  // Auto-schließen wird jetzt direkt in handleSend() gemacht, nicht mehr über useEffect
  
  // Focus Input wenn geöffnet
  useEffect(() => {
    if (variant === 'embedded' && isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, variant, inputRef])

  const handleSend = () => {
    if (input.trim() && !isSending) {
      onSend(asTOC)
      // Panel mit kurzer Verzögerung schließen nach dem Absenden (nur im embedded Modus)
      // Verzögerung gibt React Zeit, die Message zu rendern, bevor das Panel geschlossen wird
      // Dies verhindert DOM-Konflikte auf älteren Geräten
      if (variant === 'embedded') {
        setTimeout(() => {
          setIsOpen(false)
        }, 100)
      }
    }
  }

  if (variant === 'embedded') {
    return (
      <>
        {/* Kollabierbares Input-Panel - volle Breite bis zum Button */}
        <div
          className={cn(
            "absolute left-4 z-50 transition-all duration-300 ease-in-out",
            "right-14 sm:right-14",
            "max-w-[calc(100%-4rem)] sm:max-w-none",
            isOpen 
              ? "opacity-100 scale-100 bottom-4" 
              : "w-0 opacity-0 scale-95 overflow-hidden bottom-4 pointer-events-none"
          )}
          style={isOpen ? { 
            maxHeight: 'calc(100% - 2rem)', // Begrenze auf Container-Höhe minus Padding
            bottom: '1rem', // Abstand zum unteren Rand
            top: 'auto', // Stelle sicher, dass top nicht gesetzt ist
            willChange: 'auto',
            contain: 'auto'
          } : {
            willChange: 'width, opacity, transform',
            // Verhindere Layout-Shifts während Transition (robuster für ältere Geräte)
            contain: 'layout style paint'
          }}
        >
          <Card className="border-2 shadow-lg bg-background flex flex-col max-h-full">
            <CardContent className="p-3 sm:p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
              <div className="space-y-3 flex-shrink-0">
                {/* Header-Zeile: Überschrift links, Antwortlänge rechts */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                  <p className="text-sm font-medium">{t('chat.input.askYourOwnQuestion')}</p>
                  {/* Antwortlänge rechts oben */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t('chat.input.answerLength')}</span>
                    <Select 
                      value={answerLength} 
                      onValueChange={(v) => setAnswerLength(v as AnswerLength)}
                      disabled={isSending}
                    >
                      <SelectTrigger className="h-8 w-[110px] text-xs border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ANSWER_LENGTH_VALUES.map((length) => (
                          <SelectItem key={length} value={length}>
                            {t(`chat.answerLengthLabels.${length}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Input-Bereich - mehrzeilig mit Button darunter */}
                <div className="space-y-2">
                  <textarea
                    ref={inputRef as React.LegacyRef<HTMLTextAreaElement>}
                    placeholder={placeholder || t('chat.input.placeholderExample')}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSending) {
                        e.preventDefault()
                        handleSend()
                      }
                      if (e.key === 'Escape') setIsOpen(false)
                    }}
                    disabled={isSending}
                    rows={3}
                    className="w-full min-h-[80px] rounded-md border border-input bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="asTOC"
                        checked={asTOC}
                        onCheckedChange={(checked) => setAsTOC(checked === true)}
                        disabled={isSending}
                      />
                      <label
                        htmlFor="asTOC"
                        className="text-xs text-muted-foreground cursor-pointer select-none"
                      >
                        {t('chat.input.showAsTopics')}
                      </label>
                    </div>
                    <Button onClick={handleSend} size="sm" className="gap-2 shrink-0" disabled={isSending}>
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('chat.input.waiting')}
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {t('chat.input.ask')}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  // Default-Variante
  return (
    <div className="border-t p-3 bg-background flex-shrink-0">
      {/* Header-Zeile: Antwortlänge rechts oben */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{t('chat.input.answerLength')}</span>
        <Select 
          value={answerLength} 
          onValueChange={(v) => setAnswerLength(v as AnswerLength)}
          disabled={isSending}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs border-border/50">
            <SelectValue />
          </SelectTrigger>
                      <SelectContent>
                        {ANSWER_LENGTH_VALUES.map((length) => (
                          <SelectItem key={length} value={length}>
                            {t(`chat.answerLengthLabels.${length}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
        </Select>
      </div>
      {/* Input-Bereich - mehrzeilig mit Button darunter */}
      <div className="space-y-2">
        <textarea
          ref={inputRef as React.LegacyRef<HTMLTextAreaElement>}
          className="w-full min-h-[80px] rounded-md border border-input bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          placeholder={placeholder || t('chat.input.writeYourQuestion')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSending) {
              e.preventDefault()
              onSend(asTOC)
            }
          }}
          disabled={isSending}
          rows={3}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="asTOC-default"
              checked={asTOC}
              onCheckedChange={(checked) => setAsTOC(checked === true)}
              disabled={isSending}
            />
            <label
              htmlFor="asTOC-default"
              className="text-xs text-muted-foreground cursor-pointer select-none"
            >
              {t('chat.input.showAsTopics')}
            </label>
          </div>
          <Button type="button" size="sm" onClick={() => onSend(asTOC)} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('chat.input.waiting')}
              </>
            ) : (
              t('chat.input.send')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

