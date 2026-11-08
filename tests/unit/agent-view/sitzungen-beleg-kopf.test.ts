/**
 * @fileoverview Unit-Tests: Beleg-Koepfe lesen und am Twin merken (S1b).
 *
 * Gelesen wird nur, was fehlt oder laut Listing juenger ist; ein Lesefehler
 * trifft eine Datei und steht in `fehler`, der Rest laeuft weiter.
 */

import { describe, it, expect, vi } from 'vitest'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { ergaenzeBelegKoepfe, merkerGilt } from '@/lib/agent-view/sichten/sitzungen-beleg-kopf'

const zeile = (sourceId: string, sourceFrontmatter: TransformationZeile['sourceFrontmatter']): TransformationZeile =>
  ({ sourceId, sourceName: `${sourceId}.md`, parentId: 'p', frontmatter: null, updatedAt: null, sourceFrontmatter })

const BELEG = '---\ntype: chatverlauf\nvorhaben: [24.05 Konferenzen, 24.03 bcoop]\nhauptvorhaben: 24.05 Konferenzen\nende: 2026-10-30\n---\n\n# Chat\n'

describe('merkerGilt', () => {
  it('ohne Merker nie; ohne Listing-Zeit gilt der Merker; sonst muss die Zeit stimmen', () => {
    const alt = { fields: {}, sourceModifiedAt: '2026-10-01T00:00:00Z' }
    expect(merkerGilt(zeile('a', null), '2026-10-01T00:00:00Z')).toBe(false)
    expect(merkerGilt(zeile('a', alt), undefined)).toBe(true)
    expect(merkerGilt(zeile('a', alt), null)).toBe(true)
    expect(merkerGilt(zeile('a', alt), '2026-10-01T00:00:00Z')).toBe(true)
    expect(merkerGilt(zeile('a', alt), '2026-11-01T00:00:00Z')).toBe(false)
  })
})

describe('ergaenzeBelegKoepfe', () => {
  it('liest nur fehlende/veraltete Koepfe, merkt sie mit Listing-Zeit, laesst Fehler je Datei stehen', async () => {
    const lesen = vi.fn(async (id: string) => {
      if (id === 'kaputt') throw new Error('NOT_FOUND')
      return BELEG
    })
    const speichern = vi.fn(async () => undefined)
    const zeilen = [
      zeile('neu', null),
      zeile('aktuell', { fields: { vorhaben: ['x'] }, sourceModifiedAt: '2026-10-01T00:00:00Z' }),
      zeile('veraltet', { fields: { vorhaben: ['alt'] }, sourceModifiedAt: '2026-09-01T00:00:00Z' }),
      zeile('kaputt', null),
    ]
    const dateiZeit = new Map<string, string | null>([
      ['neu', '2026-11-01T00:00:00Z'], ['aktuell', '2026-10-01T00:00:00Z'], ['veraltet', '2026-10-15T00:00:00Z'],
    ])
    const r = await ergaenzeBelegKoepfe({ zeilen, dateiZeit, ports: { lesen, speichern }, parallel: 2 })
    expect(r.statistik).toEqual({ gelesen: 2, ausMerker: 1, fehler: ['kaputt.md: NOT_FOUND'] })
    expect(lesen.mock.calls.map((c) => c[0]).sort()).toEqual(['kaputt', 'neu', 'veraltet'])
    expect(speichern).toHaveBeenCalledTimes(2)
    expect(speichern).toHaveBeenCalledWith('neu', expect.objectContaining({ hauptvorhaben: '24.05 Konferenzen' }), '2026-11-01T00:00:00Z')
    // Der Frontmatter-Leser laesst die Flow-Liste als String stehen; `belegVorhaben` zerlegt sie spaeter.
    expect(r.zeilen[0].sourceFrontmatter).toEqual({
      fields: expect.objectContaining({ vorhaben: '[24.05 Konferenzen, 24.03 bcoop]', ende: '2026-10-30' }), sourceModifiedAt: '2026-11-01T00:00:00Z',
    })
    expect(r.zeilen[1].sourceFrontmatter?.fields).toEqual({ vorhaben: ['x'] })
    expect(r.zeilen[2].sourceFrontmatter?.sourceModifiedAt).toBe('2026-10-15T00:00:00Z')
    expect(r.zeilen[3].sourceFrontmatter).toBeNull()
    // Eingabe unveraendert
    expect(zeilen[0].sourceFrontmatter).toBeNull()
  })
})
