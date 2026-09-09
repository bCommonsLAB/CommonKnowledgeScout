/**
 * @fileoverview Unit-Tests: Befund `thema_fehlt` (Wunschliste 5, B3c).
 *
 * `24.09 KnowledgeScout` fuehrt EIN `themen:` fuer 53 Ereignisordner — das
 * Themenregister zeigt bis zum Vorhaben, nie hinein. Geprueft wird die
 * Meldung UND jedes der drei Tore, an denen die Regel schweigt: kein
 * Vokabular, Stand unter `erschlossen`, kein Vorhabens-Vorfahre.
 */

import { describe, expect, it } from 'vitest'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { checkThemaFehlt } from '@/lib/agent-view/thema-regel'
import type { Bearbeitungsstand } from '@/lib/agent-view/types'

const MUSTER = /^\d{2}\.\d{2} /

function index(meta: Record<string, unknown>, pfad: string): ArchiveDocEntry {
  return { fileId: `i-${pfad}`, name: '_INDEX.md', path: `${pfad}/_INDEX.md`, modifiedAt: null, meta, body: '' }
}

function ordner(overrides: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f', name: 'x', path: 'x', parentFolderId: null, depth: 1,
    files: [], twinFolders: [], index: null, bericht: null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
    ...overrides,
  }
}

/** Vorhaben nach Muster, mit eigenem Thema — der uebliche Fall. */
function vorhaben(): ArchiveFolderNode {
  const pfad = '6. Prototyping/24.09 KnowledgeScout'
  return ordner({
    folderId: 'f-vorhaben', name: '24.09 KnowledgeScout', path: pfad, parentFolderId: 'f-bereich', depth: 2,
    index: index({ themen: ['KS-Plattform'], bearbeitungsstand: 'berichtet' }, pfad),
    bearbeitungsstand: 'berichtet',
  })
}

function ereignis(args: {
  name?: string
  stand: Bearbeitungsstand | null
  themen?: string[]
  parentFolderId?: string | null
  ohneIndex?: boolean
}): ArchiveFolderNode {
  const name = args.name ?? '2026-09-09 Besprechung Roland'
  const pfad = `6. Prototyping/24.09 KnowledgeScout/${name}`
  const meta: Record<string, unknown> = { ...(args.themen ? { themen: args.themen } : {}) }
  if (args.stand !== null) meta.bearbeitungsstand = args.stand
  return ordner({
    folderId: `f-${name}`, name, path: pfad,
    // Kein `??`: `parentFolderId: null` muss NULL bleiben, sonst prueft der
    // Wurzel-Fall unten in Wahrheit den Normalfall.
    parentFolderId: args.parentFolderId === undefined ? 'f-vorhaben' : args.parentFolderId,
    depth: 3,
    index: args.ohneIndex === true ? null : index(meta, pfad),
    bearbeitungsstand: args.stand,
  })
}

const pruefe = (folders: ArchiveFolderNode[], vokabularGepflegt = true) =>
  checkThemaFehlt({ folders, vorhabenPattern: MUSTER, vokabularGepflegt })

