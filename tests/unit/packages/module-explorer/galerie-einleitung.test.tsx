// @vitest-environment jsdom

/** G2: Einleitungs-Band aus den Galerie-Texten; leer = nichts. */
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { GalerieEinleitung } from '@ks/module-explorer/gallery/components/galerie-einleitung'

describe('GalerieEinleitung', () => {
  afterEach(() => cleanup())

  it('zeigt Kennzeile, Titel und Erklaerung', () => {
    render(<GalerieEinleitung texte={{ headline: '36 Maßnahmen im Fokus', subtitle: 'Maßnahmen im Fokus', description: 'Ein Stern heißt …' }} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('36 Maßnahmen im Fokus')
    expect(screen.getByText('Maßnahmen im Fokus')).toBeTruthy()
    expect(screen.getByText('Ein Stern heißt …')).toBeTruthy()
  })

  it('ohne Titel und Erklaerung rendert nichts', () => {
    const { container } = render(<GalerieEinleitung texte={{ headline: ' ', subtitle: 'x', description: '' }} />)
    expect(container.innerHTML).toBe('')
  })
})
