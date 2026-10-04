import { describe, it, expect } from 'vitest'
import { kurztitel, kurztitelFuer, themaZuFrage } from '@ks/module-story/react'
import type { StoryTopicsData } from '@ks/contracts'

describe('kurztitel — erste Worte als Kurztitel (D1-Heuristik)', () => {
  it('nimmt die ersten Worte und kuerzt mit Auslassung', () => {
    expect(kurztitel('Welche Massnahmen zur Mobilitaet sind bereits in Umsetzung?')).toBe(
      'Massnahmen zur Mobilitaet sind bereits…',
    )
  })

  it('laesst fuehrende Fragewoerter weg, aber nie alles', () => {
    expect(kurztitel('Wie funktioniert das Heizen mit Holz?')).toBe('funktioniert das Heizen mit Holz')
    expect(kurztitel('Was ist das?')).toBe('Was ist das')
  })

  it('kurze Fragen bleiben ganz, ohne Satzzeichen', () => {
    expect(kurztitel('Heizen mit Holz?')).toBe('Heizen mit Holz')
  })

  it('haelt die Zeichengrenze ein, sobald zwei Worte stehen', () => {
    const titel = kurztitel('Photovoltaik Gemeinschaftsprojekte Finanzierungsmodelle Suedtirol Bergdoerfer')
    expect(titel).toBe('Photovoltaik Gemeinschaftsprojekte…')
    expect(titel.endsWith('…')).toBe(true)
  })

  it('leerer Text bleibt leer', () => {
    expect(kurztitel('   ')).toBe('')
  })
})

const gliederung: StoryTopicsData = {
  id: 'lib',
  title: 'T',
  tagline: '',
  intro: '',
  topics: [
    { id: 'verkehr', title: 'Verkehr', questions: [{ id: 'q1', text: 'Welche Massnahmen gibt es zum Verkehr?' }] },
    { id: 'heizen', title: 'Heizen', questions: [{ id: 'q2', text: 'Wie heizen wir morgen?' }] },
  ],
}

describe('themaZuFrage — Zuordnung ueber den Fragetext', () => {
  it('findet das Thema einer uebernommenen Frage, auch bei anderem Weissraum', () => {
    expect(themaZuFrage(gliederung, 'wie  heizen wir morgen? ')).toBe('heizen')
  })

  it('selbst getippte Fragen haben kein Thema', () => {
    expect(themaZuFrage(gliederung, 'Wer hat das entschieden?')).toBeNull()
    expect(themaZuFrage(null, 'Wie heizen wir morgen?')).toBeNull()
  })
})

describe('kurztitelFuer', () => {
  it('nimmt den Kurztitel des Sprachmodells, sonst die Heuristik', () => {
    expect(kurztitelFuer({ text: 'Wie heizen wir morgen ohne Öl?', kurztitel: 'Heizen ohne Öl' })).toBe('Heizen ohne Öl')
    expect(kurztitelFuer({ text: 'Wie heizen wir morgen ohne Öl?' })).toBe(kurztitel('Wie heizen wir morgen ohne Öl?'))
    expect(kurztitelFuer({ text: 'Wie heizen wir morgen ohne Öl?', kurztitel: '  ' })).toBe(kurztitel('Wie heizen wir morgen ohne Öl?'))
  })
})
