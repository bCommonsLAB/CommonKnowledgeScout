import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { matchTextureCode, normalizeSeparators } from '@/lib/diva-texture/match-texture-code'
import type { OptionvalueEntry, SupplierEntry } from '@/lib/diva-texture/types'

// Echte Sample-Sidecar als Fixture (Plan: api2_GetJsonOptionValues_sample.json).
const fixtureDir = fileURLToPath(new URL('.', import.meta.url))
const fixturePath = path.resolve(
  fixtureDir,
  '../../../docs/diva-texture-analysen/api2_GetJsonOptionValues_sample.json',
)

interface Sidecar {
  Optionvalues: Record<string, OptionvalueEntry>
}

/** Liest die Fixture und filtert wie der Loader auf IsTexture === "True". */
function loadFixtureEntries(): SupplierEntry[] {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Sidecar
  return Object.entries(raw.Optionvalues)
    .filter(([, entry]) => entry.IsTexture === 'True')
    .map(([key, entry]) => ({ key, entry }))
}

describe('normalizeSeparators', () => {
  it('vereinheitlicht Bindestrich/Unterstrich/Whitespace zu "_" (lowercase)', () => {
    expect(normalizeSeparators('ST_2031-0477')).toBe('st_2031_0477')
    expect(normalizeSeparators('  3__ST--2031  0477 ')).toBe('3_st_2031_0477')
    expect(normalizeSeparators('_leading_und_trailing_')).toBe('leading_und_trailing')
  })
})

describe('matchTextureCode — Fixture', () => {
  const entries = loadFixtureEntries()

  it('filtert IsTexture !== "True" (nur Texturen, kein "Stuetzfuss")', () => {
    expect(entries).toHaveLength(1)
    expect(entries[0].entry.VCodex).toBe('ST_2031-0477')
  })

  it('PFTFile-Strategie: Basecolor-Dateiname trifft exakt', () => {
    const result = matchTextureCode('3_ST_2031_0477_basecolor.jpg', entries)
    expect(result.match).not.toBeNull()
    expect(result.match?.strategy).toBe('pftfile-exact')
    expect(result.match?.entry.VCodex).toBe('ST_2031-0477')
    expect(result.attempts.some((a) => a.matched)).toBe(true)
  })

  it('Suffix-Strip: auch andere PBR-Map-Suffixe (_normal) treffen', () => {
    const result = matchTextureCode('3_ST_2031_0477_normal.png', entries)
    expect(result.match?.strategy).toBe('pftfile-exact')
  })

  it('VCodex-Strategie + Prefix-Strip: Dateiname ohne "3_"-Prefix trifft VCodex', () => {
    const result = matchTextureCode('ST-2031-0477_basecolor.png', entries)
    expect(result.match).not.toBeNull()
    expect(result.match?.strategy).toBe('vcodex-normalized')
    expect(result.match?.entry.VCodex).toBe('ST_2031-0477')
  })

  it('Miss: unpassender Dateiname liefert keinen Treffer, aber Versuche', () => {
    const result = matchTextureCode('voellig_unbekannt_basecolor.jpg', entries)
    expect(result.match).toBeNull()
    expect(result.attempts.length).toBeGreaterThan(0)
    expect(result.attempts.every((a) => !a.matched)).toBe(true)
  })

  it('leere Eintragsliste liefert null ohne Fehler', () => {
    const result = matchTextureCode('3_ST_2031_0477_basecolor.jpg', [])
    expect(result.match).toBeNull()
    expect(result.attempts).toHaveLength(0)
  })
})

describe('matchTextureCode — synthetische Eintraege', () => {
  it('TextureName-Strategie greift, wenn PFTFile fehlt', () => {
    const entries: SupplierEntry[] = [
      { key: 'OPV_A', entry: { VCodex: 'AB-99', IsTexture: 'True', TextureName: '7_AB_99' } },
    ]
    const result = matchTextureCode('7_AB_99_basecolor.jpg', entries)
    expect(result.match?.strategy).toBe('texturename-exact')
    expect(result.match?.entry.VCodex).toBe('AB-99')
  })

  it('vcodex-withprefix greift, wenn der Dateiname den Prefix selbst enthaelt', () => {
    const entries: SupplierEntry[] = [
      { key: 'OPV_B', entry: { VCodex: '3-XY-12', IsTexture: 'True' } },
    ]
    const result = matchTextureCode('3_XY_12_basecolor.jpg', entries)
    expect(result.match?.strategy).toBe('vcodex-withprefix')
  })

  it('protokolliert pro Eintrag mehrere Strategien als Versuche', () => {
    const entries: SupplierEntry[] = [
      { key: 'OPV_C', entry: { VCodex: 'NOPE', IsTexture: 'True', PFTFile: 'x', TextureName: 'y' } },
    ]
    const result = matchTextureCode('something.jpg', entries)
    const strategies = new Set(result.attempts.map((a) => a.strategy))
    expect(strategies.has('pftfile-exact')).toBe(true)
    expect(strategies.has('texturename-exact')).toBe(true)
    expect(strategies.has('vcodex-normalized')).toBe(true)
  })
})
