/**
 * @fileoverview Unit-Tests: Notizen und Verlaufsdateien (Wunschliste 6, B3 + Teil C).
 *
 * Begleitdokumente waehlen, `bericht_unvollstaendig` folgt den Verweisen,
 * Pflichtfelder von `notiz`/`verlauf`, `verlauf_fehlt`,
 * `entwicklung_unberichtet`, `repo_stand_commit`.
 */

import { describe, expect, it } from 'vitest'
import type { ArchiveDocEntry, ArchiveFileEntry, ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import { MAX_BEGLEITDATEIEN_JE_BERICHT, ordneBegleitdokumente, waehleBegleitdateien } from '@/lib/agent-view/begleitdokumente'
import { auditReferences, buildReferenceIndex, type InventoryTarget } from '@/lib/agent-view/reference-audit'
import { checkRepoVeraltet } from '@/lib/agent-view/repo-regel'
import { checkBegleitKern, checkEntwicklungUnberichtet, checkVerlaufFehlt, leseVerlaufEintraege } from '@/lib/agent-view/verlauf-regel'

const FRUEH = '2026-09-10T08:00:00.000Z'
const SPAET = '2026-09-18T08:00:00.000Z'

function datei(path: string, modifiedAt = FRUEH): ArchiveFileEntry {
  return { fileId: `id:${path}`, name: path.split('/').pop() as string, path, modifiedAt, sizeBytes: 100 }
}

function doc(path: string, meta: Record<string, unknown>, body: string, modifiedAt = FRUEH): ArchiveDocEntry {
  return { ...datei(path, modifiedAt), meta, body }
}

function ordner(path: string, args: { bericht?: ArchiveDocEntry | null; files?: ArchiveFileEntry[] }): ArchiveFolderNode {
  return {
    folderId: `f:${path}`, name: path.split('/').pop() as string, path, parentFolderId: 'f-root', depth: path.split('/').length,
    files: args.files ?? [], twinFolders: [], index: null, bericht: args.bericht ?? null,
    bearbeitungsstand: 'berichtet', bearbeitungsstandSeit: null,
  }
}

function indexAus(folders: readonly ArchiveFolderNode[]) {
  const targets: InventoryTarget[] = folders.flatMap((folder) =>
    folder.files.map((file) => ({ path: file.path, name: file.name, modifiedAt: file.modifiedAt, kind: 'file' as const })),
  )
  return buildReferenceIndex(targets)
}

describe('waehleBegleitdateien', () => {
  const bericht = doc('A/26.05 Forum/BERICHT.md', {}, 'Siehe [[Korrespondenz]], [[2026-08-19 Notiz]], [[Bild.png]], [[Fremd]] und [[_INDEX]].')
  const folders = [
    ordner('A/26.05 Forum', { bericht, files: [datei('A/26.05 Forum/BERICHT.md'), datei('A/26.05 Forum/Korrespondenz.md'), datei('A/26.05 Forum/Bild.png'), datei('A/26.05 Forum/_INDEX.md')] }),
    ordner('A/26.05 Forum/2026-08-19 Treffen', { files: [datei('A/26.05 Forum/2026-08-19 Treffen/2026-08-19 Notiz.md')] }),
    ordner('B/24.09 Plattform', { files: [datei('B/24.09 Plattform/Fremd.md')] }),
  ]

  it('nimmt nur verlinkte Markdown-Dateien im EIGENEN Vorhaben — nicht Bericht, Index, Bilder, Fremdes', () => {
    const auswahl = waehleBegleitdateien({ folders, index: indexAus(folders) })
    expect(auswahl.jeOrdner.get('f:A/26.05 Forum')?.map((f) => f.name)).toEqual(['2026-08-19 Notiz.md', 'Korrespondenz.md'])
    expect(auswahl.gekappt.size).toBe(0)
  })

  it('kappt am Zaun und weist es aus', () => {
    const viele = Array.from({ length: MAX_BEGLEITDATEIEN_JE_BERICHT + 1 }, (_, i) => datei(`V/N${String(i).padStart(2, '0')}.md`))
    const langer = doc('V/BERICHT.md', {}, viele.map((f) => `[[${f.name}]]`).join(' '))
    const vf = [ordner('V', { bericht: langer, files: viele })]
    const auswahl = waehleBegleitdateien({ folders: vf, index: indexAus(vf) })
    expect(auswahl.jeOrdner.get('f:V')).toHaveLength(MAX_BEGLEITDATEIEN_JE_BERICHT)
    expect(auswahl.gekappt.has('f:V')).toBe(true)
  })

  it('ordnet gelesene Dokumente ihren Berichten zu; Ungelesenes fehlt einfach', () => {
    const auswahl = waehleBegleitdateien({ folders, index: indexAus(folders) })
    const gelesen = [doc('A/26.05 Forum/Korrespondenz.md', { type: 'verlauf' }, '')]
    expect(ordneBegleitdokumente(auswahl, gelesen).get('f:A/26.05 Forum')?.map((d) => d.name)).toEqual(['Korrespondenz.md'])
  })
})

describe('bericht_unvollstaendig folgt den Verweisen (B3)', () => {
  const bericht = doc('V/BERICHT.md', {}, 'Details: [[Notiz]]. Direkt genannt: Protokoll.pdf')
  const notiz = doc('V/E/Notiz.md', { type: 'notiz' }, 'Grundlage war Angebot.pdf.', SPAET)
  const quellen = [{ name: 'Protokoll.pdf', path: 'V/Protokoll.pdf' }, { name: 'Angebot.pdf', path: 'V/E/Angebot.pdf' }, { name: 'Vergessen.pdf', path: 'V/Vergessen.pdf' }]
  const index = buildReferenceIndex([{ path: 'V/E/Notiz.md', name: 'Notiz.md', modifiedAt: SPAET, kind: 'file' }])

  it('ohne Begleitdokumente fehlt auch, was nur die Notiz nennt', () => {
    const gap = auditReferences({ doc: bericht, folderId: 'f', index, expectedSources: quellen }).find((g) => g.type === 'bericht_unvollstaendig')
    expect(gap?.message).toContain('2 ausgewertete')
  })

  it('mit Begleitdokument zaehlt die Nennung dort — und der Befund sagt, ueber welche Datei', () => {
    const gap = auditReferences({ doc: bericht, folderId: 'f', index, expectedSources: quellen, linkedDocs: [notiz] }).find((g) => g.type === 'bericht_unvollstaendig')
    expect(gap?.message).toContain('1 ausgewertete')
    expect(gap?.detail).toContain('Vergessen.pdf')
    expect(gap?.detail).toContain('Angebot.pdf (in Notiz.md)')
  })

  it('C1: eine Notiz, die juenger ist als der Bericht, macht den Verweis pruefwuerdig', () => {
    const gaps = auditReferences({ doc: bericht, folderId: 'f', index })
    expect(gaps.map((g) => g.type)).toContain('verweis_veraltet')
  })
})

describe('Pflichtfelder von notiz/verlauf (C1)', () => {
  const folder = ordner('V', { bericht: doc('V/BERICHT.md', {}, '') })
  it('meldet fehlende generated_by/generated_at bei Cowork; andere Typen bleiben unbehelligt', () => {
    const gaps = checkBegleitKern(folder, [
      doc('V/Notiz.md', { type: 'notiz', generated_by: 'claude/cowork' }, ''),
      doc('V/Korrespondenz.md', { type: 'verlauf', generated_by: 'claude/cowork', generated_at: '2026-09-18' }, ''),
      doc('V/Konzept.md', { type: 'konzept' }, ''),
    ])
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ type: 'twin_core_missing', actor: 'cowork', targetName: 'Notiz.md', detail: 'generated_at' })
  })
})