describe('thema_fehlt', () => {
  it('meldet den erschlossenen Ereignisordner ohne Thema — mit Stand und Vorhaben im Detail', () => {
    const kind = ereignis({ stand: 'erschlossen' })
    const gaps = pruefe([vorhaben(), kind])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({
      type: 'thema_fehlt', actor: 'cowork', severity: 'warning', zyklusSchritt: 3,
      folderId: kind.folderId, targetName: '_INDEX.md', targetId: `i-${kind.path}`, path: kind.path,
    })
    expect(gaps[0].detail).toContain('erschlossen')
    expect(gaps[0].detail).toContain('24.09 KnowledgeScout')
  })

  it('schweigt, sobald der Ordner ein Thema traegt', () => {
    expect(pruefe([vorhaben(), ereignis({ stand: 'berichtet', themen: ['Retrieval'] })])).toEqual([])
  })

  it('eine leere Liste zaehlt wie kein Thema', () => {
    expect(pruefe([vorhaben(), ereignis({ stand: 'berichtet', themen: [] })])).toHaveLength(1)
  })

  it('greift ab erschlossen — ungesichtet schweigt, spaetere Staende melden', () => {
    expect(pruefe([vorhaben(), ereignis({ stand: 'ungesichtet' })])).toEqual([])
    expect(pruefe([vorhaben(), ereignis({ stand: null })])).toEqual([])
    for (const stand of ['erschlossen', 'strukturiert', 'berichtet', 'abgenommen'] as const) {
      expect(pruefe([vorhaben(), ereignis({ stand })])).toHaveLength(1)
    }
  })

  it('ohne _INDEX.md schweigt die Regel — dafuer ist index_missing zustaendig', () => {
    expect(pruefe([vorhaben(), ereignis({ stand: 'erschlossen', ohneIndex: true })])).toEqual([])
  })

  it('das Vorhaben selbst ist kein Befund — seine Themen fuehrt der Bericht', () => {
    const ohneThema = ordner({
      folderId: 'f-vorhaben', name: '24.09 KnowledgeScout', path: '6. Prototyping/24.09 KnowledgeScout',
      parentFolderId: 'f-bereich', depth: 2,
      index: index({ bearbeitungsstand: 'berichtet' }, '6. Prototyping/24.09 KnowledgeScout'),
      bearbeitungsstand: 'berichtet',
    })
    expect(pruefe([ohneThema])).toEqual([])
  })

  it('Ordner ausserhalb jedes Vorhabens schweigen (Bereich, Organisation/)', () => {
    const bereich = ordner({
      folderId: 'f-bereich', name: '6. Prototyping', path: '6. Prototyping', depth: 1,
      index: index({ bearbeitungsstand: 'berichtet' }, '6. Prototyping'), bearbeitungsstand: 'berichtet',
    })
    const organisation = ordner({
      folderId: 'f-org', name: 'Organisation', path: 'Organisation', depth: 1,
      index: index({ bearbeitungsstand: 'berichtet' }, 'Organisation'), bearbeitungsstand: 'berichtet',
    })
    expect(pruefe([bereich, organisation, vorhaben()])).toEqual([])
  })

  it('meldet auch tiefer verschachtelte Ordner unter dem Vorhaben', () => {
    const kind = ereignis({ stand: 'erschlossen', themen: ['Retrieval'] })
    const enkel = ereignis({ name: 'Anhang', stand: 'erschlossen', parentFolderId: kind.folderId })
    const gaps = pruefe([vorhaben(), kind, enkel])
    expect(gaps.map((g) => g.folderId)).toEqual([enkel.folderId])
  })

  it('ohne gepflegtes Vokabular ist die Regel inaktiv', () => {
    expect(pruefe([vorhaben(), ereignis({ stand: 'erschlossen' })], false)).toEqual([])
  })

  it('ohne Vorhaben im gescannten Satz wird nicht geraten (Teilbaum unterhalb des Vorhabens)', () => {
    // Beide Enden der Kette: gar kein Elternteil (Scan-Wurzel) und ein
    // Elternteil, das ausserhalb des gescannten Satzes liegt.
    expect(pruefe([ereignis({ stand: 'erschlossen', parentFolderId: null })])).toEqual([])
    expect(pruefe([ereignis({ stand: 'erschlossen', parentFolderId: 'f-ausserhalb' })])).toEqual([])
  })

  it('ein BERICHT.md macht den Ordner zum Vorhaben, auch ohne passenden Namen', () => {
    const mitBericht = ordner({
      folderId: 'f-vorhaben', name: 'Sonderfall', path: 'Sonderfall', depth: 1,
      index: index({ themen: ['X'], bearbeitungsstand: 'berichtet' }, 'Sonderfall'),
      bericht: { fileId: 'b-1', name: 'BERICHT.md', path: 'Sonderfall/BERICHT.md', modifiedAt: null, meta: {}, body: '' },
      bearbeitungsstand: 'berichtet',
    })
    const kind = ereignis({ stand: 'erschlossen' })
    expect(checkThemaFehlt({ folders: [mitBericht, kind], vorhabenPattern: null, vokabularGepflegt: true })).toHaveLength(1)
  })

  it('ein erklaerter bearbeitungsstand allein macht den Ereignisordner NICHT zum Vorhaben', () => {
    // Sonst waere jeder Ereignisordner sein eigenes Vorhaben und die Regel stumm:
    // laut Konventionen traegt JEDER Ordner einen Stand im _INDEX.md.
    const kind = ereignis({ stand: 'berichtet' })
    expect(pruefe([vorhaben(), kind])).toHaveLength(1)
  })
})
