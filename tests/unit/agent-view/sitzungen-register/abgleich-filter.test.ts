/**
 * @fileoverview Unit-Tests: Abgleich der Sichten-Laeufe, Zusammenfuehren, Filter und Bilanz (R1).
 */

import { describe, it, expect } from 'vitest'
import { planeAbgleich, zusammenfuehren, type BelegAblage } from '@/lib/agent-view/sitzungen-register/abgleich'
import { bilanz, filtereSitzungen, sortiereSitzungen } from '@/lib/agent-view/sitzungen-register/filter'
import { ordneIstZu } from '@/lib/agent-view/sitzungen-register/ist-zuordnen'
import { zuSicht } from '@/lib/agent-view/sitzungen-register/stand-rechnen'
import type { SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'
import { ABLAGE_KS, JETZT, K1, K2, LIB, beleg, doc } from './fixtures'

const ORT: BelegAblage = { vorhabenPfad: ABLAGE_KS.vorhabenPfad, vorhabenFolderId: 'v-ks', belegOrdnerPfad: ABLAGE_KS.belegOrdnerPfad }
const plane = (docs: SitzungsRegisterDoc[], art: 'chronik' | 'block', berichtet: string[] = ['src-1']) =>
  planeAbgleich({ libraryId: LIB, docs, belege: [beleg()], ablagen: new Map([['src-1', ORT]]), berichtet: new Set(berichtet), art, jetzt: JETZT })

describe('planeAbgleich', () => {
  it('legt fuer einen unbekannten Beleg eine Archiv-Zeile mit Ablage und Stempel an', () => {
    const plan = plane([], 'chronik')
    expect(plan.aenderungen).toEqual([])
    expect(plan.neu).toHaveLength(1)
    expect(plan.neu[0]).toMatchObject({
      registerId: K1, gemeldetVon: 'archiv', belegSourceIds: ['src-1'],
      ablage: { ...ORT, geprueftAm: JETZT }, berichtet: { chronikAm: JETZT, blockAm: null },
    })
  })

  it('ergaenzt eine gespeicherte Zeile: Ablage, Block-Stempel, neue sourceId', () => {
    const plan = plane([doc()], 'block')
    expect(plan.neu).toEqual([])
    expect(plan.aenderungen).toEqual([{
      registerId: K1, am: JETZT, ablage: { ...ORT, geprueftAm: JETZT }, stempel: { feld: 'blockAm', am: JETZT }, neueBelegSourceIds: ['src-1'],
    }])
  })

  it('kein Stempel fuer Belege, die der Lauf nicht berichtet hat', () => {
    const [a] = plane([doc({ belegSourceIds: ['src-1'] })], 'block', []).aenderungen
    expect(a.stempel).toBeUndefined()
    expect(a.neueBelegSourceIds).toEqual([])
  })

  it('Zeilen ohne Beleg im Lauf bleiben unberuehrt', () => {
    const plan = planeAbgleich({ libraryId: LIB, docs: [doc({ registerId: K2, sitzungId: K2 })], belege: [], ablagen: new Map(), berichtet: new Set(), art: 'chronik', jetzt: JETZT })
    expect(plan).toEqual({ neu: [], aenderungen: [], hinweise: [] })
  })

  it('Teil-Belege in verschiedenen Vorhaben werden als Hinweis genannt', () => {
    const plan = planeAbgleich({
      libraryId: LIB, docs: [], art: 'chronik', jetzt: JETZT, berichtet: new Set(),
      belege: [beleg({ sourceId: 'a' }), beleg({ sourceId: 'b', zuege: { von: 21, bis: 30 } })],
      ablagen: new Map([['a', ORT], ['b', { ...ORT, vorhabenFolderId: 'v-anders', vorhabenPfad: 'X' }]]),
    })
    expect(plan.hinweise).toHaveLength(1)
    expect(plan.neu[0].ablage?.vorhabenFolderId).toBe('v-ks')
  })
})

describe('zusammenfuehren', () => {
  it('Gepflegtes aus dem Ziel, Belege und Stempel aus beiden', () => {
    const ziel = doc({ registerId: 'alt:17', sitzungId: undefined, quelle: 'cowork', titelOriginal: 'Altliste', belegSourceIds: [] })
    const archiv = doc({ gemeldetVon: 'archiv', quelle: 'code_lokal', titelOriginal: 'Beleg', belegSourceIds: ['src-1'], ablage: ABLAGE_KS, berichtet: { chronikAm: JETZT, blockAm: null } })
    expect(zusammenfuehren(ziel, archiv)).toMatchObject({
      belegSourceIds: ['src-1'], ablage: ABLAGE_KS, berichtet: { chronikAm: JETZT, blockAm: null }, quelle: 'cowork', titelOriginal: 'Altliste',
    })
  })
})

describe('filtereSitzungen / sortiereSitzungen / bilanz', () => {
  const docs = [
    doc({ registerId: K1, sitzungId: K1, beginn: '2026-11-10', ablage: ABLAGE_KS }),
    doc({ registerId: K2, sitzungId: K2, quelle: 'cowork', beginn: '2026-11-14', gemeldetAm: '2026-11-01T00:00:00.000Z' }),
    doc({ registerId: 'alt:3', sitzungId: undefined, kennung: 'keine', quelle: null, beginn: null, altNotizPfad: 'Organisation/Sitzungen/n.md' }),
  ]
  const zeilen = ordneIstZu({ libraryId: LIB, docs, belege: [beleg()], jetzt: JETZT }).map((z) => zuSicht(z, new Map()))
  const jetzt = new Date(JETZT)
  const ids = (f: Parameters<typeof filtereSitzungen>[1]) => filtereSitzungen(zeilen, f, jetzt).map((z) => z.registerId)

  it('Stand, Quelle, Vorhaben (Pfad mit Unterordnern oder folderId)', () => {
    expect(ids({ stand: ['notiz'] })).toEqual([K1])
    expect(ids({ quelle: ['cowork'] })).toEqual([K2])
    expect(ids({ vorhaben: '6. Lab' })).toEqual([K1])
    expect(ids({ vorhaben: 'v-ks' })).toEqual([K1])
    expect(ids({ vorhaben: '6. La' })).toEqual([])
  })

  it('Zeitraum ueber beginn; Zeilen ohne beginn fallen heraus', () => {
    expect(ids({ von: '2026-11-12' })).toEqual([K2])
    expect(ids({ bis: '2026-11-12' })).toEqual([K1])
  })

  it('auffaellig: notiz_ohne_beleg und gemeldet_ohne_beleg mit seitTagen', () => {
    expect(ids({ auffaellig: 'notiz_ohne_beleg' })).toEqual(['alt:3'])
    expect(ids({ auffaellig: 'gemeldet_ohne_beleg', seitTagen: 7 })).toEqual([K2])
    expect(() => ids({ auffaellig: 'gemeldet_ohne_beleg' })).toThrow(/seitTagen/)
  })

  it('juengste zuerst, ohne beginn am Ende', () => {
    expect(sortiereSitzungen(zeilen).map((z) => z.registerId)).toEqual([K2, K1, 'alt:3'])
  })

  it('Bilanz je Stand, Quelle und Auffaelligkeit', () => {
    const b = bilanz(zeilen)
    expect(b.gesamt).toBe(3)
    expect(b.jeStand).toMatchObject({ notiz: 1, gemeldet: 2, berichtet: 0 })
    expect(b.jeQuelle).toMatchObject({ code_lokal: 1, cowork: 1, unbekannt: 1 })
    expect(b.auffaellig.notiz_ohne_beleg).toBe(1)
    expect(b.ohneVorhabenBestimmt).toBe(2)
  })
})
