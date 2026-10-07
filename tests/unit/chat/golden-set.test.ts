import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseGoldenSet, pruefeGoldenSetGegenFacetten } from '@/lib/chat/golden-set/schema'
import { antwortOhneFussnote, pruefeGoldenSetFrage } from '@/lib/chat/golden-set/pruefung'
import { buildRichterMessages, werteRichterUrteil } from '@/lib/chat/golden-set/richter'
import { baueBericht, berichtAlsMarkdown, erwarteteWerteDerFrage } from '@/lib/chat/golden-set/bericht'
import { dokumenteNummerieren } from '@/lib/chat/common/zitatmarken'
import { pruefeAntwort } from '@/lib/chat/nachpruefung'
import type { KontextFacette } from '@/lib/chat/quellen-kontext'
import type { RetrievedSource } from '@/types/retriever'

/**
 * Plan story-status-modalitaet, m0: Golden-Set-Schema, deterministische
 * Prüfung, Richter-Rubrik und Bericht — am synthetischen Beispiel aus
 * `golden-set/beispiel.json`. Das echte Set liegt bei der Library.
 */

const beispielPfad = fileURLToPath(new URL('./golden-set/beispiel.json', import.meta.url))
const beispiel = parseGoldenSet(JSON.parse(readFileSync(beispielPfad, 'utf8')))

