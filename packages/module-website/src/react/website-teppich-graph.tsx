'use client'

/**
 * Bedienteile der Graph-Ansicht (Owner 24.11.2026: „wie eine fliegende Seite, die man wieder
 * schliessen kann"): die Kopfzeile mit Schliessen-Knopf und Zoom, und die Karte zum gewaehlten
 * Dokument. Die Ansicht selbst — Leinwand, Zoom, Verschieben — liegt in `website-teppich.tsx`.
 */

import * as React from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { useTranslation } from '@ks/i18n/react'
import type { TeppichPunkt } from '..'

const KNOPF = 'flex h-11 w-11 items-center justify-center rounded-full border border-current/20 bg-white/70 text-neutral-900 hover:bg-white'

export function TeppichGraphKopf({ onZu, onZoom }: { onZu: () => void; onZoom: (faktor: number) => void }): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6" data-teppich-graph-kopf>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold">{t('website.story.graphTitel')}</p>
        <p className="truncate text-xs opacity-70">{t('website.story.graphHinweis')}</p>
      </div>
      <button type="button" className={KNOPF} onClick={() => onZoom(1 / 1.5)} aria-label={t('website.story.graphKleiner')} title={t('website.story.graphKleiner')}><Minus className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" className={KNOPF} onClick={() => onZoom(1.5)} aria-label={t('website.story.graphGroesser')} title={t('website.story.graphGroesser')}><Plus className="h-4 w-4" aria-hidden="true" /></button>
      <button type="button" className={KNOPF} onClick={onZu} aria-label={t('website.story.graphZu')} title={t('website.story.graphZu')} data-teppich-graph-zu><X className="h-5 w-5" aria-hidden="true" /></button>
    </div>
  )
}

/** Das gewaehlte Dokument: Titel, Jahr, Zahl der Nachbarn — und der Weg zum Dokument. */
export function TeppichGraphKarte({ punkt, onOeffnen, onZu }: { punkt: TeppichPunkt; onOeffnen: () => void; onZu: () => void }): React.ReactElement {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-black/10 bg-white p-4 text-neutral-900 shadow-lg sm:left-auto sm:right-6 sm:w-96 mb-[env(safe-area-inset-bottom)]" data-teppich-graph-karte>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug">{punkt.titel}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {punkt.jahr !== null && <span>{punkt.jahr} · </span>}
            {t('website.story.graphNachbarn', { count: punkt.nachbarn.length })}
          </p>
        </div>
        <button type="button" onClick={onZu} aria-label={t('website.story.graphAbwaehlen')} className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <button type="button" onClick={onOeffnen} className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-semibold text-white" data-teppich-graph-oeffnen>
        {t('website.story.graphOeffnen')}
      </button>
    </div>
  )
}
