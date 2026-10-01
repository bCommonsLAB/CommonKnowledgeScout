'use client'

/**
 * Mitte, Thema gewaehlt: dieselbe Form eine Ebene tiefer — Titel,
 * Kurztext, Zaehler, dann die Fragen als grosse Knoepfe (volle Breite, Pfeil).
 *
 * Zaehler je Thema: nur „n Fragen". Dokumente je Thema braeuchten eine
 * Zuordnung Thema → Dokumente, die die Themenuebersicht heute nicht liefert
 * (Plan, offene Punkte).
 */

import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from '@ks/ui'
import { useTranslation } from '@ks/i18n/react'
import type { StoryQuestion, StoryTopic } from '@ks/contracts'
import { Kennzahlen } from './kennzahlen'

export interface StoryThemaProps {
  thema: StoryTopic
  onFrageWaehlen: (frage: StoryQuestion) => void
  onZurueck: () => void
}

export function StoryThema({ thema, onFrageWaehlen, onZurueck }: StoryThemaProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6" data-story-thema={thema.id}>
      <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" onClick={onZurueck}>
        <ArrowLeft className="h-4 w-4" />
        {t('story.back')}
      </Button>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold leading-tight">{thema.title}</h1>
        {thema.summary && <p className="line-clamp-3 text-base leading-relaxed text-muted-foreground">{thema.summary}</p>}
        <Kennzahlen werte={[{ art: 'questions', wert: thema.questions.length }]} />
      </header>

      <section className="space-y-2" aria-label={t('story.chooseQuestion')}>
        <h2 className="text-sm font-medium text-muted-foreground">{t('story.chooseQuestion')}</h2>
        <ul className="space-y-2">
          {thema.questions.map((frage) => (
            <li key={frage.id}>
              <button
                type="button"
                onClick={() => onFrageWaehlen(frage)}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
              >
                <span className="whitespace-normal break-words leading-snug">{frage.text}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
