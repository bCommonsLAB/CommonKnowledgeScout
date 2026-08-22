/**
 * @fileoverview Unit-Tests: aenderungen_seit (W2) + Erschliessungs-Block (W5b).
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { RawTwinFamily } from '@/lib/agent-view/coverage-inputs'
import { aenderungenSeit, artDerDatei } from '@/lib/agent-view/aenderungen-seit'
import { BLOCK_END, BLOCK_START, erschliessungsBloecke, indexMitBlock } from '@/lib/agent-view/erschliessung-block'

function folder(o: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f', name: 'x', path: 'x', parentFolderId: null, depth: 0, files: [], twinFolders: [],
    index: null, bericht: null, bearbeitungsstand: null, bearbeitungsstandSeit: null, ...o,
  } as ArchiveFolderNode
}
const file = (folderPath: string, name: string, fileId: string, modifiedAt: string | null) =>
  ({ fileId, name, path: `${folderPath}/${name}`, modifiedAt })
const family = (sourceId: string, sourceName: string, parentId: string, kinds: Array<'transcript' | 'transformation'>, updatedAt = '2026-08-22T09:00:00.000Z'): RawTwinFamily => ({
  sourceId, sourceName, parentId,
  artifacts: kinds.map((kind) => ({ kind, targetLanguage: kind === 'transformation' ? 'de' : '', templateName: kind === 'transformation' ? 'standard-meeting' : undefined, frontmatter: {}, updatedAt })),
})

const VORHABEN = folder({
  folderId: 'v', name: '26.01 Klima', path: '26.01 Klima', depth: 1,
  index: { fileId: 'i', name: '_INDEX.md', path: '26.01 Klima/_INDEX.md', modifiedAt: null, meta: { type: 'index' }, body: '# Index' },
  files: [
    file('26.01 Klima', 'BERICHT.md', 'b', '2026-08-22T08:00:00.000Z'),
    file('26.01 Klima', 'alt.pdf', 'p-alt', '2026-07-01T00:00:00.000Z'),
  ],
})
const EREIGNIS = folder({
  folderId: 'e', name: '2026-08-20 Treffen', path: '26.01 Klima/2026-08-20 Treffen', depth: 2, parentFolderId: 'v',
  files: [
    file('26.01 Klima/2026-08-20 Treffen', 'neu.m4a', 'a-neu', '2026-08-21T20:00:00.000Z'),
    file('26.01 Klima/2026-08-20 Treffen', 'protokoll.docx', 'd-neu', '2026-08-21T21:00:00.000Z'),
    file('26.01 Klima/2026-08-20 Treffen', 'notiz.md', 'm-neu', '2026-08-21T22:00:00.000Z'),
    file('26.01 Klima/2026-08-20 Treffen', 'bild.png', 'img', '2026-08-21T22:30:00.000Z'),
  ],
})
const FAMILIES = [
  family('a-neu', 'neu.m4a', 'e', ['transcript']),
  family('p-alt', 'alt.pdf', 'v', ['transcript', 'transformation'], '2026-08-22T07:00:00.000Z'),
]

describe('aenderungenSeit (W2)', () => {
  it('liefert neue Dateien mit Art + Erschliessung und frische Artefakte, absteigend sortiert', () => {
    const r = aenderungenSeit({ folders: [VORHABEN, EREIGNIS], families: FAMILIES, seit: new Date('2026-08-21T18:00:00Z') })
    expect(r.gekappt).toBe(false)
    expect(r.eintraege.map((e) => `${e.name}:${e.art}:${e.erschliessung}`)).toEqual([
      'neu.m4a:artefakt:transkript',            // Transkript 09:00 am 22.08
      'BERICHT.md:contract:nicht_zutreffend',   // 08:00 am 22.08
      'alt.pdf:artefakt:transformation',        // Artefakte 07:00 am 22.08 (2x, gleicher Zeitstempel)
      'alt.pdf:artefakt:transformation',
      'bild.png:sonstige:nicht_zutreffend',
      'notiz.md:markdown:nicht_zutreffend',
      'protokoll.docx:quelle:kein_twin',
      'neu.m4a:quelle:transkript',
    ])
    expect(r.eintraege.find((e) => e.name === 'alt.pdf' && e.artefakt === 'standard-meeting.de')).toBeTruthy()
  })

  it('kappt ausgewiesen und erkennt Arten', () => {
    const r = aenderungenSeit({ folders: [EREIGNIS], families: [], seit: new Date('2026-01-01'), max: 2 })
    expect(r).toMatchObject({ gesamt: 4, gekappt: true })
    expect(r.eintraege).toHaveLength(2)
    expect(artDerDatei('_INDEX.md')).toBe('contract')
    expect(artDerDatei('x.pptx')).toBe('quelle')
  })
})

describe('erschliessungsBloecke + indexMitBlock (W5b)', () => {
  it('ordnet Quellen dem naechsten Index-Ordner zu und zaehlt Stufen aus Mongo', () => {
    const [block] = erschliessungsBloecke({ folders: [VORHABEN, EREIGNIS], families: FAMILIES, heute: '2026-08-22' })
    expect(block).toMatchObject({ path: '26.01 Klima', quellen: 3, erschlossen: 1, teil: 1, offen: 1 })
    expect(block.block).toContain('**3 Quellen: 1 erschlossen (Transformation vorhanden), 1 teil-erschlossen (nur Transkript), 1 offen.**')
    expect(block.block).toContain('- [ ] 2026-08-20 Treffen/protokoll.docx')
    expect(block.block).toContain('- [ ] 2026-08-20 Treffen/neu.m4a')
    expect(block.block.startsWith(BLOCK_START)).toBe(true)
    expect(block.block.endsWith(BLOCK_END)).toBe(true)
  })

  it('ersetzt nur den Block zwischen den Markern, sonst haengt es ihn an; Start ohne Ende wirft', () => {
    const alt = `# Index\n\nText.\n\n${BLOCK_START}\nalt\n${BLOCK_END}\n\n## Danach\n`
    expect(indexMitBlock(alt, `${BLOCK_START}\nneu\n${BLOCK_END}`)).toBe(`# Index\n\nText.\n\n${BLOCK_START}\nneu\n${BLOCK_END}\n\n## Danach\n`)
    expect(indexMitBlock('# Index\n', `${BLOCK_START}\nneu\n${BLOCK_END}`)).toBe(`# Index\n\n${BLOCK_START}\nneu\n${BLOCK_END}\n`)
    expect(() => indexMitBlock(`${BLOCK_START} kaputt`, 'x')).toThrow(/Ende-Marker/)
  })
})
