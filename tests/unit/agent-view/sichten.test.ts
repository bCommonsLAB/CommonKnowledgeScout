/**
 * @fileoverview Unit-Tests: erzeugte Sichten AKTUELL/PROJEKTE (Wunschliste 2, W1).
 *
 * Port-Treue zu aktuell.py/projekte.py: Frontmatter-Felder, naechste Schritte
 * (inkl. umbrochener Punkte), Sortierung, Termin-Marke, Themenregister,
 * Abdeckungs-Nenner.
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { offenePunkte, projektAusBericht, sammleProjekte, zaehleProjektordner } from '@/lib/agent-view/sichten/bericht-lesen'
import { renderAktuell } from '@/lib/agent-view/sichten/aktuell-render'
import { renderProjekte, themenregister } from '@/lib/agent-view/sichten/projekte-render'
import { datumLesbar } from '@/lib/agent-view/sichten/types'

const NOW = new Date('2026-08-22T10:00:00.000Z')

const BODY = `# Klimamaßnahmen Südtirol

Ein **öffentliches** Portal, das die Klimamaßnahmen erschließbar macht.
Fachlicher Partner ist Roland.

## Status

Aktiv.

## Nächste Schritte

- [x] Namen mit Thomas abstimmen
- [ ] 25.08 Zoom — Plattform Landesklimagesetz,
      Powerplan besprechen
- [ ] CO₂-Index finalisieren
- [ ] Dritter Punkt (kommt in AKTUELL nicht vor)

## Chronologie
`

function folder(overrides: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f', name: 'x', path: 'x', parentFolderId: null, depth: 0,
    files: [], twinFolders: [], index: null, bericht: null,
    bearbeitungsstand: null, bearbeitungsstandSeit: null,
    ...overrides,
  } as ArchiveFolderNode
}

function berichtFolder(path: string, meta: Record<string, unknown>, body = BODY): ArchiveFolderNode {
  return folder({
    folderId: `id-${path}`, name: path.split('/').pop() ?? path, path, depth: 2,
    bericht: { fileId: `b-${path}`, name: 'BERICHT.md', path: `${path}/BERICHT.md`, modifiedAt: null, meta, body },
  })
}

const KLIMA = berichtFolder('4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol', {
  projekt: '26.01 Klimamassnahmen Südtirol', status: 'aktiv', rolle: 'anwendung', bereich: 'ökosozial',
  begonnen: '2026-01', letzte_aktivitaet: new Date('2026-08-22'), naechster_termin: '2026-08-25',
  termin_fixiert: 'nein', plattform: '24.09 KnowledgeScout', themen: ['Ampel-Logik', 'Knowledge Graph'],
})
const KS = berichtFolder('6. bCommonsLab prototyping/24.09 KnowledgeScout', {
  projekt: '24.09 KnowledgeScout', status: 'aktiv', rolle: 'plattform', bereich: 'prototyping',
  begonnen: '2024-09', letzte_aktivitaet: '2026-07-22', repo: '[CommonKnowledgeScout, Desktop]',
  themen: 'Knowledge Graph',
}, '# KnowledgeScout — Plattform\n\nDie Plattform.\n')
const RUHEND = berichtFolder('7. Buchprojekt/23.01 Buch', {
  projekt: '23.01 Buch', status: 'ruhend', bereich: 'privat', letzte_aktivitaet: '2024-09-01',
}, '# Buch\n')

describe('bericht-lesen', () => {
  it('liest Frontmatter (auch Date-Objekte und Minimal-YAML-Listen), H1, Absatz und offene Schritte', () => {
    const p = projektAusBericht(KLIMA)
    expect(p).toMatchObject({
      titel: 'Klimamaßnahmen Südtirol', letzteAktivitaet: '2026-08-22', terminFixiert: false,
      beschreibung: 'Ein öffentliches Portal, das die Klimamaßnahmen erschließbar macht. Fachlicher Partner ist Roland.',
    })
    expect(p?.schritte).toEqual([
      '25.08 Zoom — Plattform Landesklimagesetz, Powerplan besprechen',
      'CO₂-Index finalisieren',
      'Dritter Punkt (kommt in AKTUELL nicht vor)',
    ])
    expect(projektAusBericht(KS)?.repo).toEqual(['CommonKnowledgeScout', 'Desktop'])
    expect(projektAusBericht(KS)?.themen).toEqual(['Knowledge Graph'])
    expect(offenePunkte('kein Abschnitt')).toEqual([])
  })

  it('Berichte ohne Frontmatter und Ordner ohne Bericht fallen weg; Abdeckung zaehlt Projektordner', () => {
    const ohneMeta = berichtFolder('x/leer', {})
    const bereich = folder({ folderId: 'b4', name: '4. Ökosozialer Aktivismus', path: '4. Ökosozialer Aktivismus', depth: 1 })
    const inbox = folder({ folderId: 'b0', name: '0. Inbox', path: '0. Inbox', depth: 1 })
    const projekt = folder({ folderId: 'p1', name: '26.01 Klima', path: '4. Ökosozialer Aktivismus/26.01 Klima', depth: 2, parentFolderId: 'b4' })
    const twin = folder({ folderId: 'p2', name: '_x', path: '4. Ökosozialer Aktivismus/_x', depth: 2, parentFolderId: 'b4' })
    const inboxKind = folder({ folderId: 'p3', name: 'irgendwas', path: '0. Inbox/irgendwas', depth: 2, parentFolderId: 'b0' })
    expect(sammleProjekte([ohneMeta, KLIMA, KS]).map((p) => p.projekt)).toEqual(['26.01 Klimamassnahmen Südtirol', '24.09 KnowledgeScout'])
    expect(zaehleProjektordner([bereich, inbox, projekt, twin, inboxKind])).toBe(1)
  })
})

describe('renderAktuell', () => {
  it('Terminleiste mit Warnmarke, Tabelle sortiert nach Termin, nur zwei Schritte je Vorhaben', () => {
    const out = renderAktuell(sammleProjekte([KS, KLIMA, RUHEND]), NOW)
    expect(out.startsWith('---\ntype: sicht\nsicht: aktuell\ngenerated_by: knowledgescout/sichten\n')).toBe(true)
    expect(out).toContain('Erzeugt am 22.08.2026')
    expect(out).toContain('- **25. August 2026** · Klimamaßnahmen Südtirol  ⚠️ *noch nicht fixiert* — 25.08 Zoom')
    expect(out).toContain('> Termine mit ⚠️ sind noch nicht vereinbart')
    const tabelle = out.split('## Aktive Projekte')[1].split('## Was als Nächstes')[0]
    expect(tabelle.indexOf('26.01 Klimamassnahmen')).toBeLessThan(tabelle.indexOf('24.09 KnowledgeScout'))
    expect(out).toContain('| [[4. Ökosozialer Aktivismus/26.01 Klimamassnahmen Südtirol/BERICHT|26.01 Klimamassnahmen Südtirol]] | anwendung | 22. August 2026 | 25. August 2026 ⚠️ |')
    expect(out).toContain('- CO₂-Index finalisieren')
    expect(out).not.toContain('Dritter Punkt')
    expect(out).toContain('- 23.01 Buch — ruhend, zuletzt 1. September 2024')
    expect(out).toContain('**Abdeckung:** 3 Projekte haben einen Bericht.')
  })
})

describe('renderProjekte', () => {
  it('Abdeckung, Bereiche in fester Ordnung, Steckbrief-Marken und Themenregister', () => {
    const projekte = sammleProjekte([KLIMA, KS, RUHEND])
    const out = renderProjekte(projekte, 101, NOW)
    expect(out).toContain('> **Abdeckung:** 3 von 101 Projektordnern haben einen Bericht.')
    expect(out.indexOf('## bCommonsLab — Prototypen und Plattformen')).toBeLessThan(out.indexOf('## Ökosozialer Aktivismus'))
    expect(out).toContain('`26.01 Klimamassnahmen Südtirol` · anwendung · aktiv · Januar 2026 – 22. August 2026')
    expect(out).toContain('Repo: `CommonKnowledgeScout`, `Desktop`')
    expect(out).toContain('Plattform: 24.09 KnowledgeScout')
    expect(out).toContain('**Themen.** *(fehlen — ohne sie findet kein Text hierher)*')
    expect(themenregister(projekte)[0]).toEqual(['Knowledge Graph', ['26.01 Klimamassnahmen Südtirol', '24.09 KnowledgeScout']])
    expect(out).toContain('| **Knowledge Graph** | 24.09 KnowledgeScout, 26.01 Klimamassnahmen Südtirol |')
    expect(out).toContain('*2 Themen aus 3 Vorhaben.*')
  })

  it('datumLesbar: Tag, Monat, Fremdformat', () => {
    expect(datumLesbar('2026-08-22')).toBe('22. August 2026')
    expect(datumLesbar('2026-08')).toBe('August 2026')
    expect(datumLesbar('bald')).toBe('bald')
  })
})
