// @vitest-environment jsdom

/**
 * `hero_layout: band` — schlankes farbiges Band mit Titel, Kennzeile und
 * Unterzeile (Welle N4). Ohne `hero_image` zeigt der Renderer einen `<header>`
 * mit dem Titel und kein `<img>`; mit `hero_image` liegt das Bild als
 * Hintergrund hinter dem Text. Die erste Sektion folgt darunter.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { WebsiteDetail } from '@/components/library/website-detail'

afterEach(cleanup)

const MARKDOWN = '<!-- section layout=story bg=light placeholder="Frag …" -->\n## Frag einfach drauflos.\n<!-- questions -->\n- Eine Frage?\n<!-- /section -->'

describe('WebsiteDetail hero_layout band', () => {
  it('rendert ein Band mit Titel, Kennzeile und Unterzeile, ohne Bild', () => {
    const { container } = render(
      <WebsiteDetail
        data={{ title: 'Welche Fragen hast du an die Natur?', heroLayout: 'band', heroKicker: 'Umweltarchiv Südtirol', heroSubtitle: 'Einfach fragen, fundiert geantwortet.', markdown: MARKDOWN }}
      />,
    )
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.textContent).toContain('Welche Fragen hast du an die Natur?')
    expect(header?.textContent).toContain('Umweltarchiv Südtirol')
    expect(header?.textContent).toContain('Einfach fragen, fundiert geantwortet.')
    // Ohne hero_image trägt das Band kein Bild.
    expect(container.querySelector('header img')).toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Welche Fragen hast du an die Natur?')
  })

  it('legt ein hero_image als Hintergrund hinter den Text', () => {
    const { container } = render(
      <WebsiteDetail
        data={{ title: 'Welche Fragen hast du an die Natur?', heroLayout: 'band', heroKicker: 'Umweltarchiv Südtirol', heroImageUrl: 'https://example.org/berg.jpg', heroImageAlt: 'Berglandschaft', markdown: MARKDOWN }}
      />,
    )
    const bild = container.querySelector('header img')
    expect(bild?.getAttribute('src')).toBe('https://example.org/berg.jpg')
    expect(bild?.getAttribute('alt')).toBe('Berglandschaft')
    // Das Bild liegt absolut hinter dem Text — das Band wird dadurch nicht höher.
    expect(bild?.className).toContain('absolute')
    expect(container.querySelector('header')?.textContent).toContain('Umweltarchiv Südtirol')
    expect(container.querySelector('h1')?.textContent).toBe('Welche Fragen hast du an die Natur?')
  })
})
