import { describe, expect, it } from 'vitest'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

describe('parseSecretaryMarkdownStrict', () => {
  it('parst Medien-Array-Felder als echte Arrays', () => {
    const markdown = `---
attachments_url: ["a.pdf","b.pdf"]
galleryImageUrls: ["img-1.jpg","img-2.jpg"]
authors_image_url: ["author.jpg"]
_source_files: ["x.pdf","y.pdf"]
---

Body`

    const { meta } = parseSecretaryMarkdownStrict(markdown)

    expect(meta.attachments_url).toEqual(['a.pdf', 'b.pdf'])
    expect(meta.galleryImageUrls).toEqual(['img-1.jpg', 'img-2.jpg'])
    expect(meta.authors_image_url).toEqual(['author.jpg'])
    expect(meta._source_files).toEqual(['x.pdf', 'y.pdf'])
  })

  it('dekodiert quoted Strings und erhält Zahlen als Zahlen', () => {
    const markdown = `---
blogartikel: "Zeile 1\\n\\nZeile 2"
pages: 2
---

Body`

    const { meta } = parseSecretaryMarkdownStrict(markdown)

    expect(meta.blogartikel).toBe('Zeile 1\n\nZeile 2')
    expect(meta.pages).toBe(2)
  })
})
