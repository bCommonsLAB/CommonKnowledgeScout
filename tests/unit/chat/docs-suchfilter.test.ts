/**
 * Welle A — Suchfilter der Galerie-Route und der Bruecke: Titel immer,
 * String-Facetten in beiden Ablagen, Zahl-Facetten per $toString.
 */
import { describe, it, expect } from 'vitest'
import { baueSuchFilter } from '@/lib/chat/docs-suchfilter'

describe('baueSuchFilter', () => {
  it('sucht in Titel, String-Facetten (beide Ablagen) und Zahl-Facetten als Text', () => {
    const zweige = baueSuchFilter(
      [{ metaKey: 'category', type: 'string' }, { metaKey: 'massnahme_nr', type: 'number' }, { metaKey: 'year', type: 'date' }],
      '38',
    )
    expect(zweige).toHaveLength(7)
    expect(zweige[4]).toEqual({ category: { $regex: '38', $options: 'i' } })
    expect(zweige[5]).toEqual({ 'docMetaJson.category': { $regex: '38', $options: 'i' } })
    expect(JSON.stringify(zweige[6])).toContain('$docMetaJson.massnahme_nr')
  })
})
