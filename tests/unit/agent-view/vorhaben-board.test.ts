/**
 * @fileoverview Unit-Tests: Werkbank-Felder der VorhabenCard (F9, Welle W1).
 *
 * Je neues Feld ein Fall: `ampel` kommt vom Baumknoten, die Bericht-Skalare
 * (`berichtTitel`/`berichtFileId`/`berichtModifiedAt`/`berichtStatus`) aus dem
 * beim Scan gelesenen `BERICHT.md` (via `titelLesen`, kein zweiter Parser),
 * `themen` mit F12-Vorrang (Bericht fuehrend, `_INDEX.md` nur ohne Bericht).
 * Dazu die Erkennung von Karten aus Reports vor W1 (sichtbarer Hinweis).
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { createGap } from '@/lib/agent-view/gap-registry'
import { buildTree } from '@/lib/agent-view/tree-builder'
import type { CoverageGap, VorhabenCard } from '@/lib/agent-view/types'
import { buildVorhabenCards, karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'

function doc(name: string, path: string, overrides: Partial<ArchiveDocEntry> = {}): ArchiveDocEntry {
  return {
    fileId: `file-${path}`,
    name,
    path,
    modifiedAt: '2026-08-20T09:00:00.000Z',
    meta: {},
    body: '',
    ...overrides,
  }
}

function folder(path: string, overrides: Partial<ArchiveFolderNode> = {}): ArchiveFolderNode {
  return {
    folderId: `f-${path || 'root'}`,
    name: path.split('/').pop() ?? '',
    path,
    parentFolderId: path === '' ? null : 'f-root',
    depth: path === '' ? 0 : 1,
    files: [],
    twinFolders: [],
    index: null,
    bericht: null,
    bearbeitungsstand: path === '' ? null : 'erschlossen',
    bearbeitungsstandSeit: null,
    ...overrides,
  }
}

function gapAt(folderId: string, type: CoverageGap['type'] = 'source_without_twin'): CoverageGap {
  return createGap({
    type,
    scope: 'folder',
    targetId: folderId,
    targetName: folderId,
    folderId,
    path: folderId,
    message: 'Testbefund',
  })
}

function cardsFor(folders: ArchiveFolderNode[], gaps: CoverageGap[] = []): VorhabenCard[] {
  const tree = buildTree({ folders, gaps, sourceCountByFolder: new Map(), ownChangeByFolder: new Map() })
  return buildVorhabenCards({ folders, tree, gaps, vorhabenPattern: null, libraryRootFolderId: 'f-root' })
}

describe('buildVorhabenCards — Werkbank-Felder (W1)', () => {
  const root = folder('')

  it('uebernimmt die ampel des Baumknotens (rot bei Befund, gruen ohne)', () => {
    const rot = folder('Rot')
    const gruen = folder('Gruen')
    const cards = cardsFor([root, rot, gruen], [gapAt(rot.folderId)])
    expect(cards.find((c) => c.name === 'Gruen')?.ampel).toBe('gruen')
    expect(cards.find((c) => c.name === 'Rot')?.ampel).toBe('rot')
  })

  it('liest berichtTitel als H1 des BERICHT.md; ohne H1 bleibt er sichtbar leer', () => {
    const mitH1 = folder('Pilot', {
      bericht: doc('BERICHT.md', 'Pilot/BERICHT.md', { body: '# Pilotprojekt Klima\n\nText.' }),
    })
    const ohneH1 = folder('Kahl', {
      bericht: doc('BERICHT.md', 'Kahl/BERICHT.md', { body: 'Nur Text ohne Ueberschrift.' }),
    })
    const cards = cardsFor([root, mitH1, ohneH1])
    expect(cards.find((c) => c.name === 'Pilot')?.berichtTitel).toBe('Pilotprojekt Klima')
    expect(cards.find((c) => c.name === 'Kahl')?.berichtTitel).toBe('')
  })

  it('traegt berichtFileId und berichtModifiedAt aus der Scan-Datei (Deep-Link + Frische)', () => {
    const mitBericht = folder('Pilot', {
      bericht: doc('BERICHT.md', 'Pilot/BERICHT.md', {
        fileId: 'id-b1',
        modifiedAt: '2026-08-21T07:30:00.000Z',
      }),
    })
    const [card] = cardsFor([root, mitBericht])
    expect(card.berichtFileId).toBe('id-b1')
    expect(card.berichtModifiedAt).toBe('2026-08-21T07:30:00.000Z')
  })

  it('liest berichtStatus aus dem Frontmatter; fehlendes Feld wird null, kein Raten', () => {
    const mitStatus = folder('Aktiv', {
      bericht: doc('BERICHT.md', 'Aktiv/BERICHT.md', { meta: { status: 'aktiv' } }),
    })
    const ohneStatus = folder('Ohne', {
      bericht: doc('BERICHT.md', 'Ohne/BERICHT.md', { meta: {} }),
    })
    const cards = cardsFor([root, mitStatus, ohneStatus])
    expect(cards.find((c) => c.name === 'Aktiv')?.berichtStatus).toBe('aktiv')
    expect(cards.find((c) => c.name === 'Ohne')?.berichtStatus).toBeNull()
  })

  it('themen: BERICHT.md ist fuehrend — auch wenn das _INDEX.md eigene themen traegt (F12)', () => {
    const beide = folder('Beide', {
      bericht: doc('BERICHT.md', 'Beide/BERICHT.md', { meta: { themen: ['Commoning', 'KI'] } }),
      index: doc('_INDEX.md', 'Beide/_INDEX.md', { meta: { themen: ['Veraltet'] } }),
    })
    const [card] = cardsFor([root, beide])
    expect(card.themen).toEqual(['Commoning', 'KI'])
  })

  it('themen: ohne Bericht zaehlt das _INDEX.md als Fallback; ganz ohne Quelle bleibt die Liste leer', () => {
    const nurIndex = folder('NurIndex', {
      index: doc('_INDEX.md', 'NurIndex/_INDEX.md', { meta: { themen: '[Commoning, Secretary Service]' } }),
    })
    const nichts = folder('Nichts')
    const cards = cardsFor([root, nurIndex, nichts])
    expect(cards.find((c) => c.name === 'NurIndex')?.themen).toEqual(['Commoning', 'Secretary Service'])
    expect(cards.find((c) => c.name === 'Nichts')?.themen).toEqual([])
  })

  it('ohne BERICHT.md sind alle Bericht-Skalare null — benannt, nicht geraten', () => {
    const [card] = cardsFor([root, folder('Leer')])
    expect(card.hasBericht).toBe(false)
    expect(card.berichtTitel).toBeNull()
    expect(card.berichtFileId).toBeNull()
    expect(card.berichtModifiedAt).toBeNull()
    expect(card.berichtStatus).toBeNull()
  })
})

describe('karteOhneWerkbankFelder', () => {
  it('erkennt Karten aus gespeicherten Reports vor W1 (Felder fehlen)', () => {
    const alt: VorhabenCard = {
      folderId: 'f-alt', name: 'Alt', path: 'Alt',
      bearbeitungsstand: 'erschlossen', bearbeitungsstandSeit: null, hasBericht: true,
      totalGaps: 0, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
      widerspruch: false,
    }
    expect(karteOhneWerkbankFelder(alt)).toBe(true)
  })

  it('frisch gebaute Karten tragen die Felder — kein Hinweis noetig', () => {
    const [card] = cardsFor([folder(''), folder('Neu')])
    expect(karteOhneWerkbankFelder(card)).toBe(false)
  })
})

describe('buildVorhabenCards — gepflegte Themen (A6)', () => {
  const root = folder('')

  it('liest gepflegteThemen IMMER aus dem _INDEX.md (`themen:`), auch mit Bericht', () => {
    const mitBeidem = folder('Pilot', {
      index: doc('_INDEX.md', 'Pilot/_INDEX.md', { meta: { themen: ['Commoning', 'KI'] } }),
      bericht: doc('BERICHT.md', 'Pilot/BERICHT.md', { meta: { themen: ['Technik-Baustein'] }, body: '# P' }),
    })
    const cards = cardsFor([root, mitBeidem])
    expect(cards[0].gepflegteThemen).toEqual(['Commoning', 'KI'])
    // BERICHT-themen bleiben getrennt im W1-Feld — sie gruppieren nicht mehr.
    expect(cards[0].themen).toEqual(['Technik-Baustein'])
  })

  it('Einzelwert zaehlt als Liste mit einem Element; ohne Feld bleibt sie leer', () => {
    const einzel = folder('Einzel', {
      index: doc('_INDEX.md', 'Einzel/_INDEX.md', { meta: { themen: 'Commoning' } }),
    })
    const ohne = folder('Ohne', { index: doc('_INDEX.md', 'Ohne/_INDEX.md') })
    const cards = cardsFor([root, einzel, ohne])
    expect(cards.find((c) => c.name === 'Einzel')?.gepflegteThemen).toEqual(['Commoning'])
    expect(cards.find((c) => c.name === 'Ohne')?.gepflegteThemen).toEqual([])
  })
})
