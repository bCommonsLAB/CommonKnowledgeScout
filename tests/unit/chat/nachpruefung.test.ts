import { describe, it, expect } from 'vitest'
import { pruefeAntwort, hatBefund, fussnote, fussnoteAnhaengen } from '@/lib/chat/nachpruefung'
import { dokumenteNummerieren } from '@/lib/chat/common/zitatmarken'
import type { KontextFacette } from '@/lib/chat/quellen-kontext'
import type { RetrievedSource } from '@/types/retriever'

/**
 * Plan story-status-modalitaet, m4: deterministische Nachprüfung der Antwort
 * gegen die Facettenwerte der zitierten Dokumente — Verteilung als Fußnote,
 * Verstöße gegen Verbotslisten als Befund. Der Text wird nie umgeschrieben.
 */

const FACETS: KontextFacette[] = [
  {
    metaKey: 'lv_bewertung',
    label: 'Bewertung Landesverwaltung',
    werte: [
      { wert: 'in_umsetzung', label: 'in Umsetzung', verboten: ['ist umgesetzt', 'gibt es seit'] },
      { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', verboten: ['wird gemacht', 'ist geplant'] },
      { wert: 'vertieft_pruefen', label: 'in Prüfung' },
    ],
  },
  { metaKey: 'arbeitsgruppe', label: 'Arbeitsgruppe' },
]

// Drei Dokumente: [1] in Umsetzung (zwei Textstellen), [2] nicht umsetzbar, [3] ohne Status (z. B. Event)
const sources: RetrievedSource[] = [
  { id: 'a-0', fileId: 'a', fileName: 'A.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'in_umsetzung', arbeitsgruppe: 'Mobilität' } },
  { id: 'b-0', fileId: 'b', fileName: 'B.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'nicht_umsetzbar' } },
  { id: 'a-3', fileId: 'a', fileName: 'A.md', chunkIndex: 3, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'in_umsetzung' } },
  { id: 'c-0', fileId: 'c', fileName: 'Event.md', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { speakers: ['R'] } },
]
const gruppen = dokumenteNummerieren(sources)

describe('pruefeAntwort: Verteilung', () => {
  it('zählt je Dokument (nicht je Textstelle) und nur Facetten mit Wörterbuch', () => {
    const e = pruefeAntwort('Antwort [1] [2] [3]', gruppen, [1, 2, 3], FACETS)
    expect(e.geprueft).toEqual([1, 2, 3])
    expect(e.verteilung).toEqual([
      {
        metaKey: 'lv_bewertung',
        label: 'Bewertung Landesverwaltung',
        dokumente: 2,
        werte: [
          { wert: 'in_umsetzung', label: 'in Umsetzung', anzahl: 1 },
          { wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', anzahl: 1 },
        ],
      },
    ])
    expect(hatBefund(e)).toBe(true)
  })

  it('zitierte Dokumente entscheiden; leere Zitate heißen alle (wie bei den Belegen)', () => {
    const nurZwei = pruefeAntwort('Antwort [2]', gruppen, [2], FACETS)
    expect(nurZwei.verteilung[0].werte).toEqual([{ wert: 'nicht_umsetzbar', label: 'nicht umsetzbar', anzahl: 1 }])
    const alle = pruefeAntwort('Antwort', gruppen, [], FACETS)
    expect(alle.geprueft).toEqual([1, 2, 3])
    expect(alle.verteilung[0].dokumente).toBe(2)
  })

  it('Wert ohne Wörterbuch-Eintrag erscheint als Rohwert, nicht versteckt', () => {
    const q: RetrievedSource[] = [{ id: 'd-0', fileId: 'd', chunkIndex: 0, text: 'x', sourceType: 'body', metadata: { lv_bewertung: 'neu_umsetzbar' } }]
    const e = pruefeAntwort('Antwort [1]', dokumenteNummerieren(q), [1], FACETS)
    expect(e.verteilung[0].werte).toEqual([{ wert: 'neu_umsetzbar', label: 'neu_umsetzbar', anzahl: 1 }])
  })

  it('ohne Facette mit Wörterbuch oder ohne passende Dokumente: kein Befund', () => {
    expect(hatBefund(pruefeAntwort('Antwort [3]', gruppen, [3], FACETS))).toBe(false)
    expect(hatBefund(pruefeAntwort('Antwort [1]', gruppen, [1], [{ metaKey: 'arbeitsgruppe' }]))).toBe(false)
  })
})

describe('pruefeAntwort: Verstöße', () => {
  it('findet verbotene Formulierungen der getroffenen Werte, unabhängig von Groß-/Kleinschreibung und Umbrüchen', () => {
    const e = pruefeAntwort('Die Maßnahme IST\n umgesetzt und wird gemacht. [1] [2]', gruppen, [1, 2], FACETS)
    expect(e.verstoesse).toEqual([
      { metaKey: 'lv_bewertung', wert: 'in_umsetzung', wertLabel: 'in Umsetzung', formulierung: 'ist umgesetzt', nummern: [1] },
      { metaKey: 'lv_bewertung', wert: 'nicht_umsetzbar', wertLabel: 'nicht umsetzbar', formulierung: 'wird gemacht', nummern: [2] },
    ])
  })

  it('eine Formulierung zählt nur gegen Werte zitierter Dokumente', () => {
    // „wird gemacht" ist nur bei nicht_umsetzbar verboten; [2] ist nicht zitiert.
    const e = pruefeAntwort('Das wird gemacht. [1]', gruppen, [1], FACETS)
    expect(e.verstoesse).toEqual([])
  })
})

describe('Fußnote', () => {
  it('eine Zeile je Facette mit Zählung; ohne Verteilung bleibt die Antwort unverändert', () => {
    const e = pruefeAntwort('Antwort [1] [2]', gruppen, [1, 2], FACETS)
    expect(fussnote(e)).toBe('*Bewertung Landesverwaltung: 1 × in Umsetzung, 1 × nicht umsetzbar*')
    expect(fussnoteAnhaengen('Antwort [1] [2]', e)).toBe('Antwort [1] [2]\n\n---\n*Bewertung Landesverwaltung: 1 × in Umsetzung, 1 × nicht umsetzbar*')
    const leer = pruefeAntwort('Antwort [3]', gruppen, [3], FACETS)
    expect(fussnoteAnhaengen('Antwort [3]', leer)).toBe('Antwort [3]')
  })
})
