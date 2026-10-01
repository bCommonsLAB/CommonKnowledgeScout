'use client'

/**
 * Fuss des Chat-Panels (D6): das Eingabefeld — im Chat-Reiter fest, im
 * Story-Modus auf- und zuklappbar hinter dem runden Knopf unten rechts.
 */

import type { RefObject } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@ks/ui'
import { cn } from '@ks/util'
import { useTranslation } from '@ks/i18n/react'
import { ChatInput } from '../chat-input'
import type { AnswerLength } from '@/lib/chat/constants'

export interface ChatPanelFooterProps {
  isEmbedded: boolean
  input: string
  setInput: (v: string) => void
  onSend: (asTOC?: boolean) => Promise<void>
  isSending: boolean
  answerLength: AnswerLength
  setAnswerLength: (v: AnswerLength) => void
  placeholder?: string
  inputRef: RefObject<HTMLInputElement>
  isChatInputOpen: boolean
  setIsChatInputOpen: (open: boolean) => void
}

export function ChatPanelFooter(p: ChatPanelFooterProps) {
  const { t } = useTranslation()
  const gemeinsam = {
    input: p.input,
    setInput: p.setInput,
    onSend: p.onSend,
    isSending: p.isSending,
    answerLength: p.answerLength,
    setAnswerLength: p.setAnswerLength,
    placeholder: p.placeholder,
    inputRef: p.inputRef,
  }
  return (
    <>
      <div className="flex-shrink-0">
        {p.isEmbedded ? (
          <ChatInput {...gemeinsam} variant="embedded" isOpen={p.isChatInputOpen} onOpenChange={p.setIsChatInputOpen} />
        ) : (
          <ChatInput {...gemeinsam} variant="default" />
        )}
      </div>
      {p.isEmbedded && (
        <div style={{ position: 'absolute', right: '1rem', bottom: '1rem', zIndex: 100 }}>
          <Button
            onClick={() => p.setIsChatInputOpen(!p.isChatInputOpen)}
            className={cn(
              'h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 shrink-0 p-0 aspect-square flex items-center justify-center',
              'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
            aria-label={p.isChatInputOpen ? t('chat.input.closeChat') : t('chat.input.askQuestion')}
          >
            {p.isChatInputOpen ? <X className="h-5 w-5 transition-transform duration-300" /> : <MessageCircle className="h-5 w-5 transition-transform duration-300" />}
          </Button>
        </div>
      )}
    </>
  )
}
