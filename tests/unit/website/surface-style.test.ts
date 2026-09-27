/**
 * Welle S2 — Flaechen-Stil: Vorlage-Flaechen ohne Werte behalten Klassen,
 * Profil-Flaechen rendern ueber Inline-Farben und Variablen.
 */
import { describe, it, expect } from 'vitest'
import { surfaceStyle } from '@/lib/website/surface-style'
import { OLDIES_THEME, resolveSiteTheme } from '@/lib/website/site-theme'

describe('surfaceStyle', () => {
  it('Vorlage: default/light/dark ueber Tailwind-Klassen (Dark-Mode bleibt)', () => {
    expect(surfaceStyle('default', OLDIES_THEME)).toEqual({ className: 'bg-background text-foreground', prose: '', style: { '--site-tile': 'rgba(0,0,0,0.05)' } })
    expect(surfaceStyle('dark', OLDIES_THEME).prose).toBe('prose-invert')
    expect(surfaceStyle('dark', OLDIES_THEME).style).toEqual({ '--site-tile': 'rgba(255,255,255,0.09)' })
  })

  it('Vorlage: dark-green wie bisher — dunkel, Ueberschrift Linen, Absaetze Mint', () => {
    const s = surfaceStyle('dark-green', OLDIES_THEME)
    expect(s.style).toMatchObject({ backgroundColor: '#005140', color: '#ffffff', '--site-heading': '#ebe4dd', '--site-paragraph': '#6fc5ae', '--site-tile': 'rgba(255,255,255,0.09)' })
    expect(s.prose).toContain('prose-invert')
    expect(s.prose).toContain('[&_p]:text-[color:var(--site-paragraph)]')
  })

  it('Profil: helle Flaeche ohne Absatzfarbe — kein Invert, kein Absatz-Override, Kennzeile = Ueberschriftfarbe', () => {
    const theme = resolveSiteTheme({ accent: '#c85a32', surfaces: { light: { bg: '#f4f1ea', text: '#1c3829', heading: '#1c3829' } } })
    const s = surfaceStyle('light', theme)
    expect(s.className).toBe('')
    expect(s.prose).not.toContain('prose-invert')
    expect(s.prose).not.toContain('--site-paragraph')
    expect(s.style).toMatchObject({ '--site-kicker': '#1c3829' })
  })
})
