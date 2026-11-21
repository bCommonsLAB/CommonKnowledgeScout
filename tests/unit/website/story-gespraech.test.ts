/**
 * Fragen-Sektion → Gespraech der Common-UX-Buehne (Plan
 * `commonux-buehne-fragen-sektion`, Welle P3). Erfundene Daten in der Form
 * einer Antwort des Chat-Streams.
 */
import { describe, it, expect } from 'vitest'
import type { DocReference } from '@ks/contracts'
import { paare, type Nachricht } from '@ks/module-story/react'
import { gespraechAusStory, gespraechFrageId, gespraechStand, type GespraechEingabe, type GespraechPaar } from '@ks/module-website'

function beleg(number: number, fileId: string, extra: Partial<DocReference> = {}): DocReference {
  return { number, fileId, description: `Textstelle ${number}`, ...extra }
}

const BELEGE: DocReference[] = [
  beleg(11, 'dok-b', { title: 'Leitfaden', passages: [{ excerpt: 'eins' }, { excerpt: 'zwei' }, { excerpt: 'drei' }] }),
  beleg(3, 'dok-a', { fileName: 'protokoll.md' }),
  beleg(24, 'dok-c'),
]
const ERSTE: GespraechPaar = {
  frage: { text: 'Wie beginnt ein Vorhaben?', kurztitel: 'Beginn' },
  antwort: { text: 'Mit einem Anliegen [3]. Dann folgt ein Plan [11][24].', belege: BELEGE, anschlussfragen: ['Was tun bei Konflikten?', 'Wer entscheidet?'] },
}
const ZWEITE: GespraechPaar = { frage: { text: 'Was tun bei Konflikten?' }, antwort: { text: 'Reden [3].', belege: [beleg(3, 'dok-a', { title: 'Protokoll' })] } }

function eingabe(p: Partial<GespraechEingabe> & Pick<GespraechEingabe, 'paare'>): GespraechEingabe {
  return { laeuft: false, schritte: [], fehler: false, lesen: true, ...p }
}

describe('gespraechAusStory', () => {
  it('ohne Frage gibt es kein Gespraech', () => {
    expect(gespraechAusStory(eingabe({ paare: [] }))).toEqual({ gespraech: null, belegJeNummer: {}, verworfen: 0 })
  })

  it('die fertige Antwort traegt Text, Belege nach Nummer und die Anschlussfragen', () => {
    const { gespraech: g, verworfen } = gespraechAusStory(eingabe({ paare: [ERSTE] }))
    expect(g?.stand).toBe('fertig')
    expect(g?.frage.text).toBe('Wie beginnt ein Vorhaben?')
    // Im Text stehen die Nummern der Marken, wie auf den Kreisen — nicht die der Antwort.
    expect(g?.antwort?.text).toBe('Mit einem Anliegen [1]. Dann folgt ein Plan [2][3].')
    // Die Antwort zaehlt 3, 11, 24; die Marken im Text zeigen die Dokumentnummer 1, 2, 3 — die gilt.
    expect(g?.belege.map((b) => b.nummer)).toEqual([1, 2, 3])
    expect(g?.folgefragen.map((f) => f.text)).toEqual(['Was tun bei Konflikten?', 'Wer entscheidet?'])
    expect(g?.lesen).toBe(true)
    expect(verworfen).toBe(0)
  })

  it('ein Beleg hat die fileId als ID und als Dokument, die Zahl der Textstellen als Fundstellen', () => {
    const g = gespraechAusStory(eingabe({ paare: [ERSTE] })).gespraech
    expect(g?.belege).toEqual([
      { id: 'dok-a', dokument: 'dok-a', nummer: 1, titel: 'protokoll.md', fundstellen: 1 },
      { id: 'dok-b', dokument: 'dok-b', nummer: 2, titel: 'Leitfaden', fundstellen: 3 },
      { id: 'dok-c', dokument: 'dok-c', nummer: 3, titel: 'Textstelle 24', fundstellen: 1 },
    ])
    expect(gespraechAusStory(eingabe({ paare: [ERSTE] })).belegJeNummer).toEqual({ 1: 'dok-a', 2: 'dok-b', 3: 'dok-c' })
  })

  it('zwei Nummern desselben Dokuments (aeltere Antworten) sind ein Beleg mit einer Marke', () => {
    const paar: GespraechPaar = { frage: { text: 'Alt?' }, antwort: { text: 'x [1][2][3]', belege: [beleg(1, 'dok-a'), beleg(2, 'dok-b'), beleg(3, 'dok-a')] } }
    const e = gespraechAusStory(eingabe({ paare: [paar] }))
    expect(e.gespraech?.belege.map((b) => [b.id, b.nummer, b.fundstellen])).toEqual([['dok-a', 1, 2], ['dok-b', 2, 1]])
    expect(e.belegJeNummer).toEqual({ 1: 'dok-a', 2: 'dok-b' })
  })

  it('ein Beleg ohne fileId fehlt im Gespraech und wird gezaehlt — keine erfundene ID', () => {
    const kaputt = { number: 5, fileId: '', description: 'ohne Datei' }
    const paar: GespraechPaar = { frage: { text: 'Kaputt?' }, antwort: { text: 'x [3][5]', belege: [beleg(3, 'dok-a'), kaputt] } }
    const e = gespraechAusStory(eingabe({ paare: [paar] }))
    expect(e.gespraech?.belege.map((b) => b.id)).toEqual(['dok-a'])
    expect(e.belegJeNummer).toEqual({ 1: 'dok-a' })
    expect(e.verworfen).toBe(1)
  })

  it('eine gestellte Anschlussfrage hat die ID, die sie als Anschlussfrage hatte', () => {
    const vorher = gespraechAusStory(eingabe({ paare: [ERSTE] })).gespraech
    const nachher = gespraechAusStory(eingabe({ paare: [ERSTE, { frage: { text: ' Was tun  bei Konflikten? ' } }], laeuft: true })).gespraech
    expect(nachher?.frage.id).toBe(vorher?.folgefragen[0].id)
    expect(nachher?.frage.id).toBe(gespraechFrageId('Was tun bei Konflikten?'))
  })

  it('dasselbe Dokument behaelt ueber Antworten seine ID', () => {
    const a = gespraechAusStory(eingabe({ paare: [ERSTE] })).gespraech
    const b = gespraechAusStory(eingabe({ paare: [ERSTE, ZWEITE] })).gespraech
    expect(b?.belege[0].id).toBe(a?.belege[0].id)
  })

  it('fruehere beantwortete Fragen sind der Verlauf, aelteste zuerst, mit Kurztitel oder Wortlaut', () => {
    const dritte: GespraechPaar = { frage: { text: 'Wer entscheidet?' } }
    const g = gespraechAusStory(eingabe({ paare: [ERSTE, ZWEITE, dritte], laeuft: true })).gespraech
    expect(g?.verlauf).toEqual([
      { id: gespraechFrageId('Wie beginnt ein Vorhaben?'), kurzfrage: 'Beginn' },
      { id: gespraechFrageId('Was tun bei Konflikten?'), kurzfrage: 'Was tun bei Konflikten?' },
    ])
  })

  it('eine fruehere Frage ohne Antwort ist keine Perle; eine wiederholte steht einmal; die sichtbare gar nicht', () => {
    const abgebrochen: GespraechPaar = { frage: { text: 'Abgebrochen?' } }
    const g = gespraechAusStory(eingabe({ paare: [ZWEITE, abgebrochen, ERSTE, ZWEITE, ERSTE] })).gespraech
    expect(g?.verlauf).toEqual([{ id: gespraechFrageId('Was tun bei Konflikten?'), kurzfrage: 'Was tun bei Konflikten?' }])
  })

  it('vor der Antwort gibt es weder Text noch Belege noch Anschlussfragen', () => {
    const g = gespraechAusStory(eingabe({ paare: [{ frage: { text: 'Neu?' } }], laeuft: true, schritte: [{ type: 'retrieval_start' }] })).gespraech
    expect(g).toEqual({ frage: { id: gespraechFrageId('Neu?'), text: 'Neu?' }, stand: 'sucht', verlauf: [], lesen: true, belege: [], folgefragen: [] })
  })

  it('nimmt die Paare aus `paare()` des Story-Moduls unveraendert an', () => {
    const nachrichten: Nachricht[] = [
      { id: 'f1', art: 'frage', text: 'Erste?', createdAt: '2026-11-21T10:00:00.000Z', queryId: 'q1', kurztitel: 'Erste' },
      { id: 'a1', art: 'antwort', text: 'Eins [1].', createdAt: '2026-11-21T10:00:05.000Z', queryId: 'q1', belege: [beleg(1, 'dok-a')], anschlussfragen: ['Zweite?'] },
      { id: 'f2', art: 'frage', text: 'Zweite?', createdAt: '2026-11-21T10:01:00.000Z' },
    ]
    const g = gespraechAusStory(eingabe({ paare: paare(nachrichten), laeuft: true })).gespraech
    expect(g?.frage.text).toBe('Zweite?')
    expect(g?.verlauf).toEqual([{ id: gespraechFrageId('Erste?'), kurzfrage: 'Erste' }])
  })
})

