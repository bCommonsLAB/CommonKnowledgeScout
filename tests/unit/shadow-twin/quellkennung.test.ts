import { describe, it, expect } from 'vitest'
import { berechneQuellkennung, leseQuellkennung, quellkennungAusBlob } from '@/lib/shadow-twin/quellkennung'

const JETZT = '2026-10-13T12:00:00.000Z'
/** SHA-256 von "abc" — bekannter Testvektor. */
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

describe('berechneQuellkennung', () => {
  it('rechnet SHA-256 hex, Groesse und uebernimmt den Zeitpunkt', () => {
    const kennung = berechneQuellkennung(new TextEncoder().encode('abc'), JETZT)
    expect(kennung).toEqual({ sourceContentHash: SHA_ABC, sourceSize: 3, sourceHashedAt: JETZT })
  })

  it('ist deterministisch: gleicher Inhalt, gleicher Hash — anderer Inhalt, anderer Hash', () => {
    const a = berechneQuellkennung(new Uint8Array([1, 2, 3]), JETZT)
    const b = berechneQuellkennung(new Uint8Array([1, 2, 3]), '2026-10-14T00:00:00.000Z')
    const c = berechneQuellkennung(new Uint8Array([1, 2, 4]), JETZT)
    expect(a.sourceContentHash).toBe(b.sourceContentHash)
    expect(a.sourceContentHash).not.toBe(c.sourceContentHash)
  })

  it('weist einen leeren Zeitpunkt ab', () => {
    expect(() => berechneQuellkennung(new Uint8Array([1]), ' ')).toThrow(/jetzt/)
  })
})

describe('quellkennungAusBlob', () => {
  it('liest den Blob einmal und kommt auf dieselbe Kennung wie die Bytes', async () => {
    const kennung = await quellkennungAusBlob(new Blob(['abc']), JETZT)
    expect(kennung.sourceContentHash).toBe(SHA_ABC)
    expect(kennung.sourceSize).toBe(3)
  })
})

describe('leseQuellkennung', () => {
  it('liefert null ohne Hash und die drei Felder mit Hash', () => {
    expect(leseQuellkennung({})).toBeNull()
    expect(leseQuellkennung({ sourceContentHash: '' })).toBeNull()
    expect(leseQuellkennung({ sourceContentHash: SHA_ABC, sourceSize: 3, sourceHashedAt: JETZT })).toEqual({
      sourceContentHash: SHA_ABC, sourceSize: 3, sourceHashedAt: JETZT,
    })
  })

  it('wirft bei einem halben Satz statt zu raten', () => {
    expect(() => leseQuellkennung({ sourceContentHash: SHA_ABC })).toThrow(/unvollstaendig/)
  })
})
