'use client'

/**
 * Fuss des Chat-Panels (D6): das Eingabefeld des Chat-Reiters. Die
 * aufklappbare Variante des Story-Modus liegt seit D6c im Story-Paket
 * (`StoryEingabe`).
 */

import type { RefObject } from 'react'
import { ChatInput } from '../chat-input'
import type { AnswerLength } from '@/lib/chat/constants'

export interface ChatPanelFooterProps {
  input: string
  setInput: (v: string) => void
  onSend: (asTOC?: boolean) => Promise<void>
  isSending: boolean
  answerLength: AnswerLength
  setAnswerLength: (v: AnswerLength) => void
  placeholder?: string
  inputRef: RefObject<HTMLInputElement>
}

export function ChatPanelFooter(p: ChatPanelFooterProps) {
  return (
    <div className="flex-shrink-0">
      <ChatInput
        input={p.input}
        setInput={p.setInput}
        onSend={p.onSend}
        isSending={p.isSending}
        answerLength={p.answerLength}
        setAnswerLength={p.setAnswerLength}
        placeholder={p.placeholder}
        inputRef={p.inputRef}
      />
    </div>
  )
}
