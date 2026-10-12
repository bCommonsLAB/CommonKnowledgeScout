// @vitest-environment jsdom

/**
 * `hero_layout: none` — der Website-Renderer laesst den Kopf ganz weg
 * (kein `<header>`, kein Titel, kein Abstand ueber der ersten Sektion).
 * Vorher rendert jede Seite ohne Hero-Bild einen Text-Kopf mit Titel;
 * Seiten, deren erste Sektion das Bild traegt, bekamen so einen leeren
 * Rand von rund 120 px. Sub-Komponenten mit eigenem Verhalten sind gemockt.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { WebsiteDetail } from '@/components/library/website-detail'

afterEach(cleanup)

const MARKDOWN = '<!-- section layout=full-image bg=default -->\n![Plakat](https://blob/plakat.jpg)\n## Armut verstehen\nText\n<!-- /section -->'

describe('WebsiteDetail hero_layout none', () => {
  it('rendert ohne hero_layout den Text-Kopf mit Titel', () => {
    const { container } = render(<WebsiteDetail data={{ title: 'Journalistenschulung', markdown: MARKDOWN }} />)
    const header = container.querySelector('header')
    expect(header).not.toBeNull()
    expect(header?.textContent).toContain('Journalistenschulung')
  })

  it('rendert mit hero_layout none keinen Kopf — die erste Sektion beginnt oben', () => {
    const { container } = render(
      <WebsiteDetail data={{ title: 'Journalistenschulung', heroLayout: 'none', heroImageUrl: 'https://blob/h.jpg', markdown: MARKDOWN }} />,
    )
    expect(container.querySelector('header')).toBeNull()
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('section')).not.toBeNull()
  })
})
