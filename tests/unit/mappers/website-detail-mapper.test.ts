/**
 * Welle S1 — Mapper der Website-Detaildaten: Banner-Felder und heading_case.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mapToWebsiteDetail } from '@/lib/mappers/doc-meta-mappers'

afterEach(() => vi.restoreAllMocks())

describe('mapToWebsiteDetail (S1)', () => {
  it('liest banner_tag, banner_title, banner_limit und heading_case', () => {
    const d = mapToWebsiteDetail({ docMetaJson: { title: 'Start', banner_tag: 'fokus', banner_title: 'Im Fokus', banner_limit: 9, heading_case: 'none' } })
    expect(d).toMatchObject({ bannerTag: 'fokus', bannerTitle: 'Im Fokus', bannerLimit: 9, headingCase: 'none' })
  })

  it('fehlende Felder bleiben undefined (Vorgaben entscheidet der Renderer)', () => {
    const d = mapToWebsiteDetail({ docMetaJson: { title: 'Start' } })
    expect(d.bannerTag).toBeUndefined()
    expect(d.bannerLimit).toBe(6)
    expect(d.headingCase).toBeUndefined()
  })

  it('ungueltiges banner_limit und heading_case werden laut gemeldet, die Seite rendert trotzdem', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    const d = mapToWebsiteDetail({ docMetaJson: { title: 'Start', banner_limit: 99, heading_case: 'shouty' } })
    expect(d.bannerLimit).toBeUndefined()
    expect(d.headingCase).toBeUndefined()
    expect(fehler).toHaveBeenCalledTimes(2)
    expect(String(fehler.mock.calls[0][0])).toMatch(/banner_limit "99"/)
    expect(String(fehler.mock.calls[1][0])).toMatch(/heading_case "shouty"/)
  })
})

describe('mapToWebsiteDetail (S2, Hero campaign)', () => {
  it('liest hero_kicker, hero_title2, cta2_label, cta2_url', () => {
    const d = mapToWebsiteDetail({ docMetaJson: {
      title: 'Start', hero_layout: 'campaign', hero_kicker: 'Dialogplattform', hero_title2: 'Zweite Zeile',
      cta2_label: 'Mitreden', cta2_url: '?site=kontakt',
    } })
    expect(d).toMatchObject({ heroLayout: 'campaign', heroKicker: 'Dialogplattform', heroTitle2: 'Zweite Zeile', cta2Label: 'Mitreden', cta2Url: '?site=kontakt' })
  })
})

describe('mapToWebsiteDetail (S2-Nachtrag, hero_title)', () => {
  it('hero_title ist die Hero-Ueberschrift, title bleibt der Menuepunkt', () => {
    const d = mapToWebsiteDetail({ docMetaJson: { title: 'Kurz', hero_title: 'Lange Hero-Zeile.' } })
    expect(d.title).toBe('Kurz')
    expect(d.heroTitle).toBe('Lange Hero-Zeile.')
    expect(mapToWebsiteDetail({ docMetaJson: { title: 'Kurz' } }).heroTitle).toBeUndefined()
  })
})
