'use client'

/**
 * Mitte beim Einstieg: optionaler Hinweis, Kennzahlen, eine Karte je Thema.
 *
 * Seit D10 steht der Kopf des Inhalts (Titel, Zweizeiler der Library) NICHT
 * mehr hier, sondern im Kopf der Seite (Gastgeber). Ueber den Karten steht
 * eine kurze Themenzeile mit Zahl („7 Themen · waehle eines"); die Konfig
 * (`story.topicsTitle`/`topicsIntro`) darf sie ersetzen bzw. ergaenzen.
 * Titel und Einleitung, die das Sprachmodell mit der Gliederung liefert,
 * werden nicht angezeigt — sie wiederholten den Kopf (Befund 02.10.).
 * Was das Paket nicht kennt, kommt als Slot: Hinweis (D10), Rechen-Status,
 * Aktionen (neu berechnen) und der Fuss (KI-Hinweis, Konfig-Anzeige).
 */

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import { Kennzahlen, zaehlerText } from './kennzahlen'

export interface StoryUebersichtProps {
  /** `null`, solange die Themenuebersicht noch berechnet wird. */
  gliederung: StoryTopicsData | null
  dokumente: number
  /** Ueberschrift ueber den Karten (Konfig `story.topicsTitle`); sonst die Themenzeile mit Zahl. */
  themenTitel?: string
  /** Einleitung zu den Karten (Konfig `story.topicsIntro`); ohne Konfig keine. */
  themenIntro?: string
  onThemaWaehlen: (themaId: string) => void
  /** D10: einmaliger Hinweis zur Bedienung, ganz oben. */
  hinweis?: ReactNode
  /** Rechen-Status, solange keine Gliederung da ist (oder sie neu entsteht). */
  status?: ReactNode
  /** Aktionen rechts neben den Kennzahlen, z. B. „neu berechnen". */
  aktionen?: ReactNode
  /** Unter den Karten: KI-Hinweis, Konfig-Anzeige, Debug. */
  fuss?: ReactNode
}

export function StoryUebersicht({
  gliederung,
  dokumente,
  themenTitel,
  themenIntro,
  onThemaWaehlen,
  hinweis,
  status,
  aktionen,
  fuss,
}: StoryUebersichtProps) {
  const { t } = useTranslation()
  const themen = gliederung?.topics ?? []
  const fragen = themen.reduce((summe, thema) => summe + thema.questions.length, 0)
  const themenzeile =
    themenTitel ?? (themen.length === 1 ? t('story.uebersicht.themenzeile.one') : t('story.uebersicht.themenzeile.many', { count: themen.length }))

  return (
    <div className="space-y-6" data-story-uebersicht>
      {hinweis}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <Kennzahlen
          werte={[
            { art: 'documents', wert: dokumente },
            ...(gliederung ? [{ art: 'topics' as const, wert: themen.length }, { art: 'questions' as const, wert: fragen }] : []),
          ]}
        />
        {aktionen && <div className="shrink-0">{aktionen}</div>}
      </header>

      {status}

      {gliederung && (
        <section className="space-y-3" aria-label={t('story.topics')}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{themenzeile}</h2>
          {themenIntro && <p className="text-sm text-muted-foreground">{themenIntro}</p>}
          <ul className="grid gap-3 sm:grid-cols-2">
            {themen.map((thema) => (
              <li key={thema.id}>
                <button
                  type="button"
                  onClick={() => onThemaWaehlen(thema.id)}
                  className="group flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="font-medium leading-snug">{thema.title}</span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </span>
                  {thema.summary && <span className="line-clamp-2 text-sm text-muted-foreground">{thema.summary}</span>}
                  <span className="mt-auto text-xs text-muted-foreground tabular-nums">
                    {zaehlerText(t, 'questions', thema.questions.length)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fuss}
    </div>
  )
}
