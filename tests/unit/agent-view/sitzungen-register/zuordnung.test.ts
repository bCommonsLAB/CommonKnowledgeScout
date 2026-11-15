/**
 * @fileoverview Unit-Tests: Ist eines Belegs lesen und Soll/Ist zusammenfuehren (R1).
 */

import { describe, it, expect } from 'vitest'
import {
  istAusTransformation, quelleAusWerkzeug, registerIdFuerBeleg, zuegeLesen,
} from '@/lib/agent-view/sitzungen-register/ist-beleg'
import { ordneIstZu } from '@/lib/agent-view/sitzungen-register/ist-zuordnen'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { JETZT, K1, K2, K_CLOUD, LIB, beleg, doc } from './fixtures'

const transformation = (o: Partial<TransformationZeile> = {}): TransformationZeile => ({
  sourceId: 'src-1', sourceName: '2026-11-15 Code Sitzungsregister.md', parentId: 'v-ks',
  frontmatter: { title: 'Notiz-Titel', sitzung: K1, werkzeug: 'claude-code', date: '2026-11-14' },
  updatedAt: '2026-11-15T10:00:00.000Z', sourceFrontmatter: null, ...o,
})

describe('ist-beleg', () => {
  it('zuegeLesen: 1-10, verdreht oder unlesbar', () => {
    expect(zuegeLesen('1-10')).toEqual({ von: 1, bis: 10 })
    expect(zuegeLesen(' 3 - 7 ')).toEqual({ von: 3, bis: 7 })
    expect(zuegeLesen('10-1')).toBeNull()
    expect(zuegeLesen('alle')).toBeNull()
    expect(zuegeLesen(undefined)).toBeNull()
  })

  it('quelleAusWerkzeug: Code lokal vs. Cloud an der Kennung, unbekannt = null', () => {
    expect(quelleAusWerkzeug('code', K1)).toBe('code_lokal')
    expect(quelleAusWerkzeug('claude-code', K_CLOUD)).toBe('code_cloud')
    expect(quelleAusWerkzeug('claude-cowork', null)).toBe('cowork')
    expect(quelleAusWerkzeug('chat', K1)).toBe('chat')
    expect(quelleAusWerkzeug('notebook', K1)).toBeNull()
    expect(quelleAusWerkzeug(null, K1)).toBeNull()
  })

  it('istAusTransformation: Kennung und Werkzeug aus dem Beleg-Kopf vor der Notiz (W9)', () => {
    const b = istAusTransformation(transformation({
      sourceFrontmatter: { fields: { session_id: K2, werkzeug: 'cowork', zuege_von_bis: '1-12', titel: 'Kopf-Titel', repo: 'r', branch: 'b' }, sourceModifiedAt: null },
    }))
    expect(b).toMatchObject({ kopfKennung: K2, notizKennung: K1, werkzeug: 'cowork', zuege: { von: 1, bis: 12 }, titel: 'Kopf-Titel', repo: 'r', branch: 'b' })
    expect(b.datum).toBe('2026-11-15')
  })

  it('istAusTransformation: ohne Merker gilt die Notiz', () => {
    expect(istAusTransformation(transformation())).toMatchObject({ kopfKennung: null, notizKennung: K1, werkzeug: 'claude-code', titel: 'Notiz-Titel', hatNotiz: true })
  })

  it('registerIdFuerBeleg: volle Kennung, sonst beleg:<sourceId> (auch bei Kuerzel)', () => {
    expect(registerIdFuerBeleg(beleg())).toBe(K1)
    expect(registerIdFuerBeleg(beleg({ kopfKennung: null, notizKennung: 'da8f' }))).toBe('beleg:src-1')
    expect(registerIdFuerBeleg(beleg({ kopfKennung: null, notizKennung: null }))).toBe('beleg:src-1')
  })
})

