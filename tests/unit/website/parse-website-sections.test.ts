import { describe, it, expect } from 'vitest'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'

describe('parseWebsiteSections', () => {
  it('parst Layout, Hintergrund und extrahiert das Sektions-Bild', () => {
    const body = `
<!-- section layout=image-right bg=light -->
## Wer sind wir?
![Gruppenfoto](https://example.com/a.jpg)

Wir sind aktiv.
<!-- /section -->`
    const sections = parseWebsiteSections(body)
    expect(sections).toHaveLength(1)
    expect(sections[0].layout).toBe('image-right')
    expect(sections[0].bg).toBe('light')
    expect(sections[0].imageUrl).toBe('https://example.com/a.jpg')
    expect(sections[0].imageAlt).toBe('Gruppenfoto')
    expect(sections[0].markdown).toContain('## Wer sind wir?')
    expect(sections[0].markdown).toContain('Wir sind aktiv.')
    expect(sections[0].markdown).not.toContain('![')
  })

  it('parst eine video-Sektion und extrahiert die Video-URL', () => {
    const body = `
<!-- section layout=video bg=default -->
https://player.vimeo.com/video/88026826
<!-- /section -->`
    const sections = parseWebsiteSections(body)
    expect(sections).toHaveLength(1)
    expect(sections[0].layout).toBe('video')
    expect(sections[0].videoUrl).toBe('https://player.vimeo.com/video/88026826')
  })

  it('parst eine contact-form-Sektion (C3) mit Intro-Markdown', () => {
    const body = `
<!-- section layout=contact-form bg=mint -->
## Jetzt mitmachen

Bringe deine Ideen mit ein!
<!-- /section -->`
    const sections = parseWebsiteSections(body)
    expect(sections).toHaveLength(1)
    expect(sections[0].layout).toBe('contact-form')
    expect(sections[0].bg).toBe('mint')
    expect(sections[0].markdown).toContain('## Jetzt mitmachen')
  })

  it('parst mehrere Sektionen in Reihenfolge', () => {
    const body = `
<!-- section layout=image-left bg=brand -->
## Eins
<!-- /section -->
<!-- section layout=text-only bg=dark -->
> Zitat
<!-- /section -->`
    const sections = parseWebsiteSections(body)
    expect(sections.map((s) => s.layout)).toEqual(['image-left', 'text-only'])
    expect(sections.map((s) => s.bg)).toEqual(['brand', 'dark'])
  })

  it('nutzt Defaults, wenn Attribute fehlen', () => {
    const sections = parseWebsiteSections('<!-- section -->## Titel<!-- /section -->')
    expect(sections[0].layout).toBe('text-only')
    expect(sections[0].bg).toBe('default')
  })

  it('wirft bei ungueltigem Layout (kein Silent Fallback)', () => {
    expect(() =>
      parseWebsiteSections('<!-- section layout=carousel -->x<!-- /section -->'),
    ).toThrow(/layout/)
  })

  it('wirft bei ungueltigem Hintergrund', () => {
    expect(() =>
      parseWebsiteSections('<!-- section bg=neon -->x<!-- /section -->'),
    ).toThrow(/bg/)
  })

  it('gibt eine Default-Sektion zurueck, wenn keine Marker vorhanden sind', () => {
    const sections = parseWebsiteSections('Nur Text ohne Marker.')
    expect(sections).toHaveLength(1)
    expect(sections[0].layout).toBe('text-only')
    expect(sections[0].markdown).toBe('Nur Text ohne Marker.')
  })
})
