'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Send, MessageCircle, X } from 'lucide-react'
import type { AnswerLength } from '@/lib/chat/constants'
import { ANSWER_LENGTH_VALUES, ANSWER_LENGTH_LABELS } from '@/lib/chat/constants'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSend: () => void
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
  const internalInputRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = externalInputRef || internalInputRef
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  
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
      onSend()
      // Panel sofort schließen nach dem Absenden (nur im embedded Modus)
      if (variant === 'embedded') {
        setIsOpen(false)
      }
    }
  }

  if (variant === 'embedded') {
    return (
      <>
        {/* Kollabierbares Input-Panel - volle Breite bis zum Button */}
        <div
          className={cn(
            "absolute left-0 bottom-4 z-50 transition-all duration-300 ease-in-out overflow-hidden",
            "right-14 sm:right-14",
            "max-w-[calc(100vw-4rem)] sm:max-w-none",
            isOpen 
              ? "opacity-100 scale-100" 
              : "w-0 opacity-0 scale-95"
          )}
        >
          <Card className="border-2 shadow-lg bg-background">
            <CardContent className="p-3 sm:p-4">
              <div className="space-y-3">
                {/* Header-Zeile: Überschrift links, Antwortlänge rechts */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                  <p className="text-sm font-medium">Stelle deine eigene Frage:</p>
                  {/* Antwortlänge rechts oben */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Antwortlänge:</span>
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
                            {ANSWER_LENGTH_LABELS[length]}
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
                    placeholder={placeholder || "z.B. Wie wurde Nachhaltigkeit diskutiert?"}
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
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSend} size="sm" className="gap-2 shrink-0" disabled={isSending}>
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Warten...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Fragen
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Chat-Symbol Button - rund, immer an der gleichen Position rechts */}
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "absolute right-0 bottom-4 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 shrink-0 p-0 aspect-square flex items-center justify-center z-50",
            isOpen ? "bg-primary" : "bg-primary hover:bg-primary/90"
          )}
          aria-label={isOpen ? "Chat schließen" : "Frage stellen"}
        >
          {isOpen ? (
            <X className="h-5 w-5 transition-transform duration-300" />
          ) : (
            <MessageCircle className="h-5 w-5 transition-transform duration-300" />
          )}
        </Button>
      </>
    )
  }

  // Default-Variante
  return (
    <div className="border-t p-3 bg-background flex-shrink-0">
      {/* Header-Zeile: Antwortlänge rechts oben */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Antwortlänge:</span>
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
                {ANSWER_LENGTH_LABELS[length]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Input-Bereich - mehrzeilig mit Button darunter */}
      <div className="space-y-2">
        <textarea
          ref={inputRef as React.LegacyRef<HTMLTextAreaElement>}
          className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          placeholder={placeholder || 'Schreibe deine Frage …'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isSending) {
              e.preventDefault()
              onSend()
            }
          }}
          disabled={isSending}
          rows={3}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={onSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Warten...
              </>
            ) : (
              'Senden'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

