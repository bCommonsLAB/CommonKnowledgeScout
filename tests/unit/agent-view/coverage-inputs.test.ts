/**
 * @fileoverview Unit-Tests: juengste Aenderung je Teilbaum (B4-Fix).
 *
 * BERICHT.md/_INDEX.md sind META ueber den Inhalt — sie altern den Bericht
 * nicht; echte Datei- und Artefakt-Aenderungen zaehlen weiterhin.
 */

import { describe, it, expect } from 'vitest'
import { buildNewestChangeBySubtree } from '@/lib/agent-view/coverage-inputs'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'

function folder(overrides: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f1', name: 'Vorhaben', path: 'Vorhaben', parentFolderId: null, depth: 0,
    files: [], twinFolders: [], index: null, bericht: null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
    ...overrides,
  } as ArchiveFolderNode
}

function file(name: string, modifiedAt: string) {
  return { fileId: `id-${name}`, name, path: `Vorhaben/${name}`, modifiedAt }
}

describe('buildNewestChangeBySubtree (B4)', () => {
  it('BERICHT.md und _INDEX.md zaehlen NICHT als juengste Aenderung (Meta, kein Inhalt)', () => {
    const result = buildNewestChangeBySubtree({
      folders: [
        folder({
          files: [
            file('Aufnahme.m4a', '2026-08-01T10:00:00.000Z'),
            file('BERICHT.md', '2026-08-21T12:00:00.000Z'),
            file('_INDEX.md', '2026-08-21T13:00:00.000Z'),
          ],
        }),
      ],
      families: [],
    })
    expect(result.get('f1')).toBe('2026-08-01T10:00:00.000Z')
  })

  it('echte Datei- und Artefakt-Aenderungen zaehlen weiterhin (Positivfall)', () => {
    const result = buildNewestChangeBySubtree({
      folders: [folder({ files: [file('Aufnahme.m4a', '2026-08-01T10:00:00.000Z')] })],
      families: [
        {
          folderId: 'f1',
          artifacts: [
            {
              updatedAt: '2026-08-20T09:00:00.000Z',
              frontmatter: { generated_at: '2026-08-20T09:00:00.000Z' },
            },
          ],
        } as never,
      ],
    })
    expect(result.get('f1')).toBe('2026-08-20T09:00:00.000Z')
  })
})
