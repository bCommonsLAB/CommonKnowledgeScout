/**
 * Befund 10.11.2026 (Sprachwechsel en → da → en), Client-Seite im Story-Modul:
 * (1) der Verlauf nennt je Paar die Sprache, mit der gefragt wurde;
 * (2) nach „Mit dieser Perspektive starten" wird die gezeigte Frage neu gestellt —
 *     nur nach dem Speichern, nur bei geaendertem Stand, nie waehrend eine Antwort laeuft.
 */

import { describe, expect, it } from 'vitest'
import { gespraechsverlauf, neuStellenEntscheiden, verlaufZuNachrichten, type Nachricht } from '@ks/module-story/react'

describe('Verlauf mit Sprache je Paar', () => {
  const lokal: Nachricht[] = [
    { id: 'q1', art: 'frage', text: 'Frage?', createdAt: '2026-11-10T16:00:00Z', sprache: 'en' },
    { id: 'a1', art: 'antwort', text: 'Answer.', createdAt: '2026-11-10T16:00:01Z' },
    { id: 'q2', art: 'frage', text: 'Frage?', createdAt: '2026-11-10T16:01:00Z', sprache: 'da' },
    { id: 'a2', art: 'antwort', text: 'Svar.', createdAt: '2026-11-10T16:01:01Z' },
  ]

  it('gibt die Sprache jeder Frage als targetLanguage mit', () => {
    expect(gespraechsverlauf(lokal)).toEqual([
      { question: 'Frage?', answer: 'Answer.', targetLanguage: 'en' },
      { question: 'Frage?', answer: 'Svar.', targetLanguage: 'da' },
    ])
  })

  it('liest die Sprache gespeicherter Fragen aus der Liste (cacheParams vor Root)', () => {
    const n = verlaufZuNachrichten([
      { queryId: 'x', question: 'Q', createdAt: '2026-11-10T16:00:00Z', answer: 'A', targetLanguage: 'de', cacheParams: { targetLanguage: 'da' } },
      { queryId: 'y', question: 'Q2', createdAt: '2026-11-10T16:01:00Z', answer: 'A2' },
    ])
    expect(gespraechsverlauf(n)).toEqual([
      { question: 'Q', answer: 'A', targetLanguage: 'da' },
      { question: 'Q2', answer: 'A2' },
    ])
  })
})

describe('neuStellenEntscheiden', () => {
  const gemerkt = { zaehler: 0, stand: 'da' }

  it('ohne Speichern: nichts senden, Stand nachfuehren (Laden der Seite aendert die Perspektive auch)', () => {
    expect(neuStellenEntscheiden({ zaehler: 0, gemerkt, stand: 'en', laeuft: false, frage: 'F' })).toEqual({ merken: { zaehler: 0, stand: 'en' }, senden: null })
  })

  it('gespeichert und Stand geaendert: die gezeigte Frage neu stellen', () => {
    expect(neuStellenEntscheiden({ zaehler: 1, gemerkt, stand: 'en', laeuft: false, frage: 'F' })).toEqual({ merken: { zaehler: 1, stand: 'en' }, senden: 'F' })
  })

  it('gespeichert ohne Aenderung: keine neue Anfrage', () => {
    expect(neuStellenEntscheiden({ zaehler: 1, gemerkt, stand: 'da', laeuft: false, frage: 'F' }).senden).toBeNull()
  })

  it('gespeichert, aber keine Frage gezeigt: nichts senden', () => {
    expect(neuStellenEntscheiden({ zaehler: 1, gemerkt, stand: 'en', laeuft: false, frage: null }).senden).toBeNull()
  })

  it('laufende Antwort: warten, danach senden', () => {
    const wartet = neuStellenEntscheiden({ zaehler: 1, gemerkt, stand: 'en', laeuft: true, frage: 'F' })
    expect(wartet).toEqual({ merken: null, senden: null })
    expect(neuStellenEntscheiden({ zaehler: 1, gemerkt, stand: 'en', laeuft: false, frage: 'F' }).senden).toBe('F')
  })
})
