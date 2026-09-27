/**
 * Design-Profil der Website (Welle S2): pruefen und aufloesen.
 *
 * `validiereSiteTheme` prueft ein Profil aus Formular oder Bruecke und wirft
 * bei jedem unbekannten Feld, jeder Nicht-Hex-Farbe und jeder unregistrierten
 * Schrift (kein stilles Verwerfen). `resolveSiteTheme` fuellt ein Profil zum
 * vollstaendigen Satz auf — Vorgabe ist die Vorlage „Oldies for Future", damit
 * eine Library ohne Profil unveraendert rendert. Flaechen ohne Farbwerte
 * (`null`) rendern weiter ueber die Tailwind-Klassen der Vorlage
 * (`surface-style.ts`), so bleiben `default/light/dark` Dark-Mode-faehig.
 */

import {
  SITE_BUTTON_SHAPES, SITE_FONT_NAMES, SITE_SURFACES,
  type SiteButtonShape, type SiteFontName, type SiteSurface, type SiteSurfaceName, type SiteTheme,
} from '@ks/contracts'

const HEX_RE = /^#[0-9a-f]{6}$/i
const THEME_KEYS = ['fontHeading', 'fontBody', 'accent', 'accentHover', 'accentText', 'buttonShape', 'surfaces'] as const
const SURFACE_KEYS = ['bg', 'text', 'heading', 'paragraph', 'kicker'] as const

export interface SiteThemeResolved {
  fontHeading: SiteFontName
  fontBody: SiteFontName
  accent: string
  accentHover: string
  accentText: string
  /** Kraeftiger Akzent fuer Banner-Buttons (Vorlage: emerald-700/800); ohne Profil-Wert = Akzent. */
  accentStrong: string
  accentStrongHover: string
  buttonShape: SiteButtonShape
  surfaces: Record<SiteSurfaceName, SiteSurface | null>
}

/** Die Vorlage (Steckbrief 10) — bis Welle S2 fest in `website-landing-blocks.tsx`. */
export const OLDIES_THEME: SiteThemeResolved = {
  fontHeading: 'geist',
  fontBody: 'geist',
  accent: '#059669',
  accentHover: '#10b981',
  accentText: '#ffffff',
  accentStrong: '#047857',
  accentStrongHover: '#065f46',
  buttonShape: 'pill',
  surfaces: {
    default: null,
    light: null,
    dark: null,
    brand: { bg: '#006b55', text: '#ffffff', heading: '#ebe4dd', paragraph: '#6fc5ae' },
    linen: { bg: '#ebe4dd', text: '#202020', heading: '#16ad8c' },
    mint: { bg: '#6fc5ae', text: '#0b3a30', heading: '#ffffff', paragraph: '#0b3a30' },
    'dark-green': { bg: '#005140', text: '#ffffff', heading: '#ebe4dd', paragraph: '#6fc5ae' },
    neutral: { bg: '#bfc9c3', text: '#202020', heading: '#005140' },
  },
}

function farbe(wert: unknown, feld: string): string {
  if (typeof wert !== 'string' || !HEX_RE.test(wert)) {
    throw new Error(`siteTheme: "${feld}" ist kein Hex-Farbwert (#rrggbb): ${JSON.stringify(wert)}`)
  }
  return wert.toLowerCase()
}

function schrift(wert: unknown, feld: string): SiteFontName {
  if (typeof wert !== 'string' || !(SITE_FONT_NAMES as readonly string[]).includes(wert)) {
    throw new Error(`siteTheme: Schrift "${String(wert)}" fuer "${feld}" ist nicht registriert. Registriert: ${SITE_FONT_NAMES.join(', ')}`)
  }
  return wert as SiteFontName
}

function flaeche(name: string, wert: unknown): SiteSurface {
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) throw new Error(`siteTheme: Flaeche "${name}" muss ein Objekt sein`)
  const roh = wert as Record<string, unknown>
  for (const key of Object.keys(roh)) {
    if (!(SURFACE_KEYS as readonly string[]).includes(key)) {
      throw new Error(`siteTheme: Unbekanntes Feld "${key}" in Flaeche "${name}". Erlaubt: ${SURFACE_KEYS.join(', ')}`)
    }
  }
  const s: SiteSurface = { bg: farbe(roh.bg, `surfaces.${name}.bg`), text: farbe(roh.text, `surfaces.${name}.text`) }
  for (const key of ['heading', 'paragraph', 'kicker'] as const) {
    if (roh[key] !== undefined) s[key] = farbe(roh[key], `surfaces.${name}.${key}`)
  }
  return s
}

