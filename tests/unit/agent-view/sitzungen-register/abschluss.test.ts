/**
 * @fileoverview Unit-Tests R4: Eingabe, Beleg-Kopf, Register-Vorpruefung und Folgeaufrufe von sitzung_abschliessen.
 */

import { describe, it, expect } from 'vitest'
import { BELEG_TEXT_MAX_BYTES } from '@/lib/agent-view/sitzungen-register/abschluss/abschluss-typen'
import { pruefeBelegKopf } from '@/lib/agent-view/sitzungen-register/abschluss/beleg-pruefen'
import { leseAbschlussEingabe, type AbschlussRoh } from '@/lib/agent-view/sitzungen-register/abschluss/eingabe-lesen'
import { planeFolgeaufrufe } from '@/lib/agent-view/sitzungen-register/abschluss/folgeaufrufe'
import { planeRegisterAbschluss } from '@/lib/agent-view/sitzungen-register/abschluss/register-planen'
import { K1, K2, LIB, doc } from './fixtures'

const ROH: AbschlussRoh = { libraryId: LIB, sitzungId: K1, quelle: 'cowork', vorhabenPfad: '6. Lab/24.09 KnowledgeScout', belegPfad: '6. Lab/24.09 KnowledgeScout/2026-11-15 Chat Register.md' }
const KOPF = { type: 'chatverlauf', session_id: K1, werkzeug: 'cowork', titel: 'Register gebaut', datum: '2026-11-15', ende: '2026-11-16', zuege_von_bis: '1-12', vorhaben: '[24.09 KnowledgeScout, 26.08 Archiv]', hauptvorhaben: '24.09 KnowledgeScout', repo: '' }
const kopf = (meta: Record<string, unknown>, extra: Partial<Parameters<typeof pruefeBelegKopf>[0]> = {}) =>
  pruefeBelegKopf({ meta, belegName: '2026-11-15 Chat Register gebaut.md', eingabe: { sitzungId: K1, quelle: 'cowork', zugbereich: null }, hauptvorhaben: '24.09 KnowledgeScout', nebenvorhaben: [], ...extra })

describe('leseAbschlussEingabe', () => {
  it('genau ein Ort und genau ein Beleg-Weg', () => {
    expect(leseAbschlussEingabe(ROH)).toMatchObject({ ort: { art: 'pfad' }, beleg: { art: 'pfad' }, nrAlt: null, nebenvorhaben: [] })
    expect(() => leseAbschlussEingabe({ ...ROH, ohneVorhaben: true })).toThrow(/eingabe_ungueltig: Ort: genau einer .*angegeben: vorhabenPfad, ohneVorhaben/)
    expect(() => leseAbschlussEingabe({ ...ROH, belegPfad: undefined })).toThrow(/Beleg: genau einer .*angegeben: keiner/)
  })

  it('Text braucht einen Beleg-Namen und bleibt unter der Grenze (E8)', () => {
    const text = { ...ROH, belegPfad: undefined, belegText: '---\ntype: chatverlauf\n---' }
    expect(() => leseAbschlussEingabe(text)).toThrow(/belegText braucht belegName/)
    expect(() => leseAbschlussEingabe({ ...text, belegName: 'Register.md' })).toThrow(/name_ungueltig/)
    expect(leseAbschlussEingabe({ ...text, belegName: '2026-11-15 Chat Register.md' }).beleg).toMatchObject({ art: 'text', name: '2026-11-15 Chat Register.md' })
    expect(() => leseAbschlussEingabe({ ...text, belegName: '2026-11-15 Chat R.md', belegText: 'x'.repeat(BELEG_TEXT_MAX_BYTES + 1) })).toThrow(/beleg_zu_gross/)
  })

  it('Kennung voll, nrAlt nicht leer', () => {
    expect(() => leseAbschlussEingabe({ ...ROH, sitzungId: '36a7ce26' })).toThrow(/keine volle Kennung/)
    expect(() => leseAbschlussEingabe({ ...ROH, nrAlt: ' ' })).toThrow(/nrAlt ist leer/)
  })
})

