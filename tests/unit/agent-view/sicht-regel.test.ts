/**
 * @fileoverview Unit-Tests: Befund `sicht_veraltet` (Wunschliste 5, B1).
 *
 * Der Befund vom 09.09.2026: BERICHT.md um 09:27 umgestellt, AKTUELL.md vom
 * 07.09. — nichts hat es gemeldet. Geprueft wird die Meldung UND wann die
 * Regel schweigt: Teilbaum-Scan, keine Sichten, keine Berichte, Frische aus.
 */

import { describe, expect, it } from 'vitest'
import type { ArchiveDocEntry, ArchiveFileEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { checkSichtVeraltet, juengsterBericht } from '@/lib/agent-view/sicht-regel'

const ALT = '2026-09-07T13:03:00.000Z'
const NEU = '2026-09-09T07:27:00.000Z'

function bericht(modifiedAt: string, pfad = '4. Aktivismus/26.05 SHF'): ArchiveDocEntry {
  return { fileId: `b-${pfad}`, name: 'BERICHT.md', path: `${pfad}/BERICHT.md`, modifiedAt, meta: {}, body: '' }
}

function sicht(name: string, modifiedAt: string | null): ArchiveFileEntry {
  return { fileId: `s-${name}`, name, path: `Organisation/${name}`, modifiedAt }
}

function ordner(overrides: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f', name: 'x', path: 'x', parentFolderId: 'root', depth: 2,
    files: [], twinFolders: [], index: null, bericht: null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
    ...overrides,
  }
}

function organisation(files: ArchiveFileEntry[]): ArchiveFolderNode {
  return ordner({ folderId: 'f-org', name: 'Organisation', path: 'Organisation', depth: 1, files })
}

function vorhaben(modifiedAt: string, pfad = '4. Aktivismus/26.05 SHF'): ArchiveFolderNode {
  return ordner({ folderId: `f-${pfad}`, name: pfad, path: pfad, bericht: bericht(modifiedAt, pfad) })
}

const voll = (folders: ArchiveFolderNode[]) =>
  checkSichtVeraltet({ folders, scopeFolderId: null, berichtFreshness: true })

describe('sicht_veraltet', () => {
  it('meldet die Sicht, wenn ein Bericht juenger ist — mit beiden Zeitstempeln', () => {
    const gaps = voll([organisation([sicht('AKTUELL.md', ALT)]), vorhaben(NEU)])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({
      type: 'sicht_veraltet', actor: 'cowork', severity: 'warning',
      folderId: 'f-org', targetId: 's-AKTUELL.md', targetName: 'AKTUELL.md', path: 'Organisation/AKTUELL.md',
    })
    expect(gaps[0].detail).toContain(ALT)
    expect(gaps[0].detail).toContain(NEU)
  })

  it('schweigt, wenn die Sicht juenger ist als jeder Bericht', () => {
    expect(voll([organisation([sicht('AKTUELL.md', NEU), sicht('PROJEKTE.md', NEU)]), vorhaben(ALT)])).toEqual([])
  })

  it('prueft beide Sichten getrennt', () => {
    const gaps = voll([organisation([sicht('AKTUELL.md', NEU), sicht('PROJEKTE.md', ALT)]), vorhaben(NEU)])
    expect(gaps.map((g) => g.targetName)).toEqual(['PROJEKTE.md'])
  })

  it('der juengste Bericht zaehlt, nicht der erste', () => {
    const gaps = voll([organisation([sicht('AKTUELL.md', '2026-09-08T00:00:00.000Z')]), vorhaben(ALT, 'a'), vorhaben(NEU, 'b')])
    expect(gaps).toHaveLength(1)
    expect(juengsterBericht([vorhaben(ALT, 'a'), vorhaben(NEU, 'b')])).toBe(NEU)
  })

  it('eine Sicht ohne Zeitstempel ist ein Befund, kein Freispruch', () => {
    const gaps = voll([organisation([sicht('AKTUELL.md', null)]), vorhaben(ALT)])
    expect(gaps).toHaveLength(1)
    expect(gaps[0].message).toContain('keinen Zeitstempel')
  })

  it('andere Dateien in Organisation/ sind keine Sichten', () => {
    expect(voll([organisation([sicht('Gantt.md', ALT)]), vorhaben(NEU)])).toEqual([])
  })

  it('schweigt im Teilbaum-Scan — der juengste Bericht liegt womoeglich ausserhalb', () => {
    const folders = [organisation([sicht('AKTUELL.md', ALT)]), vorhaben(NEU)]
    expect(checkSichtVeraltet({ folders, scopeFolderId: 'f-teil', berichtFreshness: true })).toEqual([])
  })

  it('schweigt ohne Organisation/-Ordner und ohne Berichte', () => {
    expect(voll([vorhaben(NEU)])).toEqual([])
    expect(voll([organisation([sicht('AKTUELL.md', ALT)])])).toEqual([])
  })

  it('folgt der Frische-Schaltung der Library (berichtFreshness aus → aus)', () => {
    const folders = [organisation([sicht('AKTUELL.md', ALT)]), vorhaben(NEU)]
    expect(checkSichtVeraltet({ folders, scopeFolderId: null, berichtFreshness: false })).toEqual([])
  })
})
