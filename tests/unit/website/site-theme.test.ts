/**
 * Welle S2 — Design-Profil: Pruefung wirft laut, Aufloesung faellt auf die
 * Vorlage zurueck, CSS-Variablen tragen die Werte.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { OLDIES_THEME, istDunkel, resolveSiteTheme, siteThemeCssVars, validiereSiteTheme } from '@/lib/website/site-theme'

const FAMILIEN = { geist: 'Geist', newsreader: 'Newsreader', 'plus-jakarta': 'Jakarta' }

afterEach(() => vi.restoreAllMocks())

describe('validiereSiteTheme', () => {
  it('nimmt ein vollstaendiges Profil an und normalisiert Farben', () => {
    const t = validiereSiteTheme({
      fontHeading: 'newsreader', fontBody: 'plus-jakarta', accent: '#C85A32', buttonShape: 'rounded',
      surfaces: { 'dark-green': { bg: '#1C3829', text: '#F4F6F4', kicker: '#9CC5A1' } },
    })
    expect(t.accent).toBe('#c85a32')
    expect(t.surfaces?.['dark-green']).toEqual({ bg: '#1c3829', text: '#f4f6f4', kicker: '#9cc5a1' })
  })

  it('weist unbekannte Felder, Schriften, Flaechen und Nicht-Hex-Farben ab', () => {
    expect(() => validiereSiteTheme({ farbe: '#000000' })).toThrow(/Unbekanntes Feld "farbe"/)
    expect(() => validiereSiteTheme({ fontHeading: 'comic' })).toThrow(/Schrift "comic".*nicht registriert/)
    expect(() => validiereSiteTheme({ surfaces: { petrol: { bg: '#224851', text: '#ffffff' } } })).toThrow(/Unbekannte Flaeche "petrol"/)
    expect(() => validiereSiteTheme({ accent: 'red' })).toThrow(/"accent" ist kein Hex-Farbwert/)
    expect(() => validiereSiteTheme({ surfaces: { light: { bg: '#f4f1ea' } } })).toThrow(/surfaces.light.text/)
    expect(() => validiereSiteTheme({ surfaces: { light: { bg: '#f4f1ea', text: '#000000', rand: '#000000' } } })).toThrow(/Unbekanntes Feld "rand" in Flaeche "light"/)
    expect(() => validiereSiteTheme('oldies')).toThrow(/muss ein Objekt sein/)
    expect(() => validiereSiteTheme({ buttonShape: 'square' })).toThrow(/buttonShape "square"/)
  })
})

describe('resolveSiteTheme', () => {
  it('ohne Profil: die Vorlage, unveraendert', () => {
    expect(resolveSiteTheme(undefined)).toBe(OLDIES_THEME)
    expect(OLDIES_THEME.surfaces.default).toBeNull()
    expect(OLDIES_THEME.surfaces['dark-green']).toEqual({ bg: '#005140', text: '#ffffff', heading: '#ebe4dd', paragraph: '#6fc5ae' })
  })

  it('ein Teilprofil ueberschreibt nur genannte Flaechen; eigener Akzent gilt auch fuer Banner-Buttons', () => {
    const r = resolveSiteTheme({ accent: '#c85a32', surfaces: { light: { bg: '#f4f1ea', text: '#1c3829' } } })
    expect(r.surfaces.light).toEqual({ bg: '#f4f1ea', text: '#1c3829' })
    expect(r.surfaces.linen).toEqual(OLDIES_THEME.surfaces.linen)
    expect(r.accentStrong).toBe('#c85a32')
    expect(r.accentHover).toMatch(/color-mix/)
    expect(r.fontHeading).toBe('geist')
  })

  it('ein ungueltiges gespeichertes Profil wird laut gemeldet, die Vorlage gerendert', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(resolveSiteTheme({ accent: 'lila' })).toBe(OLDIES_THEME)
    expect(String(fehler.mock.calls[0][0])).toMatch(/Gespeichertes Profil ungueltig/)
  })
})

describe('istDunkel', () => {
  it('trennt helle und dunkle Flaechen', () => {
    expect(istDunkel('#1c3829')).toBe(true)
    expect(istDunkel('#006b55')).toBe(true)
    expect(istDunkel('#6fc5ae')).toBe(false)
    expect(istDunkel('#faf8f5')).toBe(false)
  })
})

describe('siteThemeCssVars', () => {
  it('traegt Akzent, Radius und Schriftfamilien', () => {
    const vars = siteThemeCssVars(resolveSiteTheme({ fontHeading: 'newsreader', buttonShape: 'rounded' }), FAMILIEN)
    expect(vars['--site-font-heading']).toBe('Newsreader')
    expect(vars['--site-font-body']).toBe('Geist')
    expect(vars['--site-radius']).toBe('0.5rem')
    expect(vars['--site-accent']).toBe('#059669')
  })
})
