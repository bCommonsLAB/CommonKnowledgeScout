/**
 * Welle W3 — Listen-Felder ergaenzen, ohne Dubletten zu erzeugen.
 *
 * Beleg: `korrespondenz:` wird woechentlich gepflegt. Der Ausweg ueber
 * `ersetze` auf den exakten Zeilenwortlaut prueft NICHTS auf Dubletten — zwei
 * Wochen mit demselben Ansprechpartner erzeugen zwei Eintraege.
 *
 * Der Zuschnitt folgt einer Messung: Der Parser dieses Repositories kennt
 * keine YAML-Listen. Blockform liest er als leeren String, Flow-Form als
 * Rohstring. Nur die Flow-Form kommt durch die Rueckprobe.
 */
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { ergaenzeFrontmatterListen } from '@/lib/mcp/storage/frontmatter-felder'
import { leseFlowListe, normalisiere } from '@/lib/mcp/storage/frontmatter-listen'

const MIT_LISTE = ['---', 'titel: Bericht', 'korrespondenz: [Anna Bauer, Bert Celan]', '---', '', 'Body'].join('\n')

describe('normalisiere', () => {
  it('vergleicht ohne Rand, Mehrfach-Leerzeichen, Quotes und Gross-/Kleinschreibung', () => {
    expect(normalisiere('  "Anna   Bauer" ')).toBe('anna bauer')
    expect(normalisiere('ANNA BAUER')).toBe(normalisiere('anna bauer'))
  })
})

describe('leseFlowListe', () => {
  it('liest die Flow-Form, auch leer', () => {
    expect(leseFlowListe('[a, b]')).toEqual(['a', 'b'])
    expect(leseFlowListe('[]')).toEqual([])
  })

  it('gibt null zurueck, wenn es keine Flow-Liste ist', () => {
    expect(leseFlowListe('Anna Bauer')).toBeNull()
  })
})

describe('ergaenzeFrontmatterListen', () => {
  it('haengt an und laesst Body sowie fremde Zeilen stehen', () => {
    const r = ergaenzeFrontmatterListen(MIT_LISTE, { korrespondenz: ['Clara Dorn'] })
    expect(r.inhalt).toContain('korrespondenz: [Anna Bauer, Bert Celan, Clara Dorn]')
    expect(r.inhalt).toContain('titel: Bericht')
    expect(r.inhalt.endsWith('Body')).toBe(true)
    expect(r.beschreibung).toContain('1 ergaenzt (Clara Dorn)')
  })

  it('erkennt eine Dublette trotz anderer Schreibweise und schreibt sie NICHT nochmal', () => {
    const r = ergaenzeFrontmatterListen(MIT_LISTE, { korrespondenz: ['  anna   bauer '] })
    expect(r.inhalt).toContain('korrespondenz: [Anna Bauer, Bert Celan]')
    expect(r.beschreibung).toContain('0 ergaenzt')
    expect(r.beschreibung).toContain('1 schon vorhanden')
  })

  it('entdoppelt auch innerhalb EINES Aufrufs', () => {
    const r = ergaenzeFrontmatterListen(MIT_LISTE, { korrespondenz: ['Clara Dorn', 'clara dorn'] })
    expect(r.inhalt).toContain('[Anna Bauer, Bert Celan, Clara Dorn]')
  })

  it('legt das Feld an, wenn es noch fehlt', () => {
    const ohne = ['---', 'titel: x', '---', '', 'Body'].join('\n')
    const r = ergaenzeFrontmatterListen(ohne, { korrespondenz: ['Anna Bauer'] })
    expect(r.inhalt).toContain('korrespondenz: [Anna Bauer]')
  })

  it('bleibt fuer den Parser lesbar — genau das leistet die Blockform nicht', () => {
    const r = ergaenzeFrontmatterListen(MIT_LISTE, { korrespondenz: ['Clara Dorn'] })
    expect(parseFrontmatter(r.inhalt).meta.korrespondenz).toBe('[Anna Bauer, Bert Celan, Clara Dorn]')
  })

  it('fasst ein Feld in YAML-Blockform NICHT an, sondern sagt warum', () => {
    const block = ['---', 'korrespondenz:', '  - Anna Bauer', 'titel: x', '---', '', 'Body'].join('\n')
    expect(() => ergaenzeFrontmatterListen(block, { korrespondenz: ['Clara Dorn'] }))
      .toThrow(/Blockform.*LEEREN Wert.*Nichts geaendert/s)
  })

  it('aendert die Form eines Skalar-Feldes nicht heimlich', () => {
    const skalar = ['---', 'korrespondenz: Anna Bauer', '---', '', 'Body'].join('\n')
    expect(() => ergaenzeFrontmatterListen(skalar, { korrespondenz: ['Clara Dorn'] }))
      .toThrow(/einfacher Wert.*frontmatter_setzen/s)
  })

  it('lehnt Werte ab, die die Flow-Form zerlegen wuerden', () => {
    expect(() => ergaenzeFrontmatterListen(MIT_LISTE, { korrespondenz: ['Bauer, Anna'] }))
      .toThrow(/kein Escaping/)
  })

  it('lehnt ungueltige Keys ab (flach, snake_case)', () => {
    expect(() => ergaenzeFrontmatterListen(MIT_LISTE, { 'a.b': ['x'] })).toThrow(/Ungueltiger Frontmatter-Key/)
  })
})
