/**
 * Karten-Darstellungen der Story-Sektion (Owner 09.11.2026): reine Helfer —
 * zitierte Dokumente mit Dokumentnummer, Blockzerlegung des Antworttexts,
 * Zuordnung „erste noch nicht gezeigte Nummer je Block".
 */
import { describe, it, expect } from 'vitest'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import { antwortBloecke, bloeckeMitNummern, kartenEintraege } from '@/lib/website/story-karten'

const ref = (number: number, fileId: string): DocReference => ({ number, fileId, description: '' })
const doc = (fileId: string, title: string): DocCardMeta => ({ id: fileId, fileId, title } as DocCardMeta)

describe('kartenEintraege', () => {
  it('ein Eintrag je Dokument, nach Dokumentnummer, ohne Obergrenze', () => {
    const belege = Array.from({ length: 20 }, (_, i) => ref(i + 1, `f${i + 1}`))
    const docs = belege.map((b) => doc(b.fileId, `Doc ${b.number}`))
    const e = kartenEintraege(belege, docs)
    expect(e).toHaveLength(20)
    expect(e.map((x) => x.nummer)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })

  it('alte Antworten mit Nummer je Textstelle: mehrere Marken desselben Dokuments werden EINE Karte', () => {
    const belege = [ref(1, 'a'), ref(2, 'a'), ref(3, 'b')]
    const e = kartenEintraege(belege, [doc('a', 'A'), doc('b', 'B')])
    expect(e.map((x) => [x.nummer, x.doc.title])).toEqual([[1, 'A'], [2, 'B']])
  })

  it('ein Dokument ohne geladene Karte fehlt — kein Platzhalter', () => {
    const e = kartenEintraege([ref(1, 'a'), ref(2, 'b')], [doc('b', 'B')])
    expect(e.map((x) => x.nummer)).toEqual([2])
  })
})

describe('antwortBloecke', () => {
  it('trennt Absaetze an Leerzeilen und Listenpunkte einzeln', () => {
    const md = 'Einleitung [1].\n\n- Erster Punkt [2]\n- Zweiter Punkt\n  mit Folgezeile [3]\n* Dritter [4]\n\n1. Nummeriert [5]\n2) Auch [6]\n\nSchluss.'
    expect(antwortBloecke(md)).toEqual([
      'Einleitung [1].',
      '- Erster Punkt [2]',
      '- Zweiter Punkt\n  mit Folgezeile [3]',
      '* Dritter [4]',
      '1. Nummeriert [5]',
      '2) Auch [6]',
      'Schluss.',
    ])
  })

  it('leere Bloecke fallen weg; Windows-Zeilenenden werden verstanden', () => {
    expect(antwortBloecke('A\r\n\r\n\r\nB\r\n')).toEqual(['A', 'B'])
    expect(antwortBloecke('')).toEqual([])
  })
})

describe('bloeckeMitNummern', () => {
  const belege = [ref(1, 'a'), ref(2, 'b'), ref(3, 'c')]

  it('je Block die erste noch nicht vergebene Dokumentnummer; ohne Marke volle Breite', () => {
    const b = bloeckeMitNummern(['Intro ohne Marke', 'Zu A [1] und B [2]', 'Nochmal A [1], dann B [2]', 'Nur A [1]', 'C [3]'], belege)
    expect(b.map((x) => x.nummer)).toEqual([null, 1, 2, null, 3])
  })

  it('Markdown-Links [1](http://…) sind keine Marken; alte Nummern je Textstelle werden auf das Dokument gefuehrt', () => {
    const alt = [ref(1, 'a'), ref(2, 'a'), ref(3, 'b')]
    const b = bloeckeMitNummern(['[1](https://x) kein Zitat', 'A [2]', 'B [3]'], alt)
    expect(b.map((x) => x.nummer)).toEqual([null, 1, 2])
  })
})
