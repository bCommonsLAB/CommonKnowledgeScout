import { describe, it, expect } from 'vitest'
import { auditReferences, buildReferenceIndex, resolveReference, type InventoryTarget } from '@/lib/agent-view/reference-audit'
import type { ArchiveDocEntry } from '@/lib/agent-view/archive-types'

const targets: InventoryTarget[] = [
  { path: '25.01 Pilot/Aufnahme.m4a', name: 'Aufnahme.m4a', modifiedAt: '2026-08-01T10:00:00.000Z', kind: 'file' },
  { path: '25.01 Pilot/_Aufnahme.m4a/Aufnahme.md', name: 'Aufnahme.md', modifiedAt: '2026-08-20T10:00:00.000Z', kind: 'twin' },
  { path: '25.01 Pilot/Notiz.pdf', name: 'Notiz.pdf', modifiedAt: '2026-08-01T10:00:00.000Z', kind: 'file' },
]

function bericht(body: string): ArchiveDocEntry {
  return {
    fileId: 'bericht-1',
    name: 'BERICHT.md',
    path: '25.01 Pilot/BERICHT.md',
    modifiedAt: '2026-08-10T10:00:00.000Z',
    meta: {},
    body,
  }
}

describe('reference-audit', () => {
  const index = buildReferenceIndex(targets)

  it('loest relativ zum Dokument, ab Wurzel und ueber den Namen auf', () => {
    expect(resolveReference('Notiz.pdf', '25.01 Pilot/BERICHT.md', index)?.path).toBe('25.01 Pilot/Notiz.pdf')
    expect(resolveReference('25.01 Pilot/Notiz.pdf', 'BERICHT.md', index)?.path).toBe('25.01 Pilot/Notiz.pdf')
    expect(resolveReference('Aufnahme', '25.01 Pilot/BERICHT.md', index)?.kind).toBe('twin')
  })

  it('meldet verweis_tot fuer ein fehlendes Ziel (Positivfall)', () => {
    const gaps = auditReferences({ doc: bericht('Siehe [[Geloescht.pdf]].'), folderId: 'f1', index })
    expect(gaps.map((g) => g.type)).toEqual(['verweis_tot'])
    expect(gaps[0].actor).toBe('cowork')
    expect(gaps[0].zyklusSchritt).toBe(3)
  })

  it('meldet keinen Befund fuer einen intakten, aelteren Verweis (Negativfall)', () => {
    const gaps = auditReferences({ doc: bericht('Siehe [[Notiz.pdf]].'), folderId: 'f1', index })
    expect(gaps).toEqual([])
  })

  it('meldet verweis_veraltet, wenn das Ziel juenger als das Dokument ist', () => {
    const gaps = auditReferences({ doc: bericht('Siehe [[Aufnahme.md]].'), folderId: 'f1', index })
    expect(gaps.map((g) => g.type)).toEqual(['verweis_veraltet'])
    expect(gaps[0].detail).toContain('2026-08-20')
  })

  it('meldet bericht_unvollstaendig fuer unerwaehnte Quellen (Positiv + Negativ)', () => {
    const expectedSources = [
      { name: 'Aufnahme.m4a', path: '25.01 Pilot/Aufnahme.m4a' },
      { name: 'Notiz.pdf', path: '25.01 Pilot/Notiz.pdf' },
    ]
    const offen = auditReferences({ doc: bericht('Nur [[Notiz.pdf]] ist erwaehnt.'), folderId: 'f1', index, expectedSources })
    expect(offen.map((g) => g.type)).toEqual(['bericht_unvollstaendig'])
    expect(offen[0].detail).toBe('Aufnahme.m4a')
    expect(offen[0].severity).toBe('info')

    const vollstaendig = auditReferences({
      doc: bericht('Es geht um [[Notiz.pdf]] und die Aufnahme.m4a.'),
      folderId: 'f1',
      index,
      expectedSources,
    })
    expect(vollstaendig).toEqual([])
  })

  it('erzeugt nach Korrektur des Berichts keinen Befund mehr (Akzeptanzkriterium 9)', () => {
    const kaputt = auditReferences({ doc: bericht('[[Geloescht.pdf]] und [[Aufnahme.md]]'), folderId: 'f1', index })
    expect(kaputt.map((g) => g.type).sort()).toEqual(['verweis_tot', 'verweis_veraltet'])

    const korrigiert: ArchiveDocEntry = { ...bericht('[[Notiz.pdf]] und [[Aufnahme.md]]'), modifiedAt: '2026-08-21T10:00:00.000Z' }
    expect(auditReferences({ doc: korrigiert, folderId: 'f1', index })).toEqual([])
  })
})