describe('verlauf_fehlt (C2)', () => {
  const mitPostfach = ordner('V', { bericht: doc('V/BERICHT.md', { postfach_bis: '2026-KW38' }, '') })
  it('feuert nur mit postfach_bis und ohne verlinkte Verlaufsdatei', () => {
    expect(checkVerlaufFehlt(mitPostfach, [doc('V/N.md', { type: 'notiz' }, '')])).toMatchObject({ type: 'verlauf_fehlt', severity: 'info', actor: 'cowork' })
    expect(checkVerlaufFehlt(mitPostfach, [doc('V/Korrespondenz.md', { type: 'verlauf' }, '')])).toBeNull()
    expect(checkVerlaufFehlt(ordner('V', { bericht: doc('V/BERICHT.md', {}, '') }), [])).toBeNull()
  })
})

const ENTWICKLUNG = [
  '# Entwicklung', '',
  '## 2026-09-18 — Abstimmungs-Modul Variante A {#2026-09-18-abstimmung}', '',
  '- **Commits:** `a1b2c3d..e4f5a6b` (14)',
  '- **Vorhaben:** [[26.05 Forum]], [[24.09 Plattform]]',
  '- **Was entstanden ist:** …', '',
  '## 2026-09-05 — Galerie im Paket', '',
  '- **Vorhaben:** [[24.09 Plattform|Plattform]]', '',
  '## Ohne Datum', '- **Vorhaben:** [[26.05 Forum]]',
].join('\n')

