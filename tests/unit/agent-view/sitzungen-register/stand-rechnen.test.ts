/**
 * @fileoverview Unit-Tests: gerechneter Stand einer Register-Zeile und ihre Hinweise (R1).
 */

import { describe, it, expect } from 'vitest'
import { belegeDoppelt, rechneStand, zuSicht } from '@/lib/agent-view/sitzungen-register/stand-rechnen'
import type { ZugeordneteZeile } from '@/lib/agent-view/sitzungen-register/ist-zuordnen'
import { ABLAGE_KS, beleg, doc } from './fixtures'

const KEINE = new Map<string, string>()
const zeile = (o: Partial<ZugeordneteZeile> = {}): ZugeordneteZeile => ({ doc: doc(), gespeichert: true, belege: [], hinweise: [], ...o })
const codes = (z: ZugeordneteZeile, fehlend = KEINE) => rechneStand(z, fehlend).hinweise.map((h) => h.code)

describe('rechneStand — Rangfolge', () => {
  it('gemeldet: nur die Zeile, kein Beleg', () => {
    expect(rechneStand(zeile(), KEINE).stand).toBe('gemeldet')
  })

  it('beleg: Beleg ohne Notiz', () => {
    expect(rechneStand(zeile({ belege: [beleg({ hatNotiz: false, notizAktualisiert: null })] }), KEINE).stand).toBe('beleg')
  })

  it('notiz: Notiz da, aber noch nicht berichtet', () => {
    expect(rechneStand(zeile({ belege: [beleg()] }), KEINE).stand).toBe('notiz')
  })

  it('berichtet: Chronik und Block juenger als die Notiz', () => {
    const d = doc({ ablage: ABLAGE_KS, berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: '2026-11-15T11:30:00.000Z' } })
    expect(rechneStand(zeile({ doc: d, belege: [beleg()] }), KEINE).stand).toBe('berichtet')
  })

  it('nur die Chronik reicht nicht, wenn der Beleg in einem Vorhaben liegt', () => {
    const d = doc({ ablage: ABLAGE_KS, berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: null } })
    expect(rechneStand(zeile({ doc: d, belege: [beleg()] }), KEINE).stand).toBe('notiz')
  })

  it('ohne Vorhaben genuegt die Chronik', () => {
    const d = doc({ ablage: { ...ABLAGE_KS, vorhabenPfad: null, vorhabenFolderId: null }, berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: null } })
    expect(rechneStand(zeile({ doc: d, belege: [beleg()] }), KEINE).stand).toBe('berichtet')
  })

  it('eine juengere Notiz macht berichtet wieder zu notiz', () => {
    const d = doc({ ablage: ABLAGE_KS, berichtet: { chronikAm: '2026-11-15T09:00:00.000Z', blockAm: '2026-11-15T09:00:00.000Z' } })
    expect(rechneStand(zeile({ doc: d, belege: [beleg()] }), KEINE).stand).toBe('notiz')
  })

  it('uebersprungen schlaegt alles und meldet einen vorhandenen Beleg', () => {
    const z = zeile({ doc: doc({ entscheidung: 'ueberspringen', entscheidungGrund: 'nur Test' }), belege: [beleg()] })
    expect(rechneStand(z, KEINE).stand).toBe('uebersprungen')
    expect(codes(z)).toContain('uebersprungen_mit_beleg')
  })
})

describe('rechneStand — Hinweise', () => {
  it('doppelt bei zwei Belegen mit ueberlappenden Zuegen, nicht bei getrennten', () => {
    const a = beleg({ sourceId: 'a', zuege: { von: 1, bis: 10 } })
    expect(codes(zeile({ belege: [a, beleg({ sourceId: 'b', zuege: { von: 8, bis: 20 } })] }))).toContain('doppelt')
    expect(codes(zeile({ belege: [a, beleg({ sourceId: 'b', zuege: { von: 11, bis: 20 } })] }))).not.toContain('doppelt')
  })

  it('doppelt, wenn ein Teil-Beleg keine Zuege nennt', () => {
    expect(belegeDoppelt([beleg({ sourceId: 'a' }), beleg({ sourceId: 'b', zuege: null })])).toBe(true)
    expect(belegeDoppelt([beleg()])).toBe(false)
  })

  it('beleg_fehlt fuer belegSourceIds, die der Speicher nicht liefert', () => {
    const z = zeile({ doc: doc({ belegSourceIds: ['weg'] }) })
    expect(codes(z, new Map([['weg', 'itemNotFound']]))).toEqual(['beleg_fehlt'])
  })

  it('notiz_kopie_ohne_beleg und beleg_ohne_vorhaben', () => {
    expect(codes(zeile({ doc: doc({ altNotizPfad: 'Organisation/Sitzungen/x.md' }) }))).toContain('notiz_kopie_ohne_beleg')
    const ohne = doc({ ablage: { ...ABLAGE_KS, vorhabenPfad: null, vorhabenFolderId: null, belegOrdnerPfad: 'Organisation' } })
    expect(codes(zeile({ doc: ohne, belege: [beleg()] }))).toContain('beleg_ohne_vorhaben')
  })

  it('quelle_unbekannt und notiz_ohne_zeitstempel', () => {
    expect(codes(zeile({ doc: doc({ quelle: null }) }))).toContain('quelle_unbekannt')
    const z = zeile({ belege: [beleg({ notizAktualisiert: null })] })
    expect(codes(z)).toContain('notiz_ohne_zeitstempel')
    expect(rechneStand(z, KEINE).stand).toBe('notiz')
  })

  it('Hinweise der Zuordnung bleiben erhalten', () => {
    const z = zeile({ hinweise: [{ code: 'kennung_abweichend', text: 'x' }] })
    expect(codes(z)).toEqual(['kennung_abweichend'])
  })
})

describe('zuSicht', () => {
  it('nimmt Titel und Beginn aus dem Beleg, wenn die Zeile sie nicht kennt', () => {
    const s = zuSicht(zeile({ doc: doc({ titelOriginal: null, beginn: null }), belege: [beleg()] }), KEINE)
    expect(s).toMatchObject({ titel: 'Sitzungsregister', beginn: '2026-11-15', vorhabenBestimmt: false, gespeichert: true })
    expect(s.belege).toEqual([{ sourceId: 'src-1', name: '2026-11-15 Code Sitzungsregister.md', zuege: '1-20', notiz: true, notizAktualisiert: '2026-11-15T10:00:00.000Z' }])
  })

  it('imBericht und Stempel: halb berichtet bleibt sichtbar, uebersprungen verdeckt den Bericht nicht', () => {
    const halb = doc({ ablage: ABLAGE_KS, berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: null } })
    expect(zuSicht(zeile({ doc: halb, belege: [beleg()] }), KEINE)).toMatchObject({
      stand: 'notiz', imBericht: false, berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: null },
    })
    const ganz = doc({ ablage: ABLAGE_KS, entscheidung: 'ueberspringen', entscheidungGrund: 'g', berichtet: { chronikAm: '2026-11-15T11:00:00.000Z', blockAm: '2026-11-15T11:00:00.000Z' } })
    expect(zuSicht(zeile({ doc: ganz, belege: [beleg()] }), KEINE)).toMatchObject({ stand: 'uebersprungen', imBericht: true })
  })

  it('Vorhaben aus dem Ablage-Cache', () => {
    const s = zuSicht(zeile({ doc: doc({ ablage: ABLAGE_KS }) }), KEINE)
    expect(s).toMatchObject({ vorhabenPfad: ABLAGE_KS.vorhabenPfad, vorhabenFolderId: 'v-ks', vorhabenBestimmt: true })
  })
})
