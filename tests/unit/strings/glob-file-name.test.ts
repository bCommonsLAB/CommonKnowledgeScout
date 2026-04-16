import { describe, expect, it } from 'vitest'
import { matchesGlobFileName } from '@/lib/strings/glob-file-name'

describe('matchesGlobFileName', () => {
  it('leeres Muster matcht immer', () => {
    expect(matchesGlobFileName('foo.jpg', '')).toBe(true)
    expect(matchesGlobFileName('foo.jpg', '   ')).toBe(true)
  })

  it('Sternchen als Platzhalter', () => {
    expect(matchesGlobFileName('9106_1_basecolor.jpg', '*_basecolor*')).toBe(true)
    expect(matchesGlobFileName('X_basecolor_Y.png', '*_basecolor*')).toBe(true)
    expect(matchesGlobFileName('9106_1_normal.jpg', '*_basecolor*')).toBe(false)
  })

  it('case-insensitive', () => {
    expect(matchesGlobFileName('TEX_BaseColor.JPG', '*_basecolor*')).toBe(true)
  })
})
