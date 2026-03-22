import { describe, expect, it } from 'vitest'
import {
  extractCanonicalImageNameByBlobNameFromMarkdown,
  extractImageLikeNamesFromMarkdown,
} from '@/lib/creation/composite-transcript'

describe('extractImageLikeNamesFromMarkdown', () => {
  it('erkennt [[quelle#fragment.jpeg]]', () => {
    const md = 'Bild: [[Bericht.pdf#img-0.jpeg]]'
    expect(extractImageLikeNamesFromMarkdown(md)).toEqual(['img-0.jpeg'])
  })

  it('erkennt ![[embed.png]] und Markdown-![](pfad/datei.jpg)', () => {
    const md = `
![[cover.PNG]]
![](ordner/unter/foo%20bar.webp)
`
    const names = extractImageLikeNamesFromMarkdown(md)
    expect(names).toContain('cover.PNG')
    expect(names).toContain('foo%20bar.webp')
  })

  it('erkennt <img src="…">', () => {
    const md = '<img src="https://x.test/a/b/preview.gif" />'
    expect(extractImageLikeNamesFromMarkdown(md)).toEqual(['preview.gif'])
  })

  it('sortiert und dedupliziert', () => {
    const md = '[[a.pdf#z.jpeg]] [[a.pdf#z.jpeg]] ![[a.jpeg]]'
    expect(extractImageLikeNamesFromMarkdown(md)).toEqual(['a.jpeg', 'z.jpeg'])
  })

  it('liefert leeres Array bei leerem Input', () => {
    expect(extractImageLikeNamesFromMarkdown('')).toEqual([])
    expect(extractImageLikeNamesFromMarkdown('   ')).toEqual([])
  })
})

describe('extractCanonicalImageNameByBlobNameFromMarkdown', () => {
  it('liest img-Name aus Markdown-Alttext und blob-Name aus URL', () => {
    const md = '![img-0.jpeg](https://blob.example/container/326c3b8ce2b1ad76.jpeg)'
    const map = extractCanonicalImageNameByBlobNameFromMarkdown(md)
    expect(map.get('326c3b8ce2b1ad76.jpeg')).toBe('img-0.jpeg')
  })

  it('ignoriert leeren Input', () => {
    expect([...extractCanonicalImageNameByBlobNameFromMarkdown('').entries()]).toEqual([])
  })
})
