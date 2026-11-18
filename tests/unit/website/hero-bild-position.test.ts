/**
 * Ausschnitt des Kopfbilds (Owner 18.11.2026, Frontmatter `hero_image_position`):
 * Helfer, Mapper und Pruefung vor dem Publizieren.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { heroBildPosition, heroBildPositionGeprueft } from '@/lib/website/hero-bild-position'
import { mapToWebsiteDetail } from '@/lib/mappers/doc-meta-mappers'
import { pruefeMarkdownDokument } from '@/lib/mcp/website-pruefung'

afterEach(() => vi.restoreAllMocks())

describe('heroBildPosition', () => {
  it('fehlt: undefined, der Kopf bleibt bei der Bildmitte', () => {
    expect(heroBildPosition(undefined)).toBeUndefined()
    expect(heroBildPosition(null)).toBeUndefined()
    expect(heroBildPosition('')).toBeUndefined()
  })

  it('Stichworte und Prozentwerte werden zur Hoehe der object-position', () => {
    expect(heroBildPosition('top')).toBe('50% 0%')
    expect(heroBildPosition('center')).toBe('50% 50%')
    expect(heroBildPosition('bottom')).toBe('50% 100%')
    expect(heroBildPosition(' 70% ')).toBe('50% 70%')
    expect(heroBildPosition('0%')).toBe('50% 0%')
    expect(heroBildPosition('100%')).toBe('50% 100%')
  })

  it('wirft bei ungueltigen Werten statt still zu ersetzen', () => {
    expect(() => heroBildPosition('101%')).toThrow(/ungueltig/)
    expect(() => heroBildPosition('70')).toThrow(/ungueltig/)
    expect(() => heroBildPosition('mitte')).toThrow(/ungueltig/)
    expect(() => heroBildPosition(70)).toThrow(/ungueltig/)
  })

  it('geprueft: ungueltig wird laut gemeldet und die Bildmitte gilt', () => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(heroBildPositionGeprueft('irgendwo')).toBeUndefined()
    expect(fehler).toHaveBeenCalledTimes(1)
  })
})

describe('hero_image_position im Mapper und vor dem Publizieren', () => {
  it('der Mapper reicht die object-position durch', () => {
    expect(mapToWebsiteDetail({ docMetaJson: { title: 'Start', hero_image_position: '70%' } }).heroImagePosition).toBe('50% 70%')
    expect(mapToWebsiteDetail({ docMetaJson: { title: 'Start' } }).heroImagePosition).toBeUndefined()
  })

  it('dokument_publizieren warnt bei einem ungueltigen Wert', () => {
    const md = '---\ndetailViewType: "website"\ntitle: "Start"\nlanguage: "de"\ntargetLanguage: "de"\nhero_image_position: "unten"\n---\nText'
    const p = pruefeMarkdownDokument(md)
    expect(p.warnungen.some((w) => w.includes('hero_image_position "unten" ist ungueltig'))).toBe(true)
    expect(p.fehler).toEqual([])
  })

  it('ein gueltiger Wert bleibt ohne Warnung', () => {
    const md = '---\ndetailViewType: "website"\ntitle: "Start"\nlanguage: "de"\ntargetLanguage: "de"\nhero_image_position: "70%"\n---\nText'
    expect(pruefeMarkdownDokument(md).warnungen).toEqual([])
  })
})
