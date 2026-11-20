/**
 * OpenRouter-Katalog: Antwort lesen (Preise je Token → je 1 Mio.) und suchen.
 */
import { describe, it, expect } from 'vitest'
import { parseKatalog, sucheImKatalog } from '@/lib/llm-models/openrouter-katalog'

const ROH = {
  data: [
    { id: 'deepseek/deepseek-v4.1-flash-1017', name: 'DeepSeek: DeepSeek V4.1 Flash 1017', context_length: 1048576, pricing: { prompt: '0.00000015', completion: '0.0000006' } },
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek: DeepSeek V3.2', context_length: 163840, pricing: { prompt: '0.00000026', completion: '0.00000038' } },
    { id: 'openrouter/auto', name: 'Auto Router', pricing: { prompt: '-1', completion: '-1' } },
    { name: 'ohne Kennung' },
  ],
}

describe('parseKatalog', () => {
  it('rechnet Preise je Token in USD je 1 Mio. Token um', () => {
    const [flash] = parseKatalog(ROH)
    expect(flash).toEqual({
      modelId: 'deepseek/deepseek-v4.1-flash-1017',
      name: 'DeepSeek: DeepSeek V4.1 Flash 1017',
      kontext: 1048576,
      preisEin: 0.15,
      preisAus: 0.6,
    })
  })
  it('kennt keinen festen Preis bei negativen Werten und ueberspringt Eintraege ohne Kennung', () => {
    const eintraege = parseKatalog(ROH)
    expect(eintraege).toHaveLength(3)
    expect(eintraege[2]).toMatchObject({ modelId: 'openrouter/auto', preisEin: null, preisAus: null, kontext: null })
  })
  it('wirft bei einer Antwort ohne data-Liste', () => {
    expect(() => parseKatalog({ fehler: 'x' })).toThrow(/ohne data-Liste/)
  })
})

describe('sucheImKatalog', () => {
  const eintraege = parseKatalog(ROH)
  it('findet ueber alle Woerter in Kennung und Name', () => {
    expect(sucheImKatalog(eintraege, 'deepseek flash', new Set()).map((e) => e.modelId)).toEqual(['deepseek/deepseek-v4.1-flash-1017'])
  })
  it('laesst Modelle weg, die schon in der Liste stehen', () => {
    const treffer = sucheImKatalog(eintraege, 'deepseek', new Set(['deepseek/deepseek-v3.2']))
    expect(treffer.map((e) => e.modelId)).toEqual(['deepseek/deepseek-v4.1-flash-1017'])
  })
  it('liefert bei leerer Frage nichts', () => {
    expect(sucheImKatalog(eintraege, '   ', new Set())).toEqual([])
  })
})
