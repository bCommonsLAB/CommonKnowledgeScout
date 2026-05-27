/**
 * Tests fuer src/lib/diva-texture/availability-from-path.ts (Stufe 3).
 *
 * Deckt die deterministische Pfad-Ableitung ab: DivaStandardMaterials,
 * 13-stellige ILN, kein Treffer.
 */

import { describe, expect, it } from 'vitest'
import { parseAvailabilityFromPath } from '@/lib/diva-texture/availability-from-path'

describe('parseAvailabilityFromPath', () => {
  it('DivaStandardMaterials → scope basic, retailer_iln leer', () => {
    const path = 'S:\\DIVA3DARCHIV\\DivaStandardMaterials\\textures\\_tex\\x_basecolor.jpg'
    expect(parseAvailabilityFromPath(path)).toEqual({ availability_scope: 'basic', retailer_iln: '' })
  })

  it('ist case-insensitiv fuer den DivaStandardMaterials-Marker', () => {
    const path = '/srv/divastandardmaterials/tex/x.jpg'
    expect(parseAvailabilityFromPath(path).retailer_iln).toBe('')
  })

  it('liest die 13-stellige ILN aus dem Pfad', () => {
    const path = 'S:\\DIVA3DARCHIV\\0001445679013\\textures\\_tex\\3_ST_2031_0477_basecolor.jpg'
    expect(parseAvailabilityFromPath(path)).toEqual({
      availability_scope: 'basic',
      retailer_iln: '0001445679013',
    })
  })

  it('ignoriert laengere Ziffernfolgen (keine 13-stellige ILN eingebettet)', () => {
    const path = '/data/000144567901399/tex/x.jpg'
    expect(parseAvailabilityFromPath(path).retailer_iln).toBe('')
  })

  it('kein Treffer → scope basic, retailer_iln leer (kein stiller Fehler)', () => {
    expect(parseAvailabilityFromPath('/some/random/path/x.jpg')).toEqual({
      availability_scope: 'basic',
      retailer_iln: '',
    })
  })

  it('robust gegen null/undefined/leeren Pfad', () => {
    expect(parseAvailabilityFromPath(null).retailer_iln).toBe('')
    expect(parseAvailabilityFromPath(undefined).retailer_iln).toBe('')
    expect(parseAvailabilityFromPath('').availability_scope).toBe('basic')
  })
})
