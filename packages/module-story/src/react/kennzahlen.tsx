'use client'

/**
 * Generische Zaehler des Story-Modus: „n Dokumente · n Themen · n Fragen".
 *
 * Nur Generisches (Plan, Tafel „Generisch oder library-spezifisch"):
 * Status-Zaehler wie „in Umsetzung" sind library-spezifisch und bleiben den
 * Facetten rechts vorbehalten (Owner 01.10.).
 */

import { useTranslation } from '@ks/i18n/react'

export type KennzahlArt = 'documents' | 'topics' | 'questions'

export interface Kennzahl {
  art: KennzahlArt
  wert: number
}

type Uebersetzer = (key: string, params?: Record<string, string | number>) => string

/** Ein-/Mehrzahl ueber zwei Schluessel — die i18n-Schicht kennt keine Pluralregeln. */
export function zaehlerText(t: Uebersetzer, art: KennzahlArt, wert: number): string {
  return wert === 1 ? t(`story.count.${art}.one`) : t(`story.count.${art}.many`, { count: wert })
}

export function Kennzahlen({ werte, className }: { werte: Kennzahl[]; className?: string }) {
  const { t } = useTranslation()
  if (werte.length === 0) return null
  return (
    <p className={className ?? 'text-sm text-muted-foreground'}>
      {werte.map((k, i) => (
        <span key={k.art}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <span className="tabular-nums">{zaehlerText(t, k.art, k.wert)}</span>
        </span>
      ))}
    </p>
  )
}
