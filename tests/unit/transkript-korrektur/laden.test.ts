import { describe, expect, it } from 'vitest'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { transformationUeberholt, transkriptZustand } from '@/lib/transkript-korrektur/laden'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'

function doc(transformationUpdatedAt: string | null): ShadowTwinDocument {
  const markdown = '---\nspeakers: ["Stück 1 Sprecher A"]\nspeaker_names: ["Stück 1 Sprecher A: Anna"]\nrevised_at: "2026-10-08T10:00:00.000Z"\nrevised_by: "p@example.com"\n---\n\n**Stück 1 Sprecher A:** Hallo\n'
  return {
    libraryId: 'lib', sourceId: 'src', sourceName: 'a.m4a', parentId: 'p', userEmail: 'p@example.com',
    artifacts: {
      transcript: { markdown, createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-08T10:00:01.000Z' },
      transformation: transformationUpdatedAt
        ? { vortrag: { de: { markdown: '# T', createdAt: transformationUpdatedAt, updatedAt: transformationUpdatedAt } } }
        : {},
    },
    createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-08T10:00:01.000Z',
  }
}

describe('transkriptZustand / transformationUeberholt (P3b)', () => {
  it('Transformation aelter als revised_at → ueberholt', () => {
    expect(transformationUeberholt(doc('2026-10-07T21:00:00.000Z'), '2026-10-08T10:00:00.000Z')).toBe(true)
  })

  it('Transformation juenger als revised_at → nicht ueberholt; ohne revised_at nie', () => {
    expect(transformationUeberholt(doc('2026-10-08T11:00:00.000Z'), '2026-10-08T10:00:00.000Z')).toBe(false)
    expect(transformationUeberholt(doc('2026-10-07T21:00:00.000Z'), null)).toBe(false)
    expect(transformationUeberholt(doc(null), '2026-10-08T10:00:00.000Z')).toBe(false)
  })

  it('Zustand ohne Body: Riegel, Labels, speaker_names, Praefix-Erkennung, ueberholt', () => {
    const d = doc('2026-10-07T21:00:00.000Z')
    const record = d.artifacts.transcript!
    const { meta, body } = parseFrontmatter(record.markdown)
    const z = transkriptZustand({ doc: d, record, meta, body })
    expect(z.updatedAt).toBe('2026-10-08T10:00:01.000Z')
    expect(z.speakers).toEqual(['Stück 1 Sprecher A'])
    expect(z.speakerNames).toEqual(['Stück 1 Sprecher A: Anna'])
    expect(z.hatPraefixe).toBe(true)
    expect(z.revisedBy).toBe('p@example.com')
    expect(z.ueberholt).toBe(true)
    expect(z.transformationen).toHaveLength(1)
    expect(JSON.stringify(z)).not.toContain('Hallo')
  })
})
