'use client'

/**
 * Mitte beim Einstieg: Kennzahlen, Kopf der Gliederung, eine Karte je Thema.
 *
 * Seit D10 steht der Kopf des Inhalts (Titel, Zweizeiler der Library) NICHT
 * mehr hier, sondern im Kopf der Seite (Gastgeber). Vor den Karten steht der
 * Kopf der Gliederung, den das Sprachmodell mitliefert (Titel und
 * Einleitung — Owner 02.10.: „das war vorher besser"), darunter eine kurze
 * Themenzeile mit Zahl („7 Themen · waehle eines"); die Konfig
 * (`story.topicsTitle`/`topicsIntro`) darf sie ersetzen bzw. ergaenzen.
 * Was das Paket nicht kennt, kommt als Slot: Rechen-Status, Aktionen (neu
 * berechnen) und der Fuss (KI-Hinweis, Konfig-Anzeige).
 */

import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import type { StoryTopicsData } from '@ks/contracts'
import { Kennzahlen, zaehlerText } from './kennzahlen'

export interface StoryUebersichtProps {
  /** `null`, solange die Themenuebersicht noch berechnet wird. */
  gliederung: StoryTopicsData | null
  /** `null`, solange der Bestand noch laedt — dann fehlt die Kennzahl statt „0 Dokumente" (D12x). */
  dokumente: number | null
  /** D12o: gesetzter Filter als Chips, neben den Kennzahlen. */
  filterAnzeige?: ReactNode
  /** Ueberschrift ueber den Karten (Konfig `story.topicsTitle`); sonst die Themenzeile mit Zahl. */
  themenTitel?: string
  /** Einleitung zu den Karten (Konfig `story.topicsIntro`); ohne Konfig keine. */
  themenIntro?: string
  onThemaWaehlen: (themaId: string) => void
  /** Rechen-Status, solange keine Gliederung da ist (oder sie neu entsteht). */
  status?: ReactNode
  /** Aktionen rechts neben den Kennzahlen, z. B. „neu berechnen". */
  aktionen?: ReactNode
  /** Unter den Karten: KI-Hinweis, Konfig-Anzeige, Debug. */
  fuss?: ReactNode
}

export function StoryUebersicht({ gliederung, dokumente, filterAnzeige, themenTitel, themenIntro, onThemaWaehlen, status, aktionen, fuss }: StoryUebersichtProps) {
  const { t } = useTranslation()
  const themen = gliederung?.topics ?? []
  const fragen = themen.reduce((summe, thema) => summe + thema.questions.length, 0)
  const themenzeile =
    themenTitel ?? (themen.length === 1 ? t('story.uebersicht.themenzeile.one') : t('story.uebersicht.themenzeile.many', { count: themen.length }))

  return (
    <div className="space-y-6" data-story-uebersicht>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <Kennzahlen
            werte={[
              ...(dokumente === null ? [] : [{ art: 'documents' as const, wert: dokumente }]),
              ...(gliederung ? [{ art: 'topics' as const, wert: themen.length }, { art: 'questions' as const, wert: fragen }] : []),
            ]}
          />
          {filterAnzeige}
        </div>
        {aktionen && <div className="shrink-0">{aktionen}</div>}
      </header>

      {status}

      {gliederung && (
        <section className="space-y-3" aria-label={t('story.topics')}>
          {/* Kopf der Gliederung: Titel und Einleitung des Sprachmodells (D10b) */}
          {gliederung.title && <h2 className="text-lg font-semibold leading-snug">{gliederung.title}</h2>}
          {gliederung.intro && <p className="text-sm leading-relaxed text-muted-foreground">{gliederung.intro}</p>}
          <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{themenzeile}</h3>
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
