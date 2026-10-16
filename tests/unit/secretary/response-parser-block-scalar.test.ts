// @vitest-environment node
/**
 * Befund 16.10.2026 (Rueckblick-Twin, Vorlage veranstaltung-rueckblick-de):
 * Im gespeicherten Frontmatter standen `summary: "|"`, `einleitung_md: "|"` usw.,
 * der Text danach war zeilenweise zu eigenen Top-Level-Keys geworden
 * (`Die 37. Toblacher Gespraeche ... wieder auf: "den Tourismus ..."`).
 *
 * Ursache: Der Feld-Editor im Metadaten-Tab schrieb mehrzeilige Werte als
 * YAML-Block-Scalar (`key: |` + eingerueckte Zeilen), der eine Parser las sie
 * Zeile fuer Zeile als `key: value`. Beide Seiten sind hier abgesichert:
 * - der Parser liest Block-Scalars als EINEN String-Wert,
 * - das Feld-Patchen laeuft ueber den einen Serializer und bleibt idempotent.
 */
import { describe, it, expect } from 'vitest'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { patchFrontmatter } from '@/lib/markdown/frontmatter-patch'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

const ABSATZ_1 = 'Die 37. Toblacher Gespräche griffen ihr Gründungsthema wieder auf: den Tourismus und seine Grenzen.'
const ABSATZ_2 = 'Ergänzt wurden diese Perspektiven durch Impulse aus der Praxis: Umwelt, Soziales und Wirtschaft.'

describe('parseSecretaryMarkdownStrict: YAML-Block-Scalars', () => {
  it('liest `key: |` mit mehrzeiligem Text und Doppelpunkten als einen Wert', () => {
    const md = [
      '---',
      'title: "Rückblick"',
      'summary: |',
      `  ${ABSATZ_1}`,
      '',
      `  ${ABSATZ_2}`,
      'programm_md: |',
      '  - 18:10 PREMIERE DES FILMS: Karin Duregger',
      '  - **TAGUNGSSPRACHEN:** Deutsch und Italienisch',
      '  ### Ulrike Kindl: "Problemfeld Overtourism"',
      'year: 2026',
      '---',
      'Body',
    ].join('\n')
    const { meta, errors } = parseSecretaryMarkdownStrict(md)
    expect(errors).toEqual([])
    expect(meta.summary).toBe(`${ABSATZ_1}\n\n${ABSATZ_2}\n`)
    expect(meta.programm_md).toBe(
      '- 18:10 PREMIERE DES FILMS: Karin Duregger\n- **TAGUNGSSPRACHEN:** Deutsch und Italienisch\n### Ulrike Kindl: "Problemfeld Overtourism"\n',
    )
    expect(meta.year).toBe(2026)
    // Keine Zeile des Block-Inhalts darf ein eigener Key werden.
    expect(Object.keys(meta).sort()).toEqual(['programm_md', 'summary', 'title', 'year'])
  })

  it('beachtet die Chomping-Indikatoren |- und |+ sowie gefaltetes >', () => {
    const md = [
      '---',
      'a: |-',
      '  eins',
      '  zwei',
      'b: |+',
      '  drei',
      '',
      'c: >',
      '  vier',
      '  fuenf',
      '',
      '  sechs',
      'd: >-',
      '  sieben',
      '---',
    ].join('\n')
    const { meta } = parseSecretaryMarkdownStrict(md)
    expect(meta.a).toBe('eins\nzwei')
    expect(meta.b).toBe('drei\n\n')
    expect(meta.c).toBe('vier fuenf\nsechs\n')
    expect(meta.d).toBe('sieben')
  })

  it('liefert einen leeren String, wenn dem Block-Kopf kein eingerueckter Inhalt folgt', () => {
    const md = ['---', 'summary: |', 'title: "x"', '---'].join('\n')
    const { meta } = parseSecretaryMarkdownStrict(md)
    expect(meta.summary).toBe('')
    expect(meta.title).toBe('x')
  })

  it('laesst `|` innerhalb eines Werts unberuehrt', () => {
    const md = ['---', 'tabelle: "a | b"', 'roh: x | y', '---'].join('\n')
    const { meta } = parseSecretaryMarkdownStrict(md)
    expect(meta.tabelle).toBe('a | b')
    expect(meta.roh).toBe('x | y')
  })
})

describe('Feld-Patch mit mehrzeiligem Wert (Metadaten-Editor)', () => {
  it('schreibt den Wert als einen String und bleibt ueber zwei Speicherungen identisch', () => {
    const start = ['---', 'title: "Rückblick"', 'summary: "kurz"', '---', '', '## Body'].join('\n')
    const neu = `${ABSATZ_1}\n\n${ABSATZ_2}`
    const md1 = patchFrontmatter(start, { summary: neu })
    const parsed1 = parseFrontmatter(md1)
    expect(parsed1.meta.summary).toBe(neu)
    expect(Object.keys(parsed1.meta)).toEqual(['title', 'summary'])
    // Ein Speichern eines anderen Felds darf summary nicht zerlegen.
    const md2 = patchFrontmatter(md1, { title: 'Rückblick 2026' })
    expect(parseFrontmatter(md2).meta.summary).toBe(neu)
    expect(patchFrontmatter(md2, {})).toBe(md2)
  })
})
