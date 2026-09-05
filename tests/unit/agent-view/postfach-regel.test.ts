/**
 * @fileoverview Unit-Tests: Befund `postfach_veraltet` (Welle A7b).
 *
 * Die Regel ist die einzige Archiv-Regel, die gegen den KALENDER misst statt
 * gegen eine zweite Datei — geprueft wird deshalb vor allem, wann sie
 * SCHWEIGT: ohne konfigurierte Schwelle (Archiv-Konvention, nicht
 * Plattform-Wissen), ohne Bericht und ohne `postfach_bis`.
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { ArchiveRuleContext } from '@/lib/agent-view/archive-rules'
import { checkPostfachVeraltet } from '@/lib/agent-view/postfach-regel'

/** 2026-09-05 ist KW 36/2026. */
const JETZT = '2026-09-05T09:00:00.000Z'

function bericht(meta: Record<string, unknown>): ArchiveDocEntry {
  return {
    fileId: 'file-bericht',
    name: 'BERICHT.md',
    path: '26.07 Naturmuseum/BERICHT.md',
    modifiedAt: '2026-09-03T11:30:17.000Z',
    meta,
    body: '# Naturmuseum',
  }
}

function folder(overrides: Partial<ArchiveFolderNode> = {}): ArchiveFolderNode {
  return {
    folderId: 'f-naturmuseum',
    name: '26.07 Naturmuseum',
    path: '4. Ökosozialer Aktivismus/26.07 Naturmuseum',
    parentFolderId: 'f-root',
    depth: 2,
    files: [],
    twinFolders: [],
    index: null,
    bericht: null,
    bearbeitungsstand: 'berichtet',
    bearbeitungsstandSeit: null,
    ...overrides,
  }
}

function ctx(postfachMaxRueckstandWochen: number | null): ArchiveRuleContext {
  return {
    conventions: {
      vorhabenFolderPattern: null,
      indexRequiredMaxDepth: null,
      berichtFreshness: true,
      postfachMaxRueckstandWochen,
    },
    vorhabenPattern: null,
    newestChangeInSubtree: null,
    isLibraryRoot: false,
    now: JETZT,
  }
}

describe('checkPostfachVeraltet — wann die Regel schweigt', () => {
  it('ohne konfigurierte Schwelle: gar nicht pruefen (Regel inaktiv)', () => {
    const node = folder({ bericht: bericht({ postfach_bis: '2020-KW01' }) })
    expect(checkPostfachVeraltet(node, ctx(null))).toBeNull()
  })

  it('ohne BERICHT.md gibt es nichts zu messen', () => {
    expect(checkPostfachVeraltet(folder(), ctx(1))).toBeNull()
  })

  it('ohne `postfach_bis` fuehrt das Vorhaben keine Postfach-Auswertung', () => {
    const node = folder({ bericht: bericht({ status: 'aktiv' }) })
    expect(checkPostfachVeraltet(node, ctx(1))).toBeNull()
  })

  it('innerhalb der Schwelle kein Befund', () => {
    const node = folder({ bericht: bericht({ postfach_bis: '2026-KW35' }) }) // Rueckstand 1
    expect(checkPostfachVeraltet(node, ctx(1))).toBeNull()
  })
})

describe('checkPostfachVeraltet — wann sie meldet', () => {
  it('oberhalb der Schwelle: Befund bei Cowork, Zyklus-Schritt 3', () => {
    const node = folder({ bericht: bericht({ postfach_bis: '2026-KW29' }) }) // Rueckstand 7
    const gap = checkPostfachVeraltet(node, ctx(2))
    expect(gap).not.toBeNull()
    expect(gap?.type).toBe('postfach_veraltet')
    expect(gap?.actor).toBe('cowork')
    expect(gap?.zyklusSchritt).toBe(3)
    expect(gap?.message).toContain('7 Wochen offen')
    // Anker ist der Bericht — von dort aus wird nachgetragen.
    expect(gap?.targetId).toBe('file-bericht')
    expect(gap?.targetName).toBe('BERICHT.md')
  })

  it('unlesbares `postfach_bis` meldet trotz aktiver Schwelle — kein stilles Durchwinken', () => {
    const node = folder({ bericht: bericht({ postfach_bis: 'letzte Woche' }) })
    const gap = checkPostfachVeraltet(node, ctx(52))
    expect(gap?.message).toContain('unlesbar')
  })

  it('nennt die Gegenstellen im Detail — ohne sie ist die Suche nicht eingegrenzt', () => {
    const mit = folder({
      bericht: bericht({ postfach_bis: '2026-KW29', korrespondenz: 'David.Gruber@naturmuseum.it' }),
    })
    expect(checkPostfachVeraltet(mit, ctx(2))?.detail).toContain('David.Gruber@naturmuseum.it')

    const ohne = folder({ bericht: bericht({ postfach_bis: '2026-KW29' }) })
    expect(checkPostfachVeraltet(ohne, ctx(2))?.detail).toContain('korrespondenz:')
  })
})
