// @vitest-environment jsdom

/**
 * `hero_layout: band` — schlankes farbiges Band mit Titel, Kennzeile und
 * Unterzeile, OHNE Bild (Welle N4). Der Renderer zeigt einen `<header>` mit
 * dem Titel, aber kein `<img>`; die erste Sektion folgt darunter.
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
    // Band trägt kein Bild — anders als campaign/cover/overlay.
    expect(container.querySelector('header img')).toBeNull()
    expect(container.querySelector('h1')?.textContent).toBe('Welche Fragen hast du an die Natur?')
  })
})