const FACETS: KontextFacette[] = [
  {
    metaKey: 'lv_bewertung',
    label: 'Bewertung Landesverwaltung',
    werte: [
      { wert: 'in_umsetzung', label: 'in Umsetzung', bedeutung: 'Laut Landesverwaltung in Umsetzung.', verboten: ['ist umgesetzt', 'gibt es seit'] },
      { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', bedeutung: 'Wird nicht umgesetzt.', verboten: ['wird gemacht', 'ist geplant'] },
    ],
  },
]

// [1] SYN-1 nicht umsetzbar, [2] SYN-2 in Umsetzung, [3] Event ohne Status
const sources: RetrievedSource[] = [
  { id: 'f1-0', fileId: 'f1', fileName: 'SYN-1.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'nicht_umsetzbar' } },
  { id: 'f2-0', fileId: 'f2', fileName: 'SYN-2.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'in_umsetzung' } },
  { id: 'f3-0', fileId: 'f3', fileName: 'Event.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: {} },
]
const gruppen = dokumenteNummerieren(sources)
const kennungZuFileId = new Map([['SYN-1', 'f1'], ['SYN-2', 'f2']])
const themenfrage = beispiel.fragen[1]

describe('Golden-Set-Schema', () => {
  it('liest das synthetische Beispiel (drei Fragetypen, Kennung in jedem Dokument)', () => {
    expect(beispiel.kennungFeld).toBe('massnahme_nr')
    expect(beispiel.fragen.map((f) => f.typ)).toEqual(['direkt', 'themenfrage', 'unterstellung'])
  })

  it('lehnt doppelte IDs, fehlende Kennung und unbekannten Typ laut ab', () => {
    const f = beispiel.fragen[0]
    expect(() => parseGoldenSet({ kennungFeld: 'massnahme_nr', fragen: [f, f] })).toThrow(/doppelt/)
    expect(() => parseGoldenSet({ kennungFeld: 'nr', fragen: [f] })).toThrow(/ohne Kennung „nr"/)
    expect(() => parseGoldenSet({ kennungFeld: 'massnahme_nr', fragen: [{ ...f, typ: 'quiz' }] })).toThrow(/typ/)
  })

  it('prüft Facetten-Schlüssel und Wörterbuch-Werte gegen das Schema der Library', () => {
    expect(pruefeGoldenSetGegenFacetten(beispiel, FACETS)).toEqual([])
    const fehler = pruefeGoldenSetGegenFacetten(
      { kennungFeld: 'massnahme_nr', fragen: [{ ...themenfrage, erwarteteDokumente: [{ massnahme_nr: 'X', status: 'a' }, { massnahme_nr: 'Y', lv_bewertung: 'tippfehler' }] }] },
      FACETS,
    )
    expect(fehler).toHaveLength(2)
    expect(fehler[0]).toMatch(/„status" ist keine Facette/)
    expect(fehler[1]).toMatch(/„tippfehler" steht nicht im Wörterbuch/)
  })
})

describe('deterministische Prüfung', () => {
  it('entfernt die m4-Fußnote vor der Prüfung — sonst wären die Labels trivial genannt', () => {
    const ergebnis = pruefeAntwort('Antwort [1]', gruppen, [1], FACETS)
    const mitNote = 'Antwort [1]\n\n---\n*Bewertung Landesverwaltung: 1 × nicht umsetzbar*'
    expect(antwortOhneFussnote(mitNote, ergebnis)).toBe('Antwort [1]')
    expect(antwortOhneFussnote('Antwort [1]', undefined)).toBe('Antwort [1]')
  })

  it('besteht, wenn erwartete Dokumente zitiert, Labels genannt und keine Verbote getroffen sind', () => {
    const antwort = 'Laut Landesverwaltung ist SYN-1 nicht umsetzbar [1]; SYN-2 ist in Umsetzung [2].'
    const e = pruefeGoldenSetFrage({ frage: themenfrage, kennungFeld: 'massnahme_nr', kennungZuFileId, antwort, gruppen, benutzt: [1, 2], facetDefs: FACETS })
    expect(e.deterministisch.dokumente).toEqual({ erwartet: ['SYN-1', 'SYN-2'], gefunden: ['SYN-1', 'SYN-2'], fehlend: [] })
    expect(e.deterministisch.labels.every((l) => l.genannt)).toBe(true)
    expect(e.deterministisch.bestanden).toBe(true)
    expect(e.zitiert).toEqual([1, 2])
  })

  it('fällt bei fehlendem Dokument, fehlendem Label oder Verbotstreffer durch — getrennt ausgewiesen', () => {
    const e = pruefeGoldenSetFrage({ frage: themenfrage, kennungFeld: 'massnahme_nr', kennungZuFileId, antwort: 'SYN-1 wird gemacht [1].', gruppen, benutzt: [1], facetDefs: FACETS })
    expect(e.deterministisch.dokumente.fehlend).toEqual(['SYN-2'])
    expect(e.deterministisch.labels.map((l) => l.genannt)).toEqual([false, false])
    expect(e.deterministisch.verstoesse.map((v) => v.formulierung)).toEqual(['wird gemacht'])
    expect(e.deterministisch.bestanden).toBe(false)
  })

  it('wirft, wenn eine Kennung nicht aufgelöst wurde (Fehler des Läufers, kein stilles Nicht-Gefunden)', () => {
    expect(() =>
      pruefeGoldenSetFrage({ frage: themenfrage, kennungFeld: 'massnahme_nr', kennungZuFileId: new Map(), antwort: 'x', gruppen, benutzt: [], facetDefs: FACETS }),
    ).toThrow(/„SYN-1".*nicht zu einer fileId/)
  })
})

describe('Richter-Rubrik', () => {
  it('gibt dem Richter Legende je zitiertem Dokument und die JSON-Form im Prompt-Text', () => {
    const [system, user] = buildRichterMessages({ frage: themenfrage, antwort: 'A', zitiert: gruppen, facetDefs: FACETS })
    expect(system.content).toContain('"modalitaetKorrekt": true|false')
    expect(user.content).toContain('[1] SYN-1.md\n  Bewertung Landesverwaltung: nicht umsetzbar — Wird nicht umgesetzt.')
    expect(user.content).toContain('[3] Event.md\n  (keine Facettenwerte)')
  })

  it('wertet das Urteil nach den Pflichten der Frage (Gruppierung null = nichts zu gliedern)', () => {
    const basis = { modalitaetKorrekt: true, zuschreibungVorhanden: true, keineErfolgsbehauptung: true, gruppierungNachStatus: null, begruendung: '' }
    expect(werteRichterUrteil(themenfrage, basis).bestanden).toBe(true)
    expect(werteRichterUrteil(themenfrage, { ...basis, gruppierungNachStatus: false }).bestanden).toBe(false)
    expect(werteRichterUrteil(themenfrage, { ...basis, zuschreibungVorhanden: false }).bestanden).toBe(false)
    const ohnePflicht = { ...themenfrage, pflicht: { ...themenfrage.pflicht, zuschreibung: false, gruppierung: false } }
    expect(werteRichterUrteil(ohnePflicht, { ...basis, zuschreibungVorhanden: false, gruppierungNachStatus: false }).bestanden).toBe(true)
    expect(werteRichterUrteil(ohnePflicht, { ...basis, keineErfolgsbehauptung: false }).bestanden).toBe(false)
  })
})

describe('Bericht', () => {
  it('zählt je Typ und je erwartetem Wert; ohne Richter steht ein Strich', () => {
    const ok = pruefeGoldenSetFrage({ frage: themenfrage, kennungFeld: 'massnahme_nr', kennungZuFileId, antwort: 'nicht umsetzbar [1], in Umsetzung [2]', gruppen, benutzt: [1, 2], facetDefs: FACETS })
    const fehl = pruefeGoldenSetFrage({ frage: beispiel.fragen[0], kennungFeld: 'massnahme_nr', kennungZuFileId, antwort: 'SYN-1 ist geplant [1]', gruppen, benutzt: [1], facetDefs: FACETS })
    const bericht = baueBericht([
      { ergebnis: ok, erwarteteWerte: erwarteteWerteDerFrage(beispiel, ok.id) },
      { ergebnis: fehl, erwarteteWerte: erwarteteWerteDerFrage(beispiel, fehl.id) },
    ])
    expect(bericht.gesamt).toEqual({ gesamt: 2, deterministischBestanden: 1 })
    expect(bericht.jeTyp.themenfrage.deterministischBestanden).toBe(1)
    expect(bericht.jeTyp.direkt.deterministischBestanden).toBe(0)
    expect(bericht.jeWert['lv_bewertung=nicht_umsetzbar']).toEqual({ gesamt: 2, deterministischBestanden: 1 })
    expect(bericht.jeWert['lv_bewertung=in_umsetzung']).toEqual({ gesamt: 1, deterministischBestanden: 1 })
    expect(bericht.verstoesse).toBe(1)
    const md = berichtAlsMarkdown(bericht, 'Baseline')
    expect(md).toContain('| gesamt | 1/2 | – |')
    expect(md).toContain('| Typ direkt | 0/1 | – |')
    expect(md).toContain('Verstöße gegen Verbotslisten: 1')
  })

  it('führt die Richter-Spalte, sobald alle Einträge ein Urteil tragen', () => {
    const ok = pruefeGoldenSetFrage({ frage: themenfrage, kennungFeld: 'massnahme_nr', kennungZuFileId, antwort: 'nicht umsetzbar [1], in Umsetzung [2]', gruppen, benutzt: [1, 2], facetDefs: FACETS })
    const urteil = { modalitaetKorrekt: false, zuschreibungVorhanden: true, keineErfolgsbehauptung: true, gruppierungNachStatus: true, begruendung: '' }
    const bericht = baueBericht([{ ergebnis: ok, richter: werteRichterUrteil(themenfrage, urteil), erwarteteWerte: {} }])
    expect(bericht.gesamt).toEqual({ gesamt: 1, deterministischBestanden: 1, richterBestanden: 0 })
    expect(berichtAlsMarkdown(bericht, 'B')).toContain('| gesamt | 1/1 | 0/1 |')
  })
})
