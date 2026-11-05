/**
 * Welle N1 — Story-Sektion: Markdown vor und nach dem Fragen-Block, die Fragen dazwischen.
 */
import { describe, it, expect } from 'vitest'
import { parseWebsiteSections } from '@/lib/website/parse-website-sections'
import { hatStorySektion, storyBloecke } from '@/lib/website/story-section'

describe('storyBloecke', () => {
  it('teilt die Bloecke am questions-Block: vor, fragen, nach', () => {
    const [s] = parseWebsiteSections('<!-- section layout=story -->\n## Frag.\nAbsatz.\n\n<!-- questions -->\n- A?\n- B?\n\nZeile danach\n<!-- /section -->')
    const b = storyBloecke(s)
    expect(b.vor).toEqual([{ type: 'markdown', markdown: '## Frag.\nAbsatz.' }])
    expect(b.fragen).toEqual(['A?', 'B?'])
    expect(b.nach).toEqual([{ type: 'markdown', markdown: 'Zeile danach' }])
  })

  it('ohne questions-Block: alles steht vor der Eingabe, keine Fragen', () => {
    const [s] = parseWebsiteSections('<!-- section layout=story -->\n## Frag.\n<!-- /section -->')
    expect(storyBloecke(s)).toEqual({ vor: [{ type: 'markdown', markdown: '## Frag.' }], fragen: [], nach: [] })
  })

  it('wirft fuer andere Layouts statt still leer zu liefern', () => {
    const [s] = parseWebsiteSections('<!-- section layout=text-only -->\nText\n<!-- /section -->')
    expect(() => storyBloecke(s)).toThrow(/erwartet story/)
  })

  it('hatStorySektion erkennt die Sektion', () => {
    expect(hatStorySektion(parseWebsiteSections('<!-- section layout=story -->\nx\n<!-- /section -->'))).toBe(true)
    expect(hatStorySektion(parseWebsiteSections('Nur Text'))).toBe(false)
  })
})
