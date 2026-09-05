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
import { buildVorhabenCards, karteOhneAktuellFelder, karteOhneWerkbankFelder } from '@/lib/agent-view/vorhaben-board'

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

describe('buildVorhabenCards — Aktuell-Felder (A7)', () => {
  const root = folder('')

  it('liest Termin, Rolle und letzte Aktivitaet aus dem Bericht-Frontmatter', () => {
    const aktiv = folder('AECED', {
      bericht: doc('BERICHT.md', 'AECED/BERICHT.md', {
        meta: {
          status: 'aktiv',
          rolle: 'anwendung',
          letzte_aktivitaet: '2026-07-29',
          naechster_termin: '2026-08-31',
        },
        body: '# AECED Webseite',
      }),
    })
    const [card] = cardsFor([root, aktiv])
    expect(card.berichtRolle).toBe('anwendung')
    expect(card.berichtLetzteAktivitaet).toBe('2026-07-29')
    expect(card.berichtNaechsterTermin).toBe('2026-08-31')
    // Fehlt `termin_fixiert`, gilt der Termin als vereinbart (wie AKTUELL.md).
    expect(card.berichtTerminFixiert).toBe(true)
  })

  it('`termin_fixiert: nein` macht den Termin zum unfixierten', () => {
    const offen = folder('Klimagesetz', {
      bericht: doc('BERICHT.md', 'Klimagesetz/BERICHT.md', {
        meta: { naechster_termin: '2026-09-22', termin_fixiert: 'nein' },
      }),
    })
    const [card] = cardsFor([root, offen])
    expect(card.berichtTerminFixiert).toBe(false)
  })

  it('kappt die offenen Punkte auf zwei und nennt die Gesamtzahl', () => {
    const viele = folder('Viel', {
      bericht: doc('BERICHT.md', 'Viel/BERICHT.md', {
        meta: { status: 'aktiv' },
        body: [
          '# Viel zu tun',
          '',
          '## Nächste Schritte',
          '- [ ] erstens',
          '- [ ] zweitens',
          '- [ ] drittens',
          '- [x] erledigt — zaehlt nicht',
        ].join('\n'),
      }),
    })
    const [card] = cardsFor([root, viele])
    expect(card.berichtOffenePunkte).toEqual(['erstens', 'zweitens'])
    expect(card.berichtOffeneAnzahl).toBe(3)
  })

  it('Bericht ohne Frontmatter: Titel ja, Termin-Felder leer — kein Raten', () => {
    const kahl = folder('Kahl', {
      bericht: doc('BERICHT.md', 'Kahl/BERICHT.md', { meta: {}, body: '# Kahler Bericht' }),
    })
    const [card] = cardsFor([root, kahl])
    expect(card.berichtTitel).toBe('Kahler Bericht')
    expect(card.berichtNaechsterTermin).toBeNull()
    expect(card.berichtOffenePunkte).toEqual([])
    expect(card.berichtOffeneAnzahl).toBe(0)
  })

  it('ohne BERICHT.md tragen die Aktuell-Felder ihren Leerwert (gesetzt, nicht fehlend)', () => {
    const [card] = cardsFor([root, folder('Leer')])
    expect(card.berichtNaechsterTermin).toBeNull()
    expect(card.berichtOffenePunkte).toEqual([])
    expect(karteOhneAktuellFelder(card)).toBe(false)
  })
})

describe('karteOhneAktuellFelder', () => {
  it('erkennt Karten aus gespeicherten Reports vor A7', () => {
    const alt: VorhabenCard = {
      folderId: 'f-alt', name: 'Alt', path: 'Alt',
      bearbeitungsstand: 'erschlossen', bearbeitungsstandSeit: null, hasBericht: true,
      totalGaps: 0, gapsByActor: { mensch: 0, cowork: 0, knowledgescout: 0 }, gapsByType: {},
      widerspruch: false, ampel: 'gruen', themen: [],
    }
    expect(karteOhneAktuellFelder(alt)).toBe(true)
    // Die W1-Felder allein reichen nicht — A7 hat eigene.
    expect(karteOhneWerkbankFelder(alt)).toBe(false)
  })
})

describe('buildVorhabenCards — Postfach-Fenster (A7b)', () => {
  const root = folder('')

  it('uebernimmt postfach_ab/postfach_bis ROH — die Bewertung macht die Sicht', () => {
    const mit = folder('Naturmuseum', {
      bericht: doc('BERICHT.md', 'Naturmuseum/BERICHT.md', {
        meta: { postfach_ab: '2026-KW29', postfach_bis: '2026-KW35' },
      }),
    })
    const [card] = cardsFor([root, mit])
    expect(card.postfachAb).toBe('2026-KW29')
    expect(card.postfachBis).toBe('2026-KW35')
  })

  it('reicht auch einen unlesbaren Wert unveraendert durch (kein stilles null)', () => {
    const kaputt = folder('Kaputt', {
      bericht: doc('BERICHT.md', 'Kaputt/BERICHT.md', { meta: { postfach_bis: 'letzte Woche' } }),
    })
    expect(cardsFor([root, kaputt])[0].postfachBis).toBe('letzte Woche')
  })

  it('ohne Feld und ohne Bericht bleibt es null', () => {
    const ohneFeld = folder('OhneFeld', {
      bericht: doc('BERICHT.md', 'OhneFeld/BERICHT.md', { meta: { status: 'aktiv' } }),
    })
    const cards = cardsFor([root, ohneFeld, folder('OhneBericht')])
    expect(cards.find((c) => c.name === 'OhneFeld')?.postfachBis).toBeNull()
    expect(cards.find((c) => c.name === 'OhneBericht')?.postfachBis).toBeNull()
  })
})
