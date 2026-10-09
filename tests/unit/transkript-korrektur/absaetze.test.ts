import { describe, expect, it } from 'vitest'
import { zerlegeAbsaetze } from '@/lib/transkript-korrektur/absaetze'

/** P3b: Absatz-Zerlegung fuer die Lesesicht des Reiters „Korrektur". */
describe('zerlegeAbsaetze', () => {
  const speakers = ['Stück 1 Sprecher A', 'Stück 1 Sprecher B']

  it('ordnet Absaetze ihrem Praefix zu und entfernt den Praefix aus dem Text', () => {
    const body = '**Stück 1 Sprecher A:** Guten Tag.\n\n**Stück 1 Sprecher B:** Hallo zurück.\n'
    expect(zerlegeAbsaetze(body, speakers)).toEqual([
      { index: 0, label: 'Stück 1 Sprecher A', text: 'Guten Tag.' },
      { index: 1, label: 'Stück 1 Sprecher B', text: 'Hallo zurück.' },
    ])
  })

  it('laesst Absaetze ohne bekannten Praefix mit label null stehen', () => {
    const body = '# Überschrift\n\n**Unbekannt:** Text\n\n**Stück 1 Sprecher A:** Ja.'
    const absaetze = zerlegeAbsaetze(body, speakers)
    expect(absaetze.map((a) => a.label)).toEqual([null, null, 'Stück 1 Sprecher A'])
    expect(absaetze[1].text).toBe('**Unbekannt:** Text')
  })

  it('ueberspringt leere Absaetze und zaehlt den Index fortlaufend', () => {
    const body = '\n\n**Stück 1 Sprecher A:** Eins.\n\n\n\n**Stück 1 Sprecher A:** Zwei.\n\n'
    expect(zerlegeAbsaetze(body, speakers).map((a) => a.index)).toEqual([0, 1])
  })

  it('liefert ohne Sprecherliste nur Absaetze ohne Label', () => {
    expect(zerlegeAbsaetze('**Stück 1 Sprecher A:** Eins.', [])).toEqual([
      { index: 0, label: null, text: '**Stück 1 Sprecher A:** Eins.' },
    ])
  })
})