describe('leseVerlaufEintraege', () => {
  it('liest Datum, Titel, Anker und die Vorhaben der Vorhaben-Zeile', () => {
    expect(leseVerlaufEintraege(ENTWICKLUNG)).toEqual([
      { datum: '2026-09-18', titel: '2026-09-18 — Abstimmungs-Modul Variante A', anker: '2026-09-18-abstimmung', vorhaben: ['26.05 Forum', '24.09 Plattform'] },
      { datum: '2026-09-05', titel: '2026-09-05 — Galerie im Paket', anker: null, vorhaben: ['24.09 Plattform'] },
    ])
  })
})

describe('entwicklung_unberichtet (C3)', () => {
  const verlauf = doc('B/24.09 Plattform/Entwicklung.md', { type: 'verlauf' }, ENTWICKLUNG, SPAET)
  const plattform = ordner('B/24.09 Plattform', { bericht: doc('B/24.09 Plattform/BERICHT.md', {}, '[[Entwicklung]]', '2026-09-20T00:00:00.000Z') })
  const begleit = (forum: ArchiveFolderNode) => new Map([[plattform.folderId, [verlauf]], [forum.folderId, []]])

  it('meldet am Anwendungsvorhaben, dessen Bericht aelter ist und nicht verweist', () => {
    const forum = ordner('A/26.05 Forum', { bericht: doc('A/26.05 Forum/BERICHT.md', {}, 'nichts dazu', FRUEH) })
    const gaps = checkEntwicklungUnberichtet({ folders: [forum, plattform], begleit: begleit(forum) })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({ type: 'entwicklung_unberichtet', folderId: forum.folderId, actor: 'cowork', severity: 'info' })
    expect(gaps[0].detail).toContain('#2026-09-18-abstimmung')
    expect(gaps[0].detail).toContain('B/24.09 Plattform/Entwicklung.md')
  })

  it('schweigt, wenn der Bericht auf das Sprungziel verweist oder juenger ist als der Eintrag', () => {
    const verweist = ordner('A/26.05 Forum', { bericht: doc('A/26.05 Forum/BERICHT.md', {}, '[[Entwicklung#2026-09-18-abstimmung]]', FRUEH) })
    expect(checkEntwicklungUnberichtet({ folders: [verweist, plattform], begleit: begleit(verweist) })).toEqual([])
    const juenger = ordner('A/26.05 Forum', { bericht: doc('A/26.05 Forum/BERICHT.md', {}, '', '2026-09-19T00:00:00.000Z') })
    expect(checkEntwicklungUnberichtet({ folders: [juenger, plattform], begleit: begleit(juenger) })).toEqual([])
  })

  it('ohne gelesene Verlaufsdatei gibt es nichts zu melden', () => {
    const forum = ordner('A/26.05 Forum', { bericht: doc('A/26.05 Forum/BERICHT.md', {}, '', FRUEH) })
    expect(checkEntwicklungUnberichtet({ folders: [forum], begleit: new Map() })).toEqual([])
  })
})

