'use client'

/**
 * Eingabe des Chat-Reiters: mehrzeiliges Feld, Antwortlaenge, „Als
 * Themenuebersicht anzeigen", Senden (auch mit Strg/Cmd + Enter). Die
 * aufklappbare Variante des Story-Modus liegt seit D6c im Story-Paket.
 */

import { useRef, useState } from 'react'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Checkbox } from '@ks/ui'
import { Loader2 } from 'lucide-react'
import type { AnswerLength } from '@/lib/chat/constants'
import { ANSWER_LENGTH_VALUES } from '@/lib/chat/constants'
import { useTranslation } from '@ks/i18n/react'

interface ChatInputProps {
  input: string
  setInput: (value: string) => void
  onSend: (asTOC?: boolean) => void
  isSending: boolean
  answerLength: AnswerLength
  setAnswerLength: (value: AnswerLength) => void
  placeholder?: string
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
}

export function ChatInput({ input, setInput, onSend, isSending, answerLength, setAnswerLength, placeholder, inputRef: externalInputRef }: ChatInputProps) {
  const { t } = useTranslation()
  const internalInputRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = externalInputRef || internalInputRef
  const [asTOC, setAsTOC] = useState(false)

  return (
    <div className="border-t p-3 bg-background flex-shrink-0">
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{t('chat.input.answerLength')}</span>
        <Select value={answerLength} onValueChange={(v) => setAnswerLength(v as AnswerLength)}>
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
          rows={3}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox id="asTOC-default" checked={asTOC} onCheckedChange={(checked) => setAsTOC(checked === true)} />
            <label htmlFor="asTOC-default" className="text-xs text-muted-foreground cursor-pointer select-none">
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
