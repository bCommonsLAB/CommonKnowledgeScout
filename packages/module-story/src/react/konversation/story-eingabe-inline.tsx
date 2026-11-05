'use client'

/**
 * Die Eingabe als sichtbares Feld (Welle N1, Plan website-story-sektion):
 * fuer Gastgeber, bei denen die Frage der Einstieg ist — die Startseite
 * einer Library. Anders als `StoryEingabe` (Knopf, der eine Karte
 * aufklappt) steht das Feld immer da; Enter sendet, Shift+Enter bricht um.
 * Antwortlaenge und Senden wie dort. Kein `next/*`, kein Clerk.
 */

import { Loader2, Send } from 'lucide-react'
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import { ANTWORT_LAENGEN, type AntwortLaenge } from './types'

export interface StoryEingabeInlineProps {
  text: string
  setText: (text: string) => void
  onSenden: () => void
  laeuft: boolean
  antwortLaenge: AntwortLaenge
  setAntwortLaenge: (l: AntwortLaenge) => void
  placeholder?: string
  /** Zusaetzliche Klassen fuer den Rahmen (Gastgeber-Flaeche). */
  className?: string
}

export function StoryEingabeInline(p: StoryEingabeInlineProps) {
  const { t } = useTranslation()

  const senden = () => {
    if (!p.text.trim() || p.laeuft) return
    p.onSenden()
  }

  return (
    <div
      className={`rounded-2xl border-2 border-primary/40 bg-background shadow-sm focus-within:border-primary/70 focus-within:ring-4 focus-within:ring-primary/10 ${p.className ?? ''}`}
      data-story-eingabe-inline
    >
      <textarea
        value={p.text}
        onChange={(e) => p.setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            senden()
          }
        }}
        rows={3}
        placeholder={p.placeholder || t('chat.input.placeholderExample')}
        aria-label={t('chat.input.askQuestion')}
        className="min-h-[88px] w-full resize-y rounded-t-2xl bg-transparent px-5 pb-2 pt-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pl-5">
        <span className="text-xs text-muted-foreground">{t('story.eingabeInline.enterHint')}</span>
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
          <Button onClick={senden} size="sm" className="gap-2" disabled={p.laeuft || !p.text.trim()}>
            {p.laeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {p.laeuft ? t('chat.input.waiting') : t('chat.input.askQuestion')}
          </Button>
        </div>
      </div>
    </div>
  )
}
