import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
import { ErsetzungNichtEindeutigError } from '@/lib/mcp/transkript-korrektur'
import {
  mergeSpeakerNames,
  parseSpeakerNames,
  sprecherErsetzungen,
  wendeKorrekturAn,
} from '@/lib/transkript-korrektur/anwenden'

const REVISION = { revised_by: 'peter@example.com', revised_at: '2026-10-08T10:00:00.000Z', revision_note: 'Pruefung' }

const MARKDOWN = [
  '---',
  'speakers: ["Stück 1 Sprecher A","Stück 1 Sprecher B"]',
  'generated_by: "knowledgescout/pipeline"',
  'generated_at: "2026-10-07T21:22:43.395Z"',
  'type: "transcript"',
  '---',
  '',
  '**Stück 1 Sprecher A:** Guten Morgen, ich bin Frau Mahler.',
  '',
  '**Stück 1 Sprecher B:** Danke, Frau Mahler.',
  '',
  '**Stück 1 Sprecher A:** Zum Armutsbericht.',
].join('\n')

describe('wendeKorrekturAn (P3b)', () => {
  it('Ersetzung plus Sprecher-Zuordnung: Praefixe ueberall ersetzt, speaker_names flach, generated_* bleibt', () => {
    const r = wendeKorrekturAn({
      markdown: MARKDOWN,
      ersetzungen: [{ alt: 'Frau Mahler', neu: 'Frau Mahlknecht', alle: true }],
      sprecher: [{ label: 'Stück 1 Sprecher A', name: 'Dr. Anna Mahlknecht' }],
      revision: REVISION,
    })
    const { meta, body } = parseFrontmatter(r.markdownNeu)
    expect(body).toContain('**Dr. Anna Mahlknecht:** Guten Morgen, ich bin Frau Mahlknecht.')
    expect(body).toContain('**Dr. Anna Mahlknecht:** Zum Armutsbericht.')
    expect(body).toContain('**Stück 1 Sprecher B:** Danke, Frau Mahlknecht.')
    expect(body).not.toContain('Sprecher A')
    expect(meta['speakers']).toEqual(['Stück 1 Sprecher A', 'Stück 1 Sprecher B'])
    expect(meta['speaker_names']).toEqual(['Stück 1 Sprecher A: Dr. Anna Mahlknecht'])
    expect(meta['generated_by']).toBe('knowledgescout/pipeline')
    expect(meta['revised_by']).toBe('peter@example.com')
    expect(meta['revision_note']).toBe('Pruefung')
    expect(r.belege.map((b) => b.treffer)).toEqual([2, 2])
    expect(r.speakerNames).toEqual(['Stück 1 Sprecher A: Dr. Anna Mahlknecht'])
  })

  it('nur Sprecher ohne Ersetzungen ist erlaubt; nicht zugeordnete Labels bleiben stehen', () => {
    const r = wendeKorrekturAn({
      markdown: MARKDOWN, ersetzungen: [], sprecher: [{ label: 'Stück 1 Sprecher B', name: 'Moderation' }], revision: REVISION,
    })
    const { body } = parseFrontmatter(r.markdownNeu)
    expect(body).toContain('**Moderation:** Danke')
    expect(body).toContain('**Stück 1 Sprecher A:** Guten Morgen')
  })

  it('alles oder nichts: mehrdeutiges alt ohne alle wirft, es wird nichts zurueckgegeben', () => {
    expect(() => wendeKorrekturAn({
      markdown: MARKDOWN, ersetzungen: [{ alt: 'Frau Mahler', neu: 'X' }], sprecher: [], revision: REVISION,
    })).toThrow(ErsetzungNichtEindeutigError)
  })

  it('weder Ersetzung noch Sprecher: Fehler statt leerem Schreiben', () => {
    expect(() => wendeKorrekturAn({ markdown: MARKDOWN, ersetzungen: [], sprecher: [], revision: REVISION }))
      .toThrow(/nichts zu schreiben/)
  })

  it('Sprecher ohne Namen oder mit Name gleich Label wird abgelehnt', () => {
    expect(() => sprecherErsetzungen([{ label: 'Stück 1 Sprecher A', name: '  ' }])).toThrow(/Name fehlt/)
    expect(() => sprecherErsetzungen([{ label: 'Stück 1 Sprecher A', name: 'Stück 1 Sprecher A' }])).toThrow(/gleich dem Label/)
  })

  it('speaker_names: vorhandene Eintraege bleiben, gleiche Labels werden ueberschrieben', () => {
    const existing = ['Stück 1 Sprecher A: Alt', 'Stück 2 Sprecher A: Bleibt', 42, 'kaputt']
    expect([...parseSpeakerNames(existing).keys()]).toEqual(['Stück 1 Sprecher A', 'Stück 2 Sprecher A'])
    expect(mergeSpeakerNames(existing, [{ label: 'Stück 1 Sprecher A', name: 'Neu' }]))
      .toEqual(['Stück 1 Sprecher A: Neu', 'Stück 2 Sprecher A: Bleibt'])
  })
})
