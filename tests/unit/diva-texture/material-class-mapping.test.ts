/**
 * Tests fuer src/lib/diva-texture/material-class-mapping.ts (Stufe 2).
 *
 * Deckt alle DE-Werte der Plan-Tabelle (Section 5) sowie den Sample-JSON-Wert
 * "STOFF" ab + Normalisierung (Case/Whitespace) + Unbekannt-Verhalten.
 */

import { describe, expect, it } from 'vitest'
import {
  mapMaterialClass,
  knownMaterialKeys,
  type MaterialClass,
} from '@/lib/diva-texture/material-class-mapping'

describe('mapMaterialClass — bekannte Werte (Plan-Section 5)', () => {
  const cases: Array<{ raw: string; materialClass: MaterialClass; materialType?: string }> = [
    { raw: 'STOFF', materialClass: 'fabric' },
    { raw: 'LEDER', materialClass: 'leather' },
    { raw: 'KUNSTLEDER', materialClass: 'leather', materialType: 'faux_leather' },
    { raw: 'HOLZ', materialClass: 'wood' },
    { raw: 'STEIN', materialClass: 'stone' },
    { raw: 'MARMOR', materialClass: 'stone' },
    { raw: 'GRANIT', materialClass: 'stone' },
    { raw: 'METALL', materialClass: 'metal' },
    { raw: 'GLAS', materialClass: 'glass' },
    { raw: 'KUNSTSTOFF', materialClass: 'plastic' },
    { raw: 'LACK', materialClass: 'plastic' },
  ]

  for (const c of cases) {
    it(`mappt "${c.raw}" → ${c.materialClass}${c.materialType ? ` (+${c.materialType})` : ''}`, () => {
      const result = mapMaterialClass(c.raw)
      expect(result.isKnown).toBe(true)
      expect(result.materialClass).toBe(c.materialClass)
      expect(result.materialType).toBe(c.materialType)
    })
  }
})

describe('mapMaterialClass — Sample-JSON-Wert', () => {
  // api2_GetJsonOptionValues_sample.json: einziger IsTexture==="True"-Eintrag hat Material "STOFF".
  it('mappt den Sample-Wert "STOFF" auf fabric', () => {
    expect(mapMaterialClass('STOFF')).toEqual({ materialClass: 'fabric', materialType: undefined, isKnown: true })
  })
})

describe('mapMaterialClass — Normalisierung', () => {
  it('ist case-insensitiv', () => {
    expect(mapMaterialClass('stoff').materialClass).toBe('fabric')
    expect(mapMaterialClass('Leder').materialClass).toBe('leather')
    expect(mapMaterialClass('kUnStLeDeR').materialType).toBe('faux_leather')
  })

  it('trimmt fuehrenden/abschliessenden Whitespace', () => {
    expect(mapMaterialClass('  HOLZ  ').materialClass).toBe('wood')
  })
})

describe('mapMaterialClass — unbekannt / leer (no-silent-fallback)', () => {
  it('liefert null + isKnown=false fuer unbekannten Wert', () => {
    expect(mapMaterialClass('BETON')).toEqual({ materialClass: null, isKnown: false })
  })

  it('liefert null + isKnown=false fuer leeren String', () => {
    expect(mapMaterialClass('   ')).toEqual({ materialClass: null, isKnown: false })
  })

  it('liefert null + isKnown=false fuer null/undefined', () => {
    expect(mapMaterialClass(null)).toEqual({ materialClass: null, isKnown: false })
    expect(mapMaterialClass(undefined)).toEqual({ materialClass: null, isKnown: false })
  })
})

describe('knownMaterialKeys', () => {
  it('enthaelt alle Plan-Tabellen-Schluessel', () => {
    const keys = knownMaterialKeys()
    for (const k of ['STOFF', 'LEDER', 'KUNSTLEDER', 'HOLZ', 'STEIN', 'MARMOR', 'GRANIT', 'METALL', 'GLAS', 'KUNSTSTOFF', 'LACK']) {
      expect(keys).toContain(k)
    }
  })
})
