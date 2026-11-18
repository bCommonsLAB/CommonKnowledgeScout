'use client'

/**
 * Block `<!-- popular n=5 -->` der Story-Sektion (Owner 09.11.2026, SFSCON):
 * die meistgestellten Fragen der Library aus dem Fragen-Log, als Chips unter
 * den Beispielfragen. Quelle ist der anonym lesbare Endpunkt
 * `GET /api/chat/<libraryId>/popular-questions?limit=n` (nur Fragetexte und
 * Zaehler). Klick stellt die Frage. Ohne Treffer kein Block; ein Fehler steht
 * im Log, nicht still im Nichts.
 */

import { useEffect, useState } from 'react'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { useTranslation } from '@ks/i18n/react'

export interface PopulaereFrage {
  question: string
  count: number
}

export function usePopulaereFragen(libraryId: string, n: number): PopulaereFrage[] {
  const [fragen, setFragen] = useState<PopulaereFrage[]>([])
  useEffect(() => {
    let abgebrochen = false
    SAME_ORIGIN_API.fetch(`/api/chat/${encodeURIComponent(libraryId)}/popular-questions?limit=${n}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = (await res.json()) as { items?: unknown; error?: unknown }
        if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${res.status}`)
        if (abgebrochen) return
        const items = Array.isArray(json.items) ? json.items : []
        setFragen(items.filter((f): f is PopulaereFrage => typeof f === 'object' && f !== null && typeof (f as PopulaereFrage).question === 'string'))
      })
      .catch((e: unknown) => console.error('[usePopulaereFragen] Populaere Fragen nicht ladbar', e))
    return () => { abgebrochen = true }
  }, [libraryId, n])
  return fragen
}

export interface StoryPopulaereFragenProps {
  libraryId: string
  n: number
  onFrage: (frage: string) => void
  gesperrt?: boolean
}

export function StoryPopulaereFragen({ libraryId, n, onFrage, gesperrt }: StoryPopulaereFragenProps) {
  const { t } = useTranslation()
  const fragen = usePopulaereFragen(libraryId, n)
  if (fragen.length === 0) return null
  return (
    <div className="not-prose mt-5" data-story-populaer={fragen.length}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--site-accent-strong)] font-[family-name:var(--site-font-kicker)]">
        {t('website.story.populaer')}
      </p>
      <div className="flex flex-wrap gap-2">
        {fragen.map((f) => (
          <button
            key={f.question}
            type="button"
            disabled={gesperrt}
            onClick={() => onFrage(f.question)}
            title={t('website.story.populaerZaehler', { count: f.count })}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-left text-sm text-neutral-800 transition-colors hover:border-[color:var(--site-accent)] hover:bg-[color:color-mix(in_srgb,var(--site-accent)_8%,white)] disabled:opacity-60"
          >
            {f.question}
          </button>
        ))}
      </div>
    </div>
  )
}