/** Prueft ein Profil vollstaendig und liefert es normalisiert (Farben klein). Wirft bei jedem Fehler. */
export function validiereSiteTheme(wert: unknown): SiteTheme {
  if (!wert || typeof wert !== 'object' || Array.isArray(wert)) throw new Error('siteTheme muss ein Objekt sein')
  const roh = wert as Record<string, unknown>
  for (const key of Object.keys(roh)) {
    if (!(THEME_KEYS as readonly string[]).includes(key)) {
      throw new Error(`siteTheme: Unbekanntes Feld "${key}". Erlaubt: ${THEME_KEYS.join(', ')}`)
    }
  }
  const theme: SiteTheme = {}
  if (roh.fontHeading !== undefined) theme.fontHeading = schrift(roh.fontHeading, 'fontHeading')
  if (roh.fontBody !== undefined) theme.fontBody = schrift(roh.fontBody, 'fontBody')
  for (const key of ['accent', 'accentHover', 'accentText'] as const) {
    if (roh[key] !== undefined) theme[key] = farbe(roh[key], key)
  }
  if (roh.buttonShape !== undefined) {
    if (typeof roh.buttonShape !== 'string' || !(SITE_BUTTON_SHAPES as readonly string[]).includes(roh.buttonShape)) {
      throw new Error(`siteTheme: buttonShape "${String(roh.buttonShape)}" unbekannt. Erlaubt: ${SITE_BUTTON_SHAPES.join(', ')}`)
    }
    theme.buttonShape = roh.buttonShape as SiteButtonShape
  }
  if (roh.surfaces !== undefined) {
    if (!roh.surfaces || typeof roh.surfaces !== 'object' || Array.isArray(roh.surfaces)) throw new Error('siteTheme: "surfaces" muss ein Objekt sein')
    const surfaces: Partial<Record<SiteSurfaceName, SiteSurface>> = {}
    for (const [name, s] of Object.entries(roh.surfaces as Record<string, unknown>)) {
      if (!(SITE_SURFACES as readonly string[]).includes(name)) {
        throw new Error(`siteTheme: Unbekannte Flaeche "${name}". Erlaubt: ${SITE_SURFACES.join(', ')}`)
      }
      surfaces[name as SiteSurfaceName] = flaeche(name, s)
    }
    theme.surfaces = surfaces
  }
  return theme
}

/** Relative Luminanz < 0.4 gilt als dunkel (helle Schrift, `prose-invert`). */
export function istDunkel(hex: string): boolean {
  const n = parseInt(hex.slice(1, 7), 16)
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return l < 0.4
}

/**
 * Profil zum vollstaendigen Satz aufloesen. Ein gespeichertes Profil, das die
 * Pruefung nicht besteht, wird laut gemeldet und die Vorlage gerendert — die
 * oeffentliche Seite darf daran nicht sterben.
 */
export function resolveSiteTheme(theme: SiteTheme | undefined): SiteThemeResolved {
  if (!theme) return OLDIES_THEME
  let t: SiteTheme
  try {
    t = validiereSiteTheme(theme)
  } catch (error) {
    console.error(`[site-theme] Gespeichertes Profil ungueltig, Vorlage wird gerendert: ${error instanceof Error ? error.message : String(error)}`)
    return OLDIES_THEME
  }
  const accent = t.accent ?? OLDIES_THEME.accent
  const eigenerAkzent = t.accent !== undefined
  return {
    fontHeading: t.fontHeading ?? OLDIES_THEME.fontHeading,
    fontBody: t.fontBody ?? OLDIES_THEME.fontBody,
    accent,
    accentHover: t.accentHover ?? (eigenerAkzent ? `color-mix(in srgb, ${accent} 86%, black)` : OLDIES_THEME.accentHover),
    accentText: t.accentText ?? OLDIES_THEME.accentText,
    accentStrong: eigenerAkzent ? accent : OLDIES_THEME.accentStrong,
    accentStrongHover: eigenerAkzent ? (t.accentHover ?? `color-mix(in srgb, ${accent} 86%, black)`) : OLDIES_THEME.accentStrongHover,
    buttonShape: t.buttonShape ?? OLDIES_THEME.buttonShape,
    surfaces: { ...OLDIES_THEME.surfaces, ...(t.surfaces ?? {}) },
  }
}

/**
 * CSS-Variablen fuer den Wrapper der Landingpage. `familien` kommt aus
 * `site-fonts.ts` (next/font) und fehlt in der Archiv-Vorschau — dann bleiben
 * die Schrift-Variablen ungesetzt und die Ueberschriften erben die App-Schrift.
 */
export function siteThemeCssVars(r: SiteThemeResolved, familien?: Record<SiteFontName, string>): Record<string, string> {
  const vars: Record<string, string> = {
    '--site-accent': r.accent,
    '--site-accent-hover': r.accentHover,
    '--site-accent-text': r.accentText,
    '--site-accent-strong': r.accentStrong,
    '--site-accent-strong-hover': r.accentStrongHover,
    '--site-kicker': r.accent,
    '--site-radius': r.buttonShape === 'pill' ? '9999px' : '0.5rem',
  }
  if (familien) {
    vars['--site-font-heading'] = familien[r.fontHeading]
    vars['--site-font-body'] = familien[r.fontBody]
  }
  return vars
}
