import { describe, expect, it } from 'vitest'
import { selectShadowTwinArtifact } from '@/lib/shadow-twin/shadow-twin-select'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'

describe('shadow-twin-select', () => {
  it('waehlt die neueste Transformation pro Sprache', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transformation: {
          t1: {
            de: { markdown: 'a', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
          },
          t2: {
            de: { markdown: 'b', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' },
          },
        },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transformation', 'de')
    expect(selected?.templateName).toBe('t2')
    expect(selected?.record.markdown).toBe('b')
  })

  it('liefert Transcript fuer Sprache', () => {
    const doc: ShadowTwinDocument = {
      libraryId: 'lib-1',
      sourceId: 'src-1',
      sourceName: 'doc.pdf',
      parentId: 'p-1',
      userEmail: 'user@test.local',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      artifacts: {
        transcript: {
          de: { markdown: 'transcript', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        },
      },
    }

    const selected = selectShadowTwinArtifact(doc, 'transcript', 'de')
    expect(selected?.record.markdown).toBe('transcript')
  })
})
