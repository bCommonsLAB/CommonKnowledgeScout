/**
 * Flaechen-Stil einer Sektion aus dem aufgeloesten Design-Profil (Welle S2).
 *
 * Bis S2 stand die Tabelle `SECTION_STYLE` mit festen Hex-Klassen in
 * `website-landing-blocks.tsx`. Jetzt: Flaechen mit Farbwerten im Profil
 * rendern ueber Inline-Farben und CSS-Variablen; Flaechen ohne Werte
 * (`null`, in der Vorlage `default/light/dark`) behalten ihre Tailwind-Klassen
 * und damit den Dark-Mode der App. Dazu die gemeinsamen Klassen fuer Buttons,
 * Kennzeile und Ueberschriften-Schrift — alle ueber die Variablen, die
 * `siteThemeCssVars` setzt.
 */

import type { CSSProperties } from 'react'
import type { SiteSurfaceName } from '@ks/contracts'
import { cn } from '@/lib/utils'
import { istDunkel, type SiteThemeResolved } from './site-theme'

export interface SurfaceStyle {
  className: string
  style?: CSSProperties
  /** Zusaetzliche `prose`-Klassen (Invert, Ueberschrift- und Absatzfarbe). */
  prose: string
}

/** Klassen der Vorlage fuer Flaechen ohne Farbwerte (Dark-Mode-faehig). */
const KLASSEN: Partial<Record<SiteSurfaceName, { wrapper: string; prose: string }>> = {
  default: { wrapper: 'bg-background text-foreground', prose: '' },
  light: { wrapper: 'bg-muted text-foreground', prose: '' },
  dark: { wrapper: 'bg-slate-900 text-slate-50', prose: 'prose-invert' },
}

export function surfaceStyle(bg: SiteSurfaceName, theme: SiteThemeResolved): SurfaceStyle {
  const s = theme.surfaces[bg]
  if (!s) {
    const k = KLASSEN[bg]
    if (!k) throw new Error(`Flaeche "${bg}" hat weder Farben im Profil noch Klassen der Vorlage`)
    return { className: k.wrapper, prose: k.prose }
  }
  const vars: Record<string, string> = {
    backgroundColor: s.bg,
    color: s.text,
    '--site-text': s.text,
    '--site-heading': s.heading ?? s.text,
    '--site-paragraph': s.paragraph ?? s.text,
    // Kennzeile ohne eigenen Wert: Ueberschriftfarbe der Flaeche, nicht der Akzent —
    // der Akzent kann auf einer farbigen Flaeche unlesbar sein (Befund 27.09.).
    '--site-kicker': s.kicker ?? s.heading ?? s.text,
  }
  return {
    className: '',
    style: vars as CSSProperties,
    prose: cn(
      istDunkel(s.bg) && 'prose-invert',
      'prose-headings:text-[color:var(--site-heading)]',
      s.paragraph && '[&_p]:text-[color:var(--site-paragraph)]',
    ),
  }
}

/** Primaerer Button (Hero-CTA, Formular): Akzent. Vorlage: emerald-600/500, Pille. */
export const BUTTON_PRIMARY =
  'inline-block rounded-[var(--site-radius)] bg-[color:var(--site-accent)] px-6 py-3 font-medium text-[color:var(--site-accent-text)] transition-colors hover:bg-[color:var(--site-accent-hover)]'
/** Kraeftiger Button (Banner-Raster). Vorlage: emerald-700/800. */
export const BUTTON_STRONG =
  'inline-block rounded-[var(--site-radius)] bg-[color:var(--site-accent-strong)] px-6 py-3 text-sm font-medium text-[color:var(--site-accent-text)] shadow-sm transition-colors hover:bg-[color:var(--site-accent-strong-hover)]'
/** Zweiter Handlungsaufruf im Hero `campaign`: hell mit feinem Rand. */
export const BUTTON_SECONDARY =
  'inline-block rounded-[var(--site-radius)] border border-black/10 bg-white px-6 py-3 font-medium text-neutral-800 transition-colors hover:bg-neutral-100'
/** Kennzeile: kleine Versalzeile ueber der Ueberschrift (`kicker=`, `hero_kicker`). */
export const KICKER_CLASS = 'mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--site-kicker)]'
/** Ueberschriften-Schrift aus dem Profil (ohne Profil: erbt, also die App-Schrift). */
export const HEADING_FONT = 'font-[family-name:var(--site-font-heading)]'
