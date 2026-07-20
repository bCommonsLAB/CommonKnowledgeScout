/**
 * Marker-Guard (Phase C4): Sektions-Marker + Bild-/Video-URLs muessen die
 * Uebersetzung des website-`markdown` unveraendert ueberleben.
 */

import { describe, it, expect } from 'vitest'
import { checkWebsiteMarkdownTranslation } from '@/lib/website/website-translation-guard'

const ORIGINAL = `
<!-- section layout=image-right bg=dark-green -->
## Wer sind wir?
![Gruppenfoto](https://example.com/images/gruppe.jpg)

Wir sind aktiv.
<!-- /section -->

<!-- section layout=video bg=neutral -->
https://player.vimeo.com/video/820810243
<!-- /section -->

<!-- section layout=text-only bg=mint -->
## Alle sind aufgerufen!
<!-- /section -->
`.trim()

// Korrekte Uebersetzung: Text uebersetzt (inkl. Alt-Text), Struktur + URLs gleich.
const GOOD_TRANSLATION = ORIGINAL
  .replace('## Wer sind wir?', '## Chi siamo?')
  .replace('Wir sind aktiv.', 'Siamo attivi.')
  .replace('![Gruppenfoto]', '![Foto di gruppo]')
  .replace('## Alle sind aufgerufen!', '## Tutti sono chiamati!')

describe('checkWebsiteMarkdownTranslation', () => {
  it('akzeptiert eine Uebersetzung mit erhaltener Struktur (Alt-Text darf sich aendern)', () => {
    expect(checkWebsiteMarkdownTranslation(ORIGINAL, GOOD_TRANSLATION)).toEqual([])
  })

  it('meldet eine verlorene Sektion', () => {
    const dropped = GOOD_TRANSLATION.replace(
      /<!-- section layout=text-only bg=mint -->[\s\S]*?<!-- \/section -->/,
      '## Tutti sono chiamati!',
    )
    const violations = checkWebsiteMarkdownTranslation(ORIGINAL, dropped)
    expect(violations.some((v) => v.type === 'section-count')).toBe(true)
  })

  it('meldet veraenderte layout/bg-Attribute', () => {
    const changed = GOOD_TRANSLATION.replace('layout=image-right bg=dark-green', 'layout=image-left bg=mint')
    const violations = checkWebsiteMarkdownTranslation(ORIGINAL, changed)
    expect(violations.some((v) => v.type === 'section-attrs')).toBe(true)
  })

  it('meldet eine veraenderte Bild-URL', () => {
    const changed = GOOD_TRANSLATION.replace(
      'https://example.com/images/gruppe.jpg',
      'https://example.com/images/gruppo.jpg',
    )
    const violations = checkWebsiteMarkdownTranslation(ORIGINAL, changed)
    expect(violations.some((v) => v.type === 'image-url')).toBe(true)
  })

  it('meldet eine veraenderte Video-URL', () => {
    const changed = GOOD_TRANSLATION.replace('video/820810243', 'video/999999999')
    const violations = checkWebsiteMarkdownTranslation(ORIGINAL, changed)
    expect(violations.some((v) => v.type === 'video-url')).toBe(true)
  })

  it('meldet eine nicht parsebare Uebersetzung (ungueltiges layout) statt zu werfen', () => {
    const broken = GOOD_TRANSLATION.replace('layout=image-right', 'layout=immagine-destra')
    const violations = checkWebsiteMarkdownTranslation(ORIGINAL, broken)
    expect(violations).toHaveLength(1)
    expect(violations[0].type).toBe('unparseable')
  })
})
