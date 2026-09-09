/**
 * @fileoverview Tests: Themen gegen das Vokabular pruefen (Wunschliste 5, A1).
 *
 * Der Befund vom 09.09.2026: `KS-Datenmodel` (ein L) wurde anstandslos
 * geschrieben und tauchte im Themenregister als eigenes Thema auf. Die
 * Pruefung muss den Tippfehler erkennen UND den richtigen Namen nennen.
 */

import { describe, expect, it } from 'vitest'
import { ThemaUnbekanntError, normalisiereThema, pruefeGegenVokabular } from '@/lib/agent-view/themen-vokabular'

const VOKABULAR = ['KS-Plattform', 'KS-Datenmodell', 'KS-Erschliessung', 'ACT-Klima', 'LIB-Naturmuseum', 'DEV-DIVA']

describe('pruefeGegenVokabular', () => {
  it('bekannte Namen sind kein Befund', () => {
    expect(pruefeGegenVokabular(['KS-Plattform', 'ACT-Klima'], VOKABULAR)).toEqual([])
  })

  it('leere Liste ist erlaubt (entfernt alle Themen)', () => {
    expect(pruefeGegenVokabular([], VOKABULAR)).toEqual([])
  })

  it('Tippfehler wird erkannt und der richtige Name vorgeschlagen', () => {
    const [befund] = pruefeGegenVokabular(['KS-Datenmodel'], VOKABULAR)
    expect(befund.name).toBe('KS-Datenmodel')
    expect(befund.vorschlaege[0]).toBe('KS-Datenmodell')
  })

  it('reine Schreibvariante (Umlaut, Gross/Klein) steht an erster Stelle', () => {
    const [befund] = pruefeGegenVokabular(['ks-erschließung'], VOKABULAR)
    expect(befund.vorschlaege[0]).toBe('KS-Erschliessung')
  })

  it('Eintraege, die den Namen enthalten, kommen nach den nahen Treffern', () => {
    const [befund] = pruefeGegenVokabular(['Klima'], VOKABULAR)
    expect(befund.vorschlaege).toContain('ACT-Klima')
  })

  it('ohne Aehnlichkeit bleibt die Vorschlagsliste leer', () => {
    const [befund] = pruefeGegenVokabular(['Quantenphysik'], VOKABULAR)
    expect(befund.vorschlaege).toEqual([])
  })

  it('hoechstens drei Vorschlaege, nach Naehe sortiert', () => {
    const viele = ['KS-A1', 'KS-A2', 'KS-A3', 'KS-A4', 'KS-B']
    const [befund] = pruefeGegenVokabular(['KS-A'], viele)
    expect(befund.vorschlaege).toHaveLength(3)
    expect(befund.vorschlaege.every((v) => v.startsWith('KS-A'))).toBe(true)
  })

  it('meldet jeden unbekannten Namen, bekannte dazwischen nicht', () => {
    const befunde = pruefeGegenVokabular(['KS-Plattform', 'Neu-1', 'DEV-DIVA', 'Neu-2'], VOKABULAR)
    expect(befunde.map((b) => b.name)).toEqual(['Neu-1', 'Neu-2'])
  })
})

describe('normalisiereThema', () => {
  it('loest Umlaute auf und laesst nur Buchstaben und Ziffern stehen', () => {
    expect(normalisiereThema('KS-Erschließung 2')).toBe('kserschliessung2')
  })
})

describe('ThemaUnbekanntError', () => {
  it('nennt Name, Vorschlag und den Schalter fuer den bewussten Fall', () => {
    const fehler = new ThemaUnbekanntError(pruefeGegenVokabular(['KS-Datenmodel'], VOKABULAR))
    expect(fehler.code).toBe('thema_unbekannt')
    expect(fehler.message).toContain('KS-Datenmodel')
    expect(fehler.message).toContain('KS-Datenmodell')
    expect(fehler.message).toContain('neuesThemaErlauben')
    expect(fehler.message).toContain('nichts geschrieben')
  })
})