describe('ordneIstZu', () => {
  const ordne = (docs: ReturnType<typeof doc>[], belege: ReturnType<typeof beleg>[]) =>
    ordneIstZu({ libraryId: LIB, docs, belege, jetzt: JETZT })

  it('ueber die Kennung zur gespeicherten Zeile', () => {
    const [z] = ordne([doc()], [beleg()])
    expect(z.gespeichert).toBe(true)
    expect(z.belege.map((b) => b.sourceId)).toEqual(['src-1'])
  })

  it('belegSourceIds gehen vor der Kennung', () => {
    const zeilen = ordne([doc(), doc({ registerId: 'alt:17', sitzungId: undefined, kennung: 'keine', belegSourceIds: ['src-1'] })], [beleg()])
    expect(zeilen.find((z) => z.doc.registerId === 'alt:17')?.belege).toHaveLength(1)
    expect(zeilen.find((z) => z.doc.registerId === K1)?.belege).toHaveLength(0)
  })

  it('Praefix-Zeile nimmt den Beleg, wenn sie die einzige passende ist', () => {
    const p = doc({ registerId: 'alt:3', sitzungId: undefined, kennung: 'praefix', kennungPraefix: K1.slice(0, 8) })
    const [z] = ordne([p], [beleg()])
    expect(z.doc.registerId).toBe('alt:3')
    expect(z.belege).toHaveLength(1)
  })

  it('mehrdeutiges Praefix: Hinweis an beiden Zeilen, Beleg wird Archiv-Zeile', () => {
    const p1 = doc({ registerId: 'alt:3', sitzungId: undefined, kennung: 'praefix', kennungPraefix: K1.slice(0, 8) })
    const p2 = doc({ registerId: 'alt:4', sitzungId: undefined, kennung: 'praefix', kennungPraefix: K1.slice(0, 4) })
    const zeilen = ordne([p1, p2], [beleg()])
    expect(zeilen.filter((z) => z.hinweise.some((h) => h.code === 'praefix_mehrdeutig')).map((z) => z.doc.registerId)).toEqual(['alt:3', 'alt:4'])
    const archiv = zeilen.find((z) => !z.gespeichert)
    expect(archiv?.doc.registerId).toBe(K1)
  })

  it('unbekannte Teil-Belege derselben Kennung werden EINE Archiv-Zeile', () => {
    const zeilen = ordne([], [beleg({ sourceId: 'b', zuege: { von: 21, bis: 40 } }), beleg({ sourceId: 'a' })])
    expect(zeilen).toHaveLength(1)
    const [z] = zeilen
    expect(z.gespeichert).toBe(false)
    expect(z.doc).toMatchObject({ registerId: K1, sitzungId: K1, kennung: 'voll', quelle: 'code_lokal', gemeldetVon: 'archiv', belegSourceIds: ['a', 'b'] })
    expect(z.belege.map((b) => b.sourceId)).toEqual(['a', 'b'])
  })

  it('Archiv-Zeile mit Kuerzel: kennung praefix, Schluessel beleg:<sourceId>', () => {
    const [z] = ordne([], [beleg({ kopfKennung: null, notizKennung: 'da8f', werkzeug: 'mystery' })])
    expect(z.doc).toMatchObject({ registerId: 'beleg:src-1', kennung: 'praefix', kennungPraefix: 'da8f', quelle: null })
    expect(z.doc.sitzungId).toBeUndefined()
  })

  it('kennung_abweichend: Kopf und Notiz nennen verschiedene Kennungen', () => {
    const [z] = ordne([doc()], [beleg({ notizKennung: K2 })])
    expect(z.hinweise.map((h) => h.code)).toEqual(['kennung_abweichend'])
  })

  it('ein Beleg bei zwei Zeilen wird als doppelt gemeldet', () => {
    const zeilen = ordne([doc({ belegSourceIds: ['x'] }), doc({ registerId: K2, sitzungId: K2, belegSourceIds: ['x'] })], [])
    expect(zeilen.find((z) => z.doc.registerId === K2)?.hinweise.map((h) => h.code)).toEqual(['doppelt'])
  })
})
