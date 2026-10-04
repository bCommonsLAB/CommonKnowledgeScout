/**
 * Wunschliste 7, B1 — Ersetzungen im Transkript-Body (reine Logik).
 *
 * Die Faelle folgen dem Akzeptanztest „Todo Oktober-1": neun Hoerfehler, jeder
 * genau einmal; `alt: "Knowledge"` ohne `alle` muss abgelehnt werden.
 */
import { describe, it, expect } from 'vitest'
import {
  ErsetzungNichtEindeutigError,
  ErsetzungNichtGefundenError,
  kontextUm,
  wendeErsetzungenAn,
  zeileVon,
} from '@/lib/mcp/transkript-korrektur'

const BODY = [
  '# Todo Oktober',
  '',
  'Wir arbeiten mit diesen … Queer sozialen Initiativen zusammen.',
  'Momentan noch in ihren Nextdrive-Ordner.',
  'Dabei sollte mir der Knowledge Card helfen.',
  'Bei diesen Diktaten und Knowledge-Card-Verarbeitungen hilft die Agentin der Verbundenheit.',
  'Damit man es als schönen Block lesen kann.',
].join('\n')

describe('wendeErsetzungenAn', () => {
  it('ersetzt jede Stelle genau einmal und belegt Zeile und Kontext', () => {
    const { body, belege } = wendeErsetzungenAn(BODY, [
      { alt: 'mit diesen … Queer sozialen Initiativen', neu: 'mit diesen … ökosozialen Initiativen' },
      { alt: 'Momentan noch in ihren Nextdrive-Ordner.', neu: 'Momentan noch in ihren Nextcloud-Ordner.' },
      { alt: 'als schönen Block lesen kann', neu: 'als schönen Blog lesen kann' },
    ])
    expect(body).toContain('ökosozialen Initiativen')
    expect(body).toContain('Nextcloud-Ordner')
    expect(body).toContain('schönen Blog lesen')
    expect(body).not.toContain('Nextdrive')
    expect(body).toContain('Agentin der Verbundenheit')
    expect(belege).toHaveLength(3)
    expect(belege[0]).toMatchObject({ treffer: 1, zeile: 3 })
    expect(belege[0].kontextVorher).toContain('Queer sozialen')
    expect(belege[0].kontextNachher).toContain('ökosozialen')
    expect(belege[2].zeile).toBe(7)
  })

  it('lehnt einen mehrdeutigen Treffer ab und nennt jede Stelle — nichts wird geaendert', () => {
    let fehler: unknown
    try {
      wendeErsetzungenAn(BODY, [{ alt: 'Knowledge', neu: 'KnowledgeScout' }])
    } catch (e) {
      fehler = e
    }
    expect(fehler).toBeInstanceOf(ErsetzungNichtEindeutigError)
    const e = fehler as ErsetzungNichtEindeutigError
    expect(e.code).toBe('nicht_eindeutig')
    expect(e.anzahl).toBe(2)
    expect(e.treffer.map((t) => t.zeile)).toEqual([5, 6])
    expect(e.treffer[0].kontext).toContain('Knowledge Card')
    expect(e.message).toContain('2-mal')
  })

  it('ersetzt mit alle: true jedes Vorkommen und zaehlt die Treffer', () => {
    const { body, belege } = wendeErsetzungenAn(BODY, [{ alt: 'Knowledge', neu: 'KS', alle: true }])
    expect(body).not.toContain('Knowledge')
    expect(belege[0]).toMatchObject({ treffer: 2, zeile: 5 })
  })

  it('meldet nicht_gefunden mit der Nummer der Ersetzung (keine doppelte Korrektur)', () => {
    const einmal = wendeErsetzungenAn(BODY, [{ alt: 'Nextdrive-Ordner', neu: 'Nextcloud-Ordner' }]).body
    let fehler: unknown
    try {
      wendeErsetzungenAn(einmal, [
        { alt: 'Block lesen', neu: 'Blog lesen' },
        { alt: 'Nextdrive-Ordner', neu: 'Nextcloud-Ordner' },
      ])
    } catch (e) {
      fehler = e
    }
    expect(fehler).toBeInstanceOf(ErsetzungNichtGefundenError)
    expect((fehler as ErsetzungNichtGefundenError).code).toBe('nicht_gefunden')
    expect((fehler as Error).message).toContain('Ersetzung 2')
  })

  it('ist alles oder nichts: ein spaeterer Fehler laesst keinen fruehen Schritt stehen', () => {
    // Die Funktion gibt im Fehlerfall nichts zurueck — der Aufrufer behaelt den
    // Original-Body. Hier wird nur geprueft, dass sie wirft statt teilweise liefert.
    expect(() =>
      wendeErsetzungenAn(BODY, [
        { alt: 'Block lesen', neu: 'Blog lesen' },
        { alt: 'gibt es nicht', neu: 'x' },
      ]),
    ).toThrow(ErsetzungNichtGefundenError)
  })

  it('weist leere oder wirkungslose Ersetzungen ab', () => {
    expect(() => wendeErsetzungenAn(BODY, [])).toThrow('darf nicht leer sein')
    expect(() => wendeErsetzungenAn(BODY, [{ alt: '', neu: 'x' }])).toThrow('`alt` darf nicht leer sein')
    expect(() => wendeErsetzungenAn(BODY, [{ alt: 'Block', neu: 'Block' }])).toThrow('sind gleich')
  })

  it('behandelt Sonderzeichen woertlich (kein Regex): Punkte, Klammern, U+2026', () => {
    const { body } = wendeErsetzungenAn('a (b) … c.d', [{ alt: '(b) … c.d', neu: '[b] - cd' }])
    expect(body).toBe('a [b] - cd')
  })
})

describe('zeileVon / kontextUm', () => {
  it('zaehlt Zeilen 1-basiert', () => {
    expect(zeileVon('a\nb\nc', 0)).toBe(1)
    expect(zeileVon('a\nb\nc', 2)).toBe(2)
    expect(zeileVon('a\nb\nc', 4)).toBe(3)
  })

  it('haelt den Kontext auf einer Zeile und markiert Kuerzungen', () => {
    const text = `${'x'.repeat(60)}\nTREFFER\n${'y'.repeat(60)}`
    const kontext = kontextUm(text, 61, 'TREFFER'.length)
    expect(kontext.startsWith('…')).toBe(true)
    expect(kontext.endsWith('…')).toBe(true)
    expect(kontext).toContain('⏎TREFFER⏎')
    expect(kontext).not.toContain('\n')
  })
})
