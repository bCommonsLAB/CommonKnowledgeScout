/**
 * @fileoverview Unit-Tests: Melden (idempotent) und Setzen (Regeln, Umschluesseln) im Register (R1).
 */

import { describe, it, expect } from 'vitest'
import {
  SitzungsEingabeError, istReineArchivZeile, planeMeldung, planeSetzen, pruefeKennung, pruefeZugbereiche,
} from '@/lib/agent-view/sitzungen-register/schreib-plaene'
import { JETZT, K1, K2, LIB, doc } from './fixtures'

const melde = (bestehend: ReturnType<typeof doc> | null, eingabe: Parameters<typeof planeMeldung>[0]['eingabe']) =>
  planeMeldung({ libraryId: LIB, bestehend, eingabe, gemeldetVon: 'skill', jetzt: JETZT })

describe('pruefeKennung', () => {
  it('lehnt Kuerzel und reservierte Praefixe ab', () => {
    expect(() => pruefeKennung('da8f12ab')).toThrow(SitzungsEingabeError)
    expect(() => pruefeKennung('alt:12345678901234567890')).toThrow(/Register-Schluessel/)
    expect(() => pruefeKennung(K1)).not.toThrow()
  })
})

describe('planeMeldung', () => {
  it('legt eine neue Zeile mit Kennung als Schluessel an', () => {
    const plan = melde(null, { sitzungId: K1, quelle: 'cowork', titel: 'T', prs: ['#1', '#1'] })
    expect(plan.aktion).toBe('angelegt')
    if (plan.aktion !== 'angelegt') return
    expect(plan.doc).toMatchObject({ registerId: K1, sitzungId: K1, kennung: 'voll', quelle: 'cowork', prs: ['#1'], gemeldetVon: 'skill', entscheidung: 'offen' })
  })

  it('dieselbe Meldung zweimal ist unveraendert', () => {
    const d = doc({ quelle: 'code_lokal', titelOriginal: 'Sitzungsregister', prs: ['#1'] })
    expect(melde(d, { sitzungId: K1, quelle: 'code_lokal', titel: 'Sitzungsregister', prs: ['#1'] })).toEqual({ aktion: 'unveraendert', belassen: [] })
  })

  it('gemeldete Felder ergaenzen; neue PRs kommen dazu', () => {
    const plan = melde(doc({ quelle: null, prs: ['#1'] }), { sitzungId: K1, quelle: 'code_cloud', prs: ['#1', '#2'], branch: 'claude/x' })
    expect(plan).toMatchObject({ aktion: 'ergaenzt', neuePrs: ['#2'], felder: ['quelle', 'branch', 'prs'] })
    if (plan.aktion === 'ergaenzt') expect(plan.set).toMatchObject({ quelle: 'code_cloud', branch: 'claude/x', geaendertAm: JETZT })
  })

  it('ein vorhandener Vorhaben-Vorschlag bleibt und wird als belassen genannt', () => {
    const d = doc({ vorhabenVorschlag: { ordner: 'A', herkunft: 'owner' } })
    expect(melde(d, { sitzungId: K1, quelle: 'code_lokal', vorhabenVorschlag: { ordner: 'B', herkunft: 'skill' } }))
      .toEqual({ aktion: 'unveraendert', belassen: ['vorhabenVorschlag'] })
  })

  it('ein fehlender Vorhaben-Vorschlag wird gesetzt', () => {
    const plan = melde(doc(), { sitzungId: K1, quelle: 'code_lokal', vorhabenVorschlag: { ordner: 'B', herkunft: 'skill' } })
    expect(plan).toMatchObject({ aktion: 'ergaenzt', felder: ['vorhabenVorschlag'] })
  })
})

describe('planeSetzen', () => {
  it('ueberspringen braucht einen Grund', () => {
    expect(() => planeSetzen(doc(), { entscheidung: 'ueberspringen' }, JETZT)).toThrow(/entscheidungGrund/)
    expect(planeSetzen(doc(), { entscheidung: 'ueberspringen', entscheidungGrund: ' nur Test ' }, JETZT).set)
      .toMatchObject({ entscheidung: 'ueberspringen', entscheidungGrund: 'nur Test', geaendertAm: JETZT })
  })

  it('trennen braucht zwei getrennte Zugbereiche', () => {
    expect(() => planeSetzen(doc(), { entscheidung: 'trennen', zugbereiche: [{ von: 1, bis: 10 }] }, JETZT)).toThrow(/zwei/)
    expect(() => planeSetzen(doc(), { entscheidung: 'trennen', zugbereiche: [{ von: 1, bis: 10 }, { von: 10, bis: 20 }] }, JETZT)).toThrow(/ueberschneiden/)
    const plan = planeSetzen(doc(), { entscheidung: 'trennen', zugbereiche: [{ von: 11, bis: 20 }, { von: 1, bis: 10 }] }, JETZT)
    expect(plan.set.zugbereiche).toEqual([{ von: 1, bis: 10 }, { von: 11, bis: 20 }])
  })

  it('zurueck auf offen loescht den Grund; leere Bemerkung loescht', () => {
    const d = doc({ entscheidung: 'ueberspringen', entscheidungGrund: 'x', bemerkung: 'alt' })
    expect(planeSetzen(d, { entscheidung: 'offen', bemerkung: '' }, JETZT).set)
      .toMatchObject({ entscheidung: 'offen', entscheidungGrund: null, bemerkung: null })
  })

  it('ohne Aenderung keine Felder und kein Zeitstempel', () => {
    expect(planeSetzen(doc(), { entscheidung: 'offen' }, JETZT)).toEqual({ set: {}, unset: [], felder: [], neueKennung: null })
  })

  it('Kennung nachtragen schluesselt um und entfernt das Praefix', () => {
    const alt = doc({ registerId: 'alt:17', sitzungId: undefined, kennung: 'praefix', kennungPraefix: K1.slice(0, 8), nrAlt: 17 })
    const plan = planeSetzen(alt, { sitzungId: K1 }, JETZT)
    expect(plan).toMatchObject({ neueKennung: K1, unset: ['kennungPraefix'], felder: ['sitzungId'] })
    expect(plan.set).toMatchObject({ registerId: K1, sitzungId: K1, kennung: 'voll' })
  })

  it('Kennung passt nicht zum Praefix oder Zeile hat schon eine', () => {
    const alt = doc({ registerId: 'alt:17', sitzungId: undefined, kennung: 'praefix', kennungPraefix: K1.slice(0, 8) })
    expect(() => planeSetzen(alt, { sitzungId: K2 }, JETZT)).toThrow(/Praefix/)
    expect(() => planeSetzen(doc(), { sitzungId: K2 }, JETZT)).toThrow(/schon die Kennung/)
  })

  it('pruefeZugbereiche lehnt verdrehte Bereiche ab', () => {
    expect(() => pruefeZugbereiche([{ von: 5, bis: 2 }])).toThrow(SitzungsEingabeError)
  })
})

describe('istReineArchivZeile', () => {
  it('nur gemeldetVon archiv ohne Gepflegtes', () => {
    expect(istReineArchivZeile(doc({ gemeldetVon: 'archiv' }))).toBe(true)
    expect(istReineArchivZeile(doc({ gemeldetVon: 'archiv', bemerkung: 'x' }))).toBe(false)
    expect(istReineArchivZeile(doc({ gemeldetVon: 'skill' }))).toBe(false)
  })
})
