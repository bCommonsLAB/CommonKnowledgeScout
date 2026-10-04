'use client'

/**
 * Die Eingabe im Story-Modus (D6b; wie `ChatInput` der App in der Variante
 * `embedded`): ein runder Knopf unten rechts klappt eine Karte mit mehrzeiligem
 * Feld, Antwortlaenge und Senden auf. Enter mit Strg/Cmd sendet, Escape
 * schliesst. Nach dem Senden klappt die Karte zu.
 */

import { useEffect, useRef } from 'react'
import { Loader2, MessageCircle, Send, X } from 'lucide-react'
import { Button, Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { ANTWORT_LAENGEN, type AntwortLaenge } from './types'

export interface StoryEingabeProps {
  offen: boolean
  setOffen: (offen: boolean) => void
  text: string
  setText: (text: string) => void
  onSenden: () => void
  laeuft: boolean
  antwortLaenge: AntwortLaenge
  setAntwortLaenge: (l: AntwortLaenge) => void
  placeholder?: string
}

export function StoryEingabe(p: StoryEingabeProps) {
  const { t } = useTranslation()
  const feld = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (p.offen) {
      const timer = setTimeout(() => feld.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [p.offen])

  const senden = () => {
    if (!p.text.trim() || p.laeuft) return
    p.onSenden()
    p.setOffen(false)
  }

  return (
    <>
      {p.offen && (
        <div className="absolute bottom-4 left-4 right-14 z-50" data-story-eingabe>
          <Card className="flex max-h-full flex-col border-2 bg-background shadow-lg">
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-3 sm:p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">{t('chat.input.askYourOwnQuestion')}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{t('chat.input.answerLength')}</span>
                  <Select value={p.antwortLaenge} onValueChange={(v) => p.setAntwortLaenge(v as AntwortLaenge)}>
                    <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANTWORT_LAENGEN.map((l) => (
                        <SelectItem key={l} value={l}>{t(`chat.answerLengthLabels.${l}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <textarea
                ref={feld}
                value={p.text}
                onChange={(e) => p.setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    senden()
                  }
                  if (e.key === 'Escape') p.setOffen(false)
                }}
                rows={3}
                placeholder={p.placeholder || t('chat.input.placeholderExample')}
                className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end">
                <Button onClick={senden} size="sm" className="gap-2" disabled={p.laeuft || !p.text.trim()}>
                  {p.laeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {p.laeuft ? t('chat.input.waiting') : t('chat.input.ask')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="absolute bottom-4 right-4 z-[51]">
        <Button
          onClick={() => p.setOffen(!p.offen)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 shadow-lg transition-all hover:shadow-xl"
          aria-label={p.offen ? t('chat.input.closeChat') : t('chat.input.askQuestion')}
        >
          {p.offen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </Button>
      </div>
    </>
  )
}