describe('Nummern im Antworttext', () => {
  it('eine Nummer ohne Beleg bleibt stehen; ein Markdown-Link ist keine Marke', () => {
    const paar: GespraechPaar = { frage: { text: 'Text?' }, antwort: { text: 'A [7], B [99], C [7](https://example.org).', belege: [beleg(7, 'dok-a')] } }
    expect(gespraechAusStory(eingabe({ paare: [paar] })).gespraech?.antwort?.text).toBe('A [1], B [99], C [7](https://example.org).')
  })
})

describe('gespraechStand', () => {
  const laufend = { hatAntwort: false, laeuft: true, fehler: false }

  it('sucht, solange das Sprachmodell nicht schreibt — llm_start kommt schon waehrend der Suche', () => {
    expect(gespraechStand({ ...laufend, schritte: [] })).toBe('sucht')
    expect(gespraechStand({ ...laufend, schritte: [{ type: 'retrieval_start' }, { type: 'llm_start' }, { type: 'retrieval_complete' }] })).toBe('sucht')
  })

  it('schreibt ab prompt_complete oder llm_progress', () => {
    expect(gespraechStand({ ...laufend, schritte: [{ type: 'llm_start' }, { type: 'prompt_complete' }] })).toBe('schreibt')
    expect(gespraechStand({ ...laufend, schritte: [{ type: 'llm_progress' }] })).toBe('schreibt')
  })

  it('fertig, sobald die Antwort da ist — auch wenn der Stream noch aufraeumt', () => {
    expect(gespraechStand({ hatAntwort: true, laeuft: true, fehler: false, schritte: [] })).toBe('fertig')
  })

  it('fehler bei einem Fehler und bei einer abgebrochenen Frage (ohne Antwort, ohne Lauf)', () => {
    expect(gespraechStand({ hatAntwort: false, laeuft: true, fehler: true, schritte: [] })).toBe('fehler')
    expect(gespraechStand({ hatAntwort: false, laeuft: false, fehler: false, schritte: [{ type: 'llm_progress' }] })).toBe('fehler')
  })
})
