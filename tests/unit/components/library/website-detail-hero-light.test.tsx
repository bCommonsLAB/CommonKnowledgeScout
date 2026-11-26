// @vitest-environment jsdom

/**
 * `hero_tone: light` (26.11.2026) — Standard-Kopf mit Bild ohne Schleier:
 * Text als echter Text (markierbar), Bild rechts ausgerichtet, der
 * Handlungsaufruf als Balken; ohne `cta_url` eine Kennzeile ohne Link.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { WebsiteDetail } from '@ks/module-website/react'

afterEach(cleanup)

const BASIS = {
  title: 'start.klar.',
  heroSubtitle: 'Impulse. Perspektiven. Neue Denkweisen.',
  heroImageUrl: 'https://example.org/hero.jpg',
  ctaLabel: 'Vorträge und Dialoge',
}

describe('WebsiteDetail hero_tone light', () => {
  it('rendert ohne Schleier, linksbuendig, Bild am rechten Rand', () => {
    const { container } = render(<WebsiteDetail data={{ ...BASIS, heroTone: 'light', ctaUrl: 'https://example.org/programm' }} />)
    const header = container.querySelector('header')
    expect(header?.querySelector('[class*="bg-black"]')).toBeNull()
    expect(header?.innerHTML).not.toContain('text-center')
    expect((header?.querySelector('img') as HTMLImageElement).style.objectPosition).toBe('100% 50%')
    const h1 = header?.querySelector('h1')
    expect(h1?.textContent).toBe('start.klar.')
    expect(h1?.className).toContain('text-[color:var(--site-accent)]')
    expect(h1?.className).toContain('font-bold')
    expect(header?.textContent).toContain('Impulse. Perspektiven. Neue Denkweisen.')
    const link = header?.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://example.org/programm')
    expect(link?.className).toContain('bg-[color:var(--site-accent)]')
    expect(link?.className).not.toContain('rounded')
  })

  it('ohne cta_url bleibt der Balken eine Kennzeile ohne Link', () => {
    const { container } = render(<WebsiteDetail data={{ ...BASIS, heroTone: 'light' }} />)
    const header = container.querySelector('header')
    expect(header?.querySelector('a')).toBeNull()
    expect(header?.textContent).toContain('Vorträge und Dialoge')
  })

  it('uebernimmt die Hoehe aus hero_image_position und die Textfarbe der Flaeche default', () => {
    const { container } = render(<WebsiteDetail data={{ ...BASIS, heroTone: 'light', heroImagePosition: '50% 0%' }} />)
    expect((container.querySelector('header img') as HTMLImageElement).style.objectPosition).toBe('100% 0%')
    // Vorlage ohne Farbwerte fuer `default`: feste helle Flaeche, nicht der Dark-Mode der App.
    expect(container.querySelector('header')?.className).toContain('text-neutral-900')
  })

  it('ohne hero_tone bleibt der dunkle Kopf (Schleier, zentriert, Knopf nur mit cta_url)', () => {
    const { container } = render(<WebsiteDetail data={{ ...BASIS }} />)
    const header = container.querySelector('header')
    expect(header?.querySelector('[class*="bg-black"]')).not.toBeNull()
    expect(header?.innerHTML).toContain('text-center')
    expect(header?.textContent).not.toContain('Vorträge und Dialoge')
  })
})
