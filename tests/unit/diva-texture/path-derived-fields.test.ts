/**
 * Tests fuer src/lib/diva-texture/path-derived-fields.ts (Stufe 3).
 *
 * Deckt die deterministische Ableitung von iln_nummer / textur_code /
 * title / slug aus Pfad, Filename und Sidecar-Eintrag ab.
 */

import { describe, expect, it } from 'vitest'
import { derivePathFields } from '@/lib/diva-texture/path-derived-fields'
import type { OptionvalueEntry } from '@/lib/diva-texture/types'

const SIDECAR: OptionvalueEntry = {
  VCodex: 'ST_2031-0477',
  IsTexture: 'True',
  Material: 'STOFF',
  Name: 'Feincord thyme',
  PFTFile: '3_ST_2031_0477',
}

const FILENAME = '3_ST_2031_0477_basecolor.jpg'
const PATH_WITH_ILN = 'S:\\DIVA3DARCHIV\\0001445679013\\textures\\_tex\\' + FILENAME

describe('derivePathFields — Sidecar-Hit (Standard-Fall)', () => {
  it('uebernimmt Sidecar-Code + Name und leitet Slug + ILN aus dem Pfad ab', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: FILENAME,
      supplierEntry: SIDECAR,
    })
    expect(result).toEqual({
      iln_nummer: '0001445679013',
      textur_code: 'ST_2031-0477',
      title: 'Feincord thyme',
      slug: 'feincord-thyme',
    })
  })

  it('Sidecar mit Sonderzeichen im Namen → Slug ohne Diakritika', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: FILENAME,
      supplierEntry: { ...SIDECAR, Name: 'Aussen-Stoff Crème (XL)' },
    })
    expect(result.title).toBe('Aussen-Stoff Crème (XL)')
    expect(result.slug).toBe('aussen-stoff-creme-xl')
  })
})

describe('derivePathFields — kein Sidecar (Fallback aus Filename)', () => {
  it('leitet textur_code per Filename-Parse + title aus dem Datei-Stamm', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: FILENAME,
      supplierEntry: null,
    })
    expect(result.iln_nummer).toBe('0001445679013')
    expect(result.textur_code).toBe('ST_2031-0477')
    expect(result.title).toBe('3_ST_2031_0477')
    expect(result.slug).toBe('3-st-2031-0477')
  })

  it('Filename ohne Counter + ohne Suffix → textur_code identisch zum Stamm', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: 'LE_6128.jpg',
      supplierEntry: null,
    })
    expect(result.textur_code).toBe('LE_6128')
    expect(result.title).toBe('LE_6128')
  })

  it('PBR-Suffixe (_normal/_roughness) werden ebenso wie _basecolor abgeschnitten', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: '3_ST_2031_0477_normal.png',
      supplierEntry: null,
    })
    expect(result.textur_code).toBe('ST_2031-0477')
  })
})

describe('derivePathFields — Pfad-Spezialfaelle', () => {
  it('DivaStandardMaterials-Pfad: ILN kommt trotzdem aus dem Pfad', () => {
    // Im Gegensatz zu retailer_iln (das bei DivaStandardMaterials leer ist),
    // soll iln_nummer 13-stellig sein, wenn sie irgendwo im Pfad vorkommt.
    const result = derivePathFields({
      filePath: 'S:\\DivaStandardMaterials\\0001445679013\\textures\\_tex\\' + FILENAME,
      fileName: FILENAME,
      supplierEntry: SIDECAR,
    })
    expect(result.iln_nummer).toBe('0001445679013')
  })

  it('keine ILN im Pfad → iln_nummer leer (kein Erfinden)', () => {
    const result = derivePathFields({
      filePath: 'C:\\textures\\' + FILENAME,
      fileName: FILENAME,
      supplierEntry: SIDECAR,
    })
    expect(result.iln_nummer).toBe('')
  })

  it('14-stellige Ziffernfolge → kein Match (ILN ist genau 13-stellig)', () => {
    const result = derivePathFields({
      filePath: 'S:\\00014456790131\\' + FILENAME,
      fileName: FILENAME,
      supplierEntry: null,
    })
    expect(result.iln_nummer).toBe('')
  })
})

describe('derivePathFields — slug-Regeln', () => {
  it('Slug ist kebab-case, lowercase, max 80 Zeichen', () => {
    const longName = 'A'.repeat(120)
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: FILENAME,
      supplierEntry: { ...SIDECAR, Name: longName },
    })
    expect(result.slug.length).toBeLessThanOrEqual(80)
    expect(result.slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('Slug hat keine fuehrenden/abschliessenden Bindestriche', () => {
    const result = derivePathFields({
      filePath: PATH_WITH_ILN,
      fileName: FILENAME,
      supplierEntry: { ...SIDECAR, Name: '-!-Feincord-!-' },
    })
    expect(result.slug).toBe('feincord')
  })
})