describe('pruefeBelegKopf', () => {
  it('Meldung aus dem Kopf; leere Felder bleiben weg', () => {
    const r = kopf(KOPF)
    expect(r.meldung).toEqual({ sitzungId: K1, quelle: 'cowork', titel: 'Register gebaut', beginn: '2026-11-15', ende: '2026-11-16', repo: undefined, branch: undefined })
    expect(r.hinweise).toEqual([])
  })

  it('falscher Typ oder fremde Kennung brechen ab', () => {
    expect(() => kopf({ ...KOPF, type: 'sitzung' })).toThrow(/beleg_kopf: .*type ist „sitzung"/)
    expect(() => kopf({ ...KOPF, session_id: undefined })).toThrow(/ohne session_id/)
    expect(() => kopf({ ...KOPF, session_id: K2 })).toThrow(/kennung_abweichend/)
  })

  it('Zugbereich muss zuege_von_bis entsprechen', () => {
    expect(() => kopf(KOPF, { eingabe: { sitzungId: K1, quelle: 'cowork', zugbereich: { von: 1, bis: 10 } } })).toThrow(/zuege_abweichend: .*1-12, der Aufruf nennt 1-10/)
    expect(kopf(KOPF, { eingabe: { sitzungId: K1, quelle: 'cowork', zugbereich: { von: 1, bis: 12 } } }).hinweise).toEqual([])
  })

  it('Pfade statt Namen im Kopf sind kein Hinweis (verglichen wird der Ordnername)', () => {
    const r = kopf({ ...KOPF, hauptvorhaben: '6. Lab/24.09 KnowledgeScout', vorhaben: ['6. Lab/24.09 KnowledgeScout', '6. Lab/26.08 Archiv'] }, { nebenvorhaben: ['26.08 Archiv'] })
    expect(r.hinweise).toEqual([])
  })

  it('Werkzeug, Vorhaben und Datum werden Hinweise', () => {
    const r = kopf({ ...KOPF, werkzeug: 'chat', datum: '2026-11-14' }, { hauptvorhaben: '26.08 Archiv', nebenvorhaben: ['26.10 Webseite'] })
    expect(r.hinweise).toEqual([
      'Kopf sagt chat (werkzeug chat), der Aufruf cowork — das Register nimmt den Aufruf',
      'Kopf nennt hauptvorhaben „24.09 KnowledgeScout", abgelegt wird in „26.08 Archiv"',
      'Nebenvorhaben „26.10 Webseite" fehlt in vorhaben: des Kopfs — der Block dort nennt die Sitzung erst, wenn der Kopf es sagt',
      'Datum im Namen 2026-11-15, im Kopf 2026-11-14 — der Name gilt (Starttag)',
    ])
  })
})

describe('planeRegisterAbschluss', () => {
  const alt = doc({ registerId: 'alt:B45', sitzungId: undefined, kennung: 'keine', gemeldetVon: 'import', nrAlt: 'B45' })

  it('ohne nrAlt nichts umzuschluesseln', () => {
    expect(planeRegisterAbschluss({ sitzungId: K1, nrAlt: null, bestehend: null, alt: null })).toEqual({ umschluesseln: null, hinweise: [] })
  })

  it('Altzeile wird umgeschluesselt; eine reine Archiv-Zeile wird hineingefuehrt', () => {
    expect(planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: null, alt }).umschluesseln).toBe('alt:B45')
    const archiv = doc({ gemeldetVon: 'archiv' })
    expect(planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: archiv, alt }).hinweise).toEqual([`Archiv-Zeile ${K1} wird in alt:B45 hineingefuehrt`])
  })

  it('Fehler vor dem Schreiben: fehlende Altzeile, gepflegte Kennung, falsches Kuerzel', () => {
    expect(() => planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: null, alt: null })).toThrow(/nr_alt_unbekannt/)
    expect(() => planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: doc({ bemerkung: 'x' }), alt })).toThrow(/kennung_vergeben/)
    expect(() => planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: null, alt: { ...alt, kennungPraefix: '36a7ce26' } })).toThrow(/passt nicht zum Kuerzel/)
  })

  it('zweiter Aufruf: Nummer schon an der Kennung → kein Fehler', () => {
    expect(planeRegisterAbschluss({ sitzungId: K1, nrAlt: 'B45', bestehend: doc({ nrAlt: 'B44, B45' }), alt: null })).toEqual({
      umschluesseln: null, hinweise: [`alt:B45 ist schon auf ${K1} umgeschluesselt`],
    })
  })
})

describe('planeFolgeaufrufe (E7: der Skill ruft sie)', () => {
  const ordner = [{ folderId: 'v-ks', name: '24.09 KnowledgeScout' }, { folderId: 'v-ar', name: '26.08 Archiv' }]
  const plane = (transformation: Parameters<typeof planeFolgeaufrufe>[0]['transformation'], blockOrdner = ordner) =>
    planeFolgeaufrufe({ libraryId: LIB, sitzungId: K1, sourceId: 's-1', transformation, blockOrdner })

  it('Job: job_status, dann EIN sitzung_eintragen fuer alle Vorhaben (R4b: kein Teilbaum-Block, kein voller Chronik-Lauf)', () => {
    const a = plane({ jobId: 'j-1', erzwungen: 'nicht_noetig' })
    expect(a.map((x) => x.werkzeug)).toEqual(['job_status', 'sitzung_eintragen'])
    expect(a[0].argumente).toEqual({ jobId: 'j-1' })
    expect(a[1].argumente).toEqual({ libraryId: LIB, sitzungId: K1, begruendung: `Folgeschritt sitzung_abschliessen ${K1}` })
    expect(a[1].wann).toContain('24.09 KnowledgeScout, 26.08 Archiv')
  })

  it('gescheiterter Start: Neustart vorne; aktuelle Notiz: sofort, ohne Job; ohne Vorhaben nur die Chronik', () => {
    expect(plane({ fehler: 'kaputt' })[0]).toMatchObject({ werkzeug: 'transformation_starten', argumente: { sourceId: 's-1', template: 'chatverlauf-de' } })
    const abgesagt = plane({ abgesagt: 'aktuell' })
    expect(abgesagt[0].wann).toMatch(/^sofort/)
    expect(plane({ abgesagt: 'aktuell' }, []).map((x) => x.werkzeug)).toEqual(['sichten_regenerieren'])
  })
})
