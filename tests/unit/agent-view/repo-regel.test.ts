/**
 * @fileoverview Unit-Tests: Repo-Frische und Befund `repo_veraltet` (Wunschliste 5, C1).
 *
 * Wie bei `postfach_veraltet` wird vor allem geprueft, wann die Regel
 * SCHWEIGT (ohne Schwelle, ohne Bericht, ohne `repo:`) und dass ein fehlender
 * oder unlesbarer Pruefstand ein Befund ist, kein Freispruch.
 */

import { describe, expect, it } from 'vitest'
import type { ArchiveDocEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { ArchiveRuleContext } from '@/lib/agent-view/archive-rules'
import { istRepoImRueckstand, leseRepoStand, repoStandLabel } from '@/lib/agent-view/repo-frische'
import { checkRepoVeraltet } from '@/lib/agent-view/repo-regel'

const JETZT = '2026-09-19T10:00:00.000Z'
const jetzt = new Date(JETZT)

function bericht(meta: Record<string, unknown>): ArchiveDocEntry {
  return { fileId: 'file-bericht', name: 'BERICHT.md', path: '24.09 KnowledgeScout/BERICHT.md', modifiedAt: JETZT, meta, body: '' }
}

function folder(meta: Record<string, unknown> | null): ArchiveFolderNode {
  return {
    folderId: 'f-ks', name: '24.09 KnowledgeScout', path: '6. prototyping/24.09 KnowledgeScout',
    parentFolderId: 'f-root', depth: 2, files: [], twinFolders: [], index: null,
    bericht: meta ? bericht(meta) : null, bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null,
  }
}

function ctx(repoMaxRueckstandTage: number | null): ArchiveRuleContext {
  return {
    conventions: {
      vorhabenFolderPattern: null, indexRequiredMaxDepth: null, berichtFreshness: true,
      postfachMaxRueckstandWochen: null, repoMaxRueckstandTage,
    },
    vorhabenPattern: null, newestChangeInSubtree: null, isLibraryRoot: false, now: JETZT,
  }
}

describe('leseRepoStand', () => {
  it('ohne repo: nichts zu pruefen', () => {
    expect(leseRepoStand({ repo: [], repoStandAm: '2026-09-09', repoStand: null }, jetzt)).toEqual({ art: 'ohne_repo' })
  })

  it('Repo ohne Pruefstand ist ein benannter Zustand', () => {
    expect(leseRepoStand({ repo: ['CommonKnowledgeScout'], repoStandAm: null, repoStand: null }, jetzt))
      .toEqual({ art: 'ohne_angabe', repos: ['CommonKnowledgeScout'] })
  })

  it('liest Datum, Commit und Rueckstand in Tagen', () => {
    const stand = leseRepoStand({ repo: ['CommonKnowledgeScout'], repoStandAm: '2026-09-09', repoStand: '66ef1f3e' }, jetzt)
    expect(stand).toMatchObject({ art: 'gelesen', datum: '2026-09-09', rueckstandTage: 10, commit: '66ef1f3e' })
  })

  it('ein Datum, das es nicht gibt, ist unlesbar — nicht der naechste Tag', () => {
    expect(leseRepoStand({ repo: ['x'], repoStandAm: '2026-02-30', repoStand: null }, jetzt)).toMatchObject({ art: 'unlesbar', roh: '2026-02-30' })
    expect(leseRepoStand({ repo: ['x'], repoStandAm: 'gestern', repoStand: null }, jetzt)).toMatchObject({ art: 'unlesbar' })
  })

  it('Zukunft ergibt negativen Rueckstand und wird im Label benannt', () => {
    const stand = leseRepoStand({ repo: ['x'], repoStandAm: '2026-09-25', repoStand: null }, jetzt)
    expect(stand).toMatchObject({ art: 'gelesen', rueckstandTage: -6 })
    expect(repoStandLabel(stand)).toContain('Zukunft')
  })

  it('Schwelle: gleich viele Tage sind kein Rueckstand, einer mehr schon', () => {
    const stand = leseRepoStand({ repo: ['x'], repoStandAm: '2026-09-09', repoStand: null }, jetzt)
    expect(istRepoImRueckstand(stand, 10)).toBe(false)
    expect(istRepoImRueckstand(stand, 9)).toBe(true)
  })
})

describe('repo_veraltet', () => {
  it('schweigt ohne konfigurierte Schwelle', () => {
    expect(checkRepoVeraltet(folder({ repo: ['CommonKnowledgeScout'] }), ctx(null))).toBeNull()
  })

  it('schweigt ohne Bericht und ohne repo:', () => {
    expect(checkRepoVeraltet(folder(null), ctx(7))).toBeNull()
    expect(checkRepoVeraltet(folder({ status: 'aktiv' }), ctx(7))).toBeNull()
  })

  it('Repo ohne repo_stand_am ist ein Befund', () => {
    const gap = checkRepoVeraltet(folder({ repo: ['CommonKnowledgeScout'] }), ctx(7))
    expect(gap).toMatchObject({ type: 'repo_veraltet', actor: 'cowork', severity: 'warning', targetName: 'BERICHT.md' })
    expect(gap?.message).toContain('repo_stand_am fehlt')
  })

  it('frischer Pruefstand: kein Befund', () => {
    expect(checkRepoVeraltet(folder({ repo: ['CommonKnowledgeScout'], repo_stand_am: '2026-09-15' }), ctx(7))).toBeNull()
  })

  it('alter Pruefstand: Befund mit Datum, Commit und Schwelle', () => {
    const gap = checkRepoVeraltet(folder({ repo: ['CommonKnowledgeScout'], repo_stand_am: '2026-09-01', repo_stand: 'abc1234' }), ctx(7))
    expect(gap?.message).toContain('2026-09-01')
    expect(gap?.message).toContain('abc1234')
    expect(gap?.message).toContain('18 Tage')
    expect(gap?.detail).toContain('Schwelle 7 Tage')
  })

  it('unlesbarer und zukuenftiger Pruefstand sind Befunde', () => {
    expect(checkRepoVeraltet(folder({ repo: ['x'], repo_stand_am: 'neulich' }), ctx(7))?.message).toContain('kein Datum')
    expect(checkRepoVeraltet(folder({ repo: ['x'], repo_stand_am: '2026-12-01' }), ctx(7))?.message).toContain('Zukunft')
  })

  it('repo: als Einzelwert (kein Array) wird genauso gelesen', () => {
    const gap = checkRepoVeraltet(folder({ repo: 'CommonKnowledgeScout' }), ctx(7))
    expect(gap?.detail).toContain('CommonKnowledgeScout')
  })
})