describe('repo_stand_commit (C3)', () => {
  const ctx = {
    conventions: {
      vorhabenFolderPattern: null, indexRequiredMaxDepth: null, berichtFreshness: true, postfachMaxRueckstandWochen: null,
      repoMaxRueckstandTage: 7, berichtMaxBytes: { anwendung: null, plattform: null }, statusMaxZeilen: null, ueberholtNachTagen: null,
    },
    vorhabenPattern: null, newestChangeInSubtree: null, isLibraryRoot: false, now: '2026-09-19T10:00:00.000Z',
  }
  it('der neue Feldname fuehrt, der alte bleibt lesbar', () => {
    const neu = ordner('V', { bericht: doc('V/BERICHT.md', { repo: ['x'], repo_stand_am: '2026-09-01', repo_stand_commit: 'abc1234', repo_stand: 'alt0000' }, '') })
    expect(checkRepoVeraltet(neu, ctx)?.message).toContain('abc1234')
    const alt = ordner('V', { bericht: doc('V/BERICHT.md', { repo: ['x'], repo_stand_am: '2026-09-01', repo_stand: 'alt0000' }, '') })
    expect(checkRepoVeraltet(alt, ctx)?.message).toContain('alt0000')
  })
})

describe('Prueflauf 18.09.2026 — Verweise nach aussen im Teilbaum-Scan', () => {
  const index = buildReferenceIndex([{ path: 'Korrespondenz.md', name: 'Korrespondenz.md', modifiedAt: FRUEH, kind: 'file' }])
  const bericht = (body: string) => doc('BERICHT.md', {}, body)
  const tot = (body: string, teilbaum?: { scopePath: string | null }) =>
    auditReferences({ doc: bericht(body), folderId: 'f', index, teilbaum }).filter((g) => g.type === 'verweis_tot').length

  it('im Voll-Scan bleibt ein unaufloesbarer Verweis tot', () => {
    expect(tot('[[Entwicklung#2026-09-12-anker]]')).toBe(1)
  })

  it('im Teilbaum ist ein blosser Name oder ein Pfad nach aussen nicht beurteilbar', () => {
    const teilbaum = { scopePath: 'A/26.05 Forum' }
    expect(tot('[[Entwicklung#2026-09-12-anker]]', teilbaum)).toBe(0)
    expect(tot('[[B/24.09 Plattform/Entwicklung#x|Entwicklung]]', teilbaum)).toBe(0)
    expect(tot('[Plan](../24.09%20Plattform/Plan.md)', teilbaum)).toBe(0)
  })

  it('was IM Teilbaum liegen muesste, bleibt beweisbar tot — und ein Pfad mit Scope-Praefix wird aufgeloest', () => {
    const teilbaum = { scopePath: 'A/26.05 Forum' }
    expect(tot('[Notiz](Ereignis/Fehlt.md)', teilbaum)).toBe(1)
    expect(tot('[[A/26.05 Forum/Fehlt]]', teilbaum)).toBe(1)
    expect(tot('[[A/26.05 Forum/Korrespondenz]]', teilbaum)).toBe(0)
  })

  it('Pfadform ohne .md loest im Voll-Scan auf', () => {
    const voll = buildReferenceIndex([{ path: 'B/24.09 Plattform/Entwicklung.md', name: 'Entwicklung.md', modifiedAt: FRUEH, kind: 'file' }])
    const gaps = auditReferences({ doc: bericht('[[B/24.09 Plattform/Entwicklung#anker|Entwicklung]]'), folderId: 'f', index: voll })
    expect(gaps.filter((g) => g.type === 'verweis_tot')).toEqual([])
  })
})
