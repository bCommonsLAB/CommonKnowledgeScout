'use client'

/**
 * Frage-Leiste am unteren Bildschirmrand (R3, 24.11.2026, nur Telefon): Ist die Fragebox
 * aus dem Bild gescrollt, bleibt die Frage einen Tipp entfernt — die Leiste rollt zur Box
 * und setzt den Cursor hinein. Sie zeigt sich nur, solange die Seite der Sektion im Bild
 * ist (im Embed liegt sie sonst ueber fremdem Inhalt).
 */

import * as React from 'react'
import { Send, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import { useSchmal } from './use-schmal'

export interface StoryFrageLeisteProps {
  /** Der Anker der Sektion; darin liegt die Fragebox. */
  anker: React.RefObject<HTMLElement | null>
  /** Beschriftung: der Platzhalter der Fragebox. */
  text: string
  /** Keine Leiste (Vollbild offen, Sektion laedt oder zeigt einen Fehler). */
  aus: boolean
}

const BOX = '[data-story-eingabe-inline]'

export function StoryFrageLeiste({ anker, text, aus }: StoryFrageLeisteProps): React.ReactElement | null {
  const schmal = useSchmal()
  const [zeigen, setZeigen] = React.useState(false)

  React.useEffect(() => {
    if (!schmal || aus) { setZeigen(false); return }
    const box = anker.current?.querySelector(BOX)
    const seite = anker.current?.parentElement
    if (!box || !seite) return
    let boxImBild = true
    let seiteImBild = false
    const io = new IntersectionObserver((eintraege) => {
      for (const e of eintraege) {
        if (e.target === box) boxImBild = e.isIntersecting
        else seiteImBild = e.isIntersecting
      }
      setZeigen(!boxImBild && seiteImBild)
    })
    io.observe(box)
    io.observe(seite)
    return () => io.disconnect()
  }, [schmal, aus, anker])

  if (!zeigen) return null
  const zurBox = () => {
    const box = anker.current?.querySelector<HTMLElement>(BOX)
    if (!box) return
    box.scrollIntoView({ behavior: 'smooth', block: 'center' })
    box.querySelector('textarea')?.focus({ preventScroll: true })
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white px-3 pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] pb-[max(0.5rem,env(safe-area-inset-bottom))]" data-story-frage-leiste>
      <button type="button" onClick={zurBox} className="flex h-12 w-full items-center justify-between gap-3 rounded-full border-2 border-neutral-900 bg-white pl-4 pr-1.5 text-left text-[15px] text-neutral-500">
        <span className="truncate">{text}</span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white" aria-hidden="true"><Send className="h-4 w-4" /></span>
      </button>
    </div>
  )
}

/**
 * Der Knopf „Antworten anpassen" in der Fragebox (Owner 24.11.2026): dezent, nur das Regler-Symbol,
 * mit Beschriftung fuer Vorleser und Tooltip. Er oeffnet den Dialog, in dem auch die Antwortlaenge steht.
 */
export function StoryAnpassenKnopf({ onClick }: { onClick: () => void }): React.ReactElement {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('website.story.anpassen')}
      aria-label={t('website.story.anpassen')}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      data-story-perspektive-knopf
    >
      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}
