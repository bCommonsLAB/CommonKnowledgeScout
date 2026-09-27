/**
 * @fileoverview Design-Profil einer Website-Landingpage (Welle S2).
 *
 * @description
 * Bis Welle S2 war die Gestaltung der Landingpage fest verdrahtet: die acht
 * Hintergrundwerte der Sektionen, die Farben des Cover-Heros, die Buttons und
 * die Schrift stammten alle aus der Vorlage „Oldies for Future" (Steckbrief
 * 10) und galten fuer jede Library mit `siteEnabled`. Das Profil trennt das:
 * die Stellschrauben stehen im Code (CSS-Variablen und registrierte
 * Schriften), die WERTE stehen je Library in `publicPublishing.siteTheme`.
 * Fehlt das Profil oder ein Teil davon, gelten die Vorgaben der Vorlage —
 * eine Library ohne Profil rendert unveraendert.
 *
 * Schriften sind der eine Teil, der im Code bleiben muss (sie werden ueber
 * `next/font` gebuendelt); das Profil waehlt sie per Name aus `SITE_FONT_NAMES`.
 * Farben sind Hex-Werte `#rrggbb`, geprueft in `src/lib/website/site-theme.ts`.
 *
 * @module contracts/site-theme
 */

/** Hintergrund-Flaechen einer Sektion (`bg=` im Sektions-Marker). */
export const SITE_SURFACES = [
  'default',
  'light',
  'dark',
  'brand',
  'linen',
  'mint',
  'dark-green',
  'neutral',
] as const
export type SiteSurfaceName = (typeof SITE_SURFACES)[number]

/** Im Code registrierte Schriften (siehe `src/lib/website/site-fonts.ts`). */
export const SITE_FONT_NAMES = ['geist', 'newsreader', 'plus-jakarta'] as const
export type SiteFontName = (typeof SITE_FONT_NAMES)[number]

/** Buttonform: Pille (Vorlage) oder leicht gerundet. */
export const SITE_BUTTON_SHAPES = ['pill', 'rounded'] as const
export type SiteButtonShape = (typeof SITE_BUTTON_SHAPES)[number]

/** Farben einer Flaeche. Alles Hex `#rrggbb`. */
export interface SiteSurface {
  /** Hintergrund der Sektion. */
  bg: string
  /** Fliesstext. */
  text: string
  /** Ueberschriften; fehlt = Fliesstextfarbe. */
  heading?: string
  /** Absaetze, wenn sie vom Fliesstext abweichen (Vorlage: Mint auf Dunkelgruen). */
  paragraph?: string
  /** Kennzeile ueber der Ueberschrift (`kicker=`); fehlt = Akzentfarbe. */
  kicker?: string
}

/**
 * Das Profil, wie es in der Library-Konfiguration liegt. Jedes Feld ist
 * optional; was fehlt, kommt aus der Vorlage.
 */
export interface SiteTheme {
  /** Schrift der Ueberschriften (Hero-Titel, H1–H4, Banner-Titel). */
  fontHeading?: SiteFontName
  /** Schrift des Fliesstexts. */
  fontBody?: SiteFontName
  /** Akzent: primaere Buttons, Links, Kennzeilen. */
  accent?: string
  /** Akzent im Hover; fehlt = leicht abgedunkelter Akzent. */
  accentHover?: string
  /** Text auf dem Akzent. */
  accentText?: string
  buttonShape?: SiteButtonShape
  /** Farben je Flaeche; nur genannte Flaechen weichen von der Vorlage ab. */
  surfaces?: Partial<Record<SiteSurfaceName, SiteSurface>>
}
