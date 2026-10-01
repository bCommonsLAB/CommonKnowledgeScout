'use client'

/**
 * Mitte beim Einstieg: Kopf des Ganzen, dann eine Karte je Thema.
 *
 * Kopf = Titel, Kurzbeschreibung (Konfig aus publicPublishing; fehlt die
 * Beschreibung, faellt der Block weg) und generische Zaehler. Karten = Thema
 * mit einem Satz und „n Fragen"; Klick waehlt das Thema (Gliederung links
 * klappt auf). Was das Paket nicht kennt, kommt als Slot: der Rechen-Status
 * waehrend die Uebersicht entsteht, die Aktionen am Kopf (neu berechnen) und
 * der Fuss (KI-Hinweis, Konfig-Anzeige).
 */

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import { Kennzahlen, zaehlerText } from './kennzahlen'
import type { StoryKopf } from './types'

export interface StoryUebersichtProps {
  kopf: StoryKopf
  /** `null`, solange die Themenuebersicht noch berechnet wird. */
  gliederung: StoryTopicsData | null
  dokumente: number
  /** Ueberschrift ueber den Karten (Konfig `story.topicsTitle`); sonst der Titel der Gliederung. */
  themenTitel?: string
  /** Einleitung zu den Karten (Konfig `story.topicsIntro`); sonst die Einleitung der Gliederung. */
  themenIntro?: string
  onThemaWaehlen: (themaId: string) => void
  /** Rechen-Status, solange keine Gliederung da ist (oder sie neu entsteht). */
  status?: ReactNode
  /** Aktionen rechts im Kopf, z. B. „neu berechnen". */
  aktionen?: ReactNode
  /** Unter den Karten: KI-Hinweis, Konfig-Anzeige, Debug. */
  fuss?: ReactNode
}

export function StoryUebersicht({
  kopf,
  gliederung,
  dokumente,
  themenTitel,
  themenIntro,
  onThemaWaehlen,
  status,
  aktionen,
  fuss,
}: StoryUebersichtProps) {
  const { t } = useTranslation()
  const themen = gliederung?.topics ?? []
  const fragen = themen.reduce((summe, thema) => summe + thema.questions.length, 0)
  const titelDerThemen = themenTitel ?? gliederung?.title
  const introDerThemen = themenIntro ?? gliederung?.intro

  return (
    <div className="space-y-6" data-story-uebersicht>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold leading-tight">{kopf.titel}</h1>
          {aktionen && <div className="shrink-0">{aktionen}</div>}
        </div>
        {kopf.beschreibung && (
          <p className="line-clamp-3 text-base leading-relaxed text-muted-foreground">{kopf.beschreibung}</p>
        )}
        <Kennzahlen
          werte={[
            { art: 'documents', wert: dokumente },
            ...(gliederung ? [{ art: 'topics' as const, wert: themen.length }, { art: 'questions' as const, wert: fragen }] : []),
          ]}
        />
      </header>

      {status}

      {gliederung && (
        <section className="space-y-3" aria-label={t('story.topics')}>
          {titelDerThemen && <h2 className="text-lg font-semibold">{titelDerThemen}</h2>}
          {introDerThemen && <p className="text-sm text-muted-foreground">{introDerThemen}</p>}
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
