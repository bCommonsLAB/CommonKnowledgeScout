import { describe, it, expect } from 'vitest'
import { zitatmarke, zitatmarkenImText } from '@ks/util'

describe('zitatmarke', () => {
  it('Kreiszahlen 1 bis 20, darueber in Klammern', () => {
    expect(zitatmarke(1)).toBe('①')
    expect(zitatmarke(20)).toBe('⑳')
    expect(zitatmarke(21)).toBe('(21)')
    expect(zitatmarke(0)).toBe('(0)')
  })
})

describe('zitatmarkenImText', () => {
  it('macht aus [n] einen Anker auf die Belegkarte', () => {
    expect(zitatmarkenImText('Radwege helfen [1] [3].')).toBe('Radwege helfen [①](#beleg-1) [③](#beleg-3).')
  })

  it('laesst Markdown-Links und Text ohne Marken in Ruhe', () => {
    expect(zitatmarkenImText('Siehe [2](https://x) und [Titel](#a).')).toBe('Siehe [2](https://x) und [Titel](#a).')
    expect(zitatmarkenImText('Keine Marke.')).toBe('Keine Marke.')
  })
})
