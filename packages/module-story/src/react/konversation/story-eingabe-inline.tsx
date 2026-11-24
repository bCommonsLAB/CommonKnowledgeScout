'use client'

/**
 * Die Fragebox als sichtbares Feld (Welle N1, Plan website-story-sektion;
 * R1 24.11.2026: EINE Box): fuer Gastgeber, bei denen die Frage der Einstieg
 * ist — die Startseite einer Library. Anders als `StoryEingabe` (Knopf, der
 * eine Karte aufklappt) steht das Feld immer da. Es ist Eingabe UND Anzeige
 * der gestellten Frage: der Gastgeber laesst den Text nach dem Senden stehen,
 * der Leser aendert ihn und sendet erneut. Eine Zeile, die mit dem Text
 * waechst; Enter sendet, Shift+Enter bricht um. Auf dem Telefon ist der
 * Sende-Knopf nur das Symbol — so ragt nichts aus dem Feld. Neben dem Senden
 * hat der Gastgeber Platz fuer einen dezenten Knopf (`aktion`). Kein `next/*`, kein Clerk.
 */

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'

export interface StoryEingabeInlineProps {
  text: string
  setText: (text: string) => void
  onSenden: () => void
  laeuft: boolean
  /**
   * Dezenter Knopf des Gastgebers neben dem Senden (Startseite: „Antworten anpassen", Owner
   * 24.11.2026 — dort steht seither auch die Antwortlaenge, die frueher hier gewaehlt wurde).
   */
  aktion?: ReactNode
  placeholder?: string
  /**
   * Telefon, Schreiben im Vollbild (R5): das Feld mehrzeilig ueber die ganze Breite, darunter der
   * Sende-Knopf breit und beschriftet. Die Lage der Elemente im Baum bleibt gleich — das Feld
   * behaelt den Fokus, wenn die Darstellung wechselt.
   */
  gross?: boolean
  /** Das Feld hat den Fokus bekommen (der Gastgeber oeffnet darauf z. B. sein Vollbild). */
  onFokus?: () => void
  /** Zusaetzliche Klassen fuer den Rahmen (Gastgeber-Flaeche). */
  className?: string
}

/** Hoechste Hoehe des Felds, danach scrollt es in sich (Pixel). */
const MAX_HOEHE = 200

export function StoryEingabeInline(p: StoryEingabeInlineProps) {
  const { t } = useTranslation()
  const feld = useRef<HTMLTextAreaElement>(null)

  // Das Feld waechst mit dem Text (auch wenn der Gastgeber ihn setzt, z. B. eine Beispielfrage) — und
  // misst neu, wenn es schmaler oder breiter wird (Vollbild auf dem Telefon: derselbe Text bricht anders um).
  useLayoutEffect(() => {
    const el = feld.current
    if (!el) return
    const passe = () => {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, MAX_HOEHE)}px`
    }
    passe()
    // Ohne `ResizeObserver` (Testumgebung ohne Layout) gibt es keine Breite, die sich aendern koennte.
    if (typeof ResizeObserver === 'undefined') return
    let breite = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === breite) return
      breite = el.clientWidth
      passe()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [p.text, p.gross])

  const senden = () => {
    if (!p.text.trim() || p.laeuft) return
    p.onSenden()
  }

  return (
    <div
      className={`rounded-2xl border-2 border-primary/40 bg-background shadow-sm focus-within:border-primary/70 focus-within:ring-4 focus-within:ring-primary/10 ${p.className ?? ''}`}
      data-story-eingabe-inline
    >
      <div className={p.gross ? 'flex flex-wrap items-center gap-2 p-3' : 'flex items-end gap-1.5 p-2 pl-4 sm:gap-2 sm:pl-5'}>
        <textarea
          ref={feld}
          value={p.text}
          onChange={(e) => p.setText(e.target.value)}
          onFocus={p.onFokus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              senden()
            }
          }}
          rows={1}
          placeholder={p.placeholder || t('chat.input.placeholderExample')}
          aria-label={t('chat.input.askQuestion')}
          title={t('story.eingabeInline.enterHint')}
          className={`${p.gross ? 'min-h-[112px] basis-full px-1 text-lg' : 'min-h-[44px] min-w-0 flex-1 text-base'} resize-none bg-transparent py-2.5 font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none`}
        />
        {p.text !== '' && (
          <Button type="button" variant="ghost" size="sm" className="h-11 w-11 shrink-0 p-0 text-muted-foreground" aria-label={t('story.eingabeInline.leeren')} title={t('story.eingabeInline.leeren')} data-story-eingabe-leeren onClick={() => { p.setText(''); feld.current?.focus() }}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
        {p.aktion}
        <Button onClick={senden} className={p.gross ? 'order-last h-12 flex-1 gap-2 rounded-full px-5' : 'h-11 w-11 shrink-0 gap-2 rounded-full p-0 sm:w-auto sm:px-5'} disabled={p.laeuft || !p.text.trim()} aria-label={t('chat.input.askQuestion')} data-story-eingabe-senden>
          {p.laeuft ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          <span className={p.gross ? 'inline' : 'hidden sm:inline'}>{p.laeuft ? t('chat.input.waiting') : t('chat.input.askQuestion')}</span>
        </Button>
      </div>
    </div>
  )
}
