/**
 * @fileoverview Unit-Tests: Sitzungs-Sicht (S1/S1b) — Datensatz, Zuordnung zu Vorhaben
 * samt Querverweisen aus `vorhaben:`, Chronik SITZUNGEN.md und Bericht-Block.
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import { belegNameLesen, belegVorhaben, sitzungAusTransformation, type SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import { eintraegeFuerVorhaben, gruppiereNachVorhaben } from '@/lib/agent-view/sichten/sitzungen-gruppen'
import { SITZUNGEN_BLOCK_END, SITZUNGEN_BLOCK_START, renderSitzungen, sitzungenBlock, sitzungsZeile } from '@/lib/agent-view/sichten/sitzungen-render'
import { ordneSitzungenZu } from '@/lib/agent-view/sichten/sitzungen-sammeln'

const NOW = new Date('2026-11-08T10:00:00.000Z')

function folder(o: Partial<ArchiveFolderNode>): ArchiveFolderNode {
  return {
    folderId: 'f', name: 'x', path: 'x', parentFolderId: null, depth: 0, files: [], twinFolders: [],
    index: null, bericht: null, bearbeitungsstand: null, bearbeitungsstandSeit: null, ...o,
  } as ArchiveFolderNode
}
const bericht = (path: string) =>
  ({ fileId: `b-${path}`, name: 'BERICHT.md', path: `${path}/BERICHT.md`, modifiedAt: null, meta: {}, body: '# B' })

const B4 = '4. Ökosozialer Aktivismus'
const B6 = '6. bCommonsLab prototyping'
const FOLDERS = [
  folder({ folderId: 'root', name: '', path: '', depth: 0 }),
  folder({ folderId: 'b4', name: B4, path: B4, depth: 1, parentFolderId: 'root' }),
  folder({ folderId: 'b6', name: B6, path: B6, depth: 1, parentFolderId: 'root' }),
  folder({ folderId: 'v-bcoop', name: '24.03 bcoop', path: `${B4}/24.03 bcoop`, depth: 2, parentFolderId: 'b4', bericht: bericht(`${B4}/24.03 bcoop`) }),
  folder({ folderId: 'v-konf', name: '24.05 Konferenzen', path: `${B4}/24.05 Konferenzen`, depth: 2, parentFolderId: 'b4', bericht: bericht(`${B4}/24.05 Konferenzen`) }),
  folder({ folderId: 'v-klima', name: '26.01 Klima', path: `${B4}/26.01 Klima`, depth: 2, parentFolderId: 'b4', bericht: bericht(`${B4}/26.01 Klima`) }),
  folder({ folderId: 'v-ks', name: '24.09 KnowledgeScout', path: `${B6}/24.09 KnowledgeScout`, depth: 2, parentFolderId: 'b6', bericht: bericht(`${B6}/24.09 KnowledgeScout`) }),
  folder({ folderId: 'org', name: 'Organisation', path: 'Organisation', depth: 1, parentFolderId: 'root' }),
  folder({ folderId: 'org-s', name: 'Sitzungen', path: 'Organisation/Sitzungen', depth: 2, parentFolderId: 'org' }),
  folder({ folderId: 'alt', name: 'Altbestand claude.ai', path: 'Organisation/Sitzungen/Altbestand claude.ai', depth: 3, parentFolderId: 'org-s' }),
]

const zeile = (
  sourceName: string, parentId: string, frontmatter: Record<string, unknown> | null, beleg: Record<string, unknown> | null = null,
): TransformationZeile => ({
  sourceId: `id-${sourceName}`, sourceName, parentId, frontmatter, updatedAt: '2026-11-05T12:00:00.000Z',
  sourceFrontmatter: beleg ? { fields: beleg, sourceModifiedAt: null } : null,
})

const ZEILEN: TransformationZeile[] = [
  zeile('2026-10-29 Code BigHop-Wiki als Library-Prototyp.md', 'v-bcoop', { title: 'BigHop als Library', teaser: 'BigHop-Wiki als Library erfasst.', werkzeug: 'claude-code', sitzung: 'da8f', date: '2026-10-29' }),
  zeile('2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix.md', 'v-bcoop', { title: 'Projektheft', teaser: 'Projektheft aus dem Wiki.', werkzeug: 'claude-code', date: '2026-09-15' },
    { vorhaben: ['24.03 bcoop'], hauptvorhaben: '24.03 bcoop', ende: '2026-09-18' }),
  // Beleg in 24.05, nennt bcoop und ein unbekanntes Vorhaben als weitere → Querverweis + Hinweis
  zeile('2026-10-30 Chat Audiodateien erschließen.md', 'v-konf', { title: 'Audio', teaser: 'Zwei Audiodateien erschlossen.', werkzeug: 'claude-chat', date: '2026-10-30' },
    { vorhaben: '[24.05 Konferenzen, 24.03 bcoop, 26.10 Ideensalon]', hauptvorhaben: '24.05 Konferenzen', ende: '2026-10-30' }),
  zeile('2026-11-01 Chat Golden-Set fahren.md', 'v-klima', { title: 'Golden-Set', teaser: 'Golden-Set gefahren.', werkzeug: 'claude-chat', date: '2026-11-01' }),
  // Liegt in einem Ereignisordner unterhalb des Scans — die Eltern-Id kommt aus dem Storage.
  zeile('2026-11-07 Code Welle S1 planen.md', 'ereignis-tief', { title: 'S1 planen', teaser: 'Plan geschrieben.', werkzeug: 'claude-code', date: '2026-11-07' }),
  zeile('2025-03-22 Chat Habitat-Daten.md', 'alt', { title: 'Habitat', teaser: 'Altbestand.', werkzeug: 'claude-chat', date: '2025-03-22' }),
  zeile('Notiz ohne Datum.md', 'v-ks', { title: 'x', teaser: 'y' }),
  zeile('2026-11-02 Chat Verwaister Ordner.md', 'weg', { title: 'Verwaist', teaser: 'Ordner weg.', date: '2026-11-02' }),
]

async function elternVon(id: string): Promise<string | null> {
  if (id === 'ereignis-tief') return 'v-ks'
  throw new Error(`NOT_FOUND ${id}`)
}
const ORT = { vorhaben: { pfad: 'p', folderId: 'f' }, belegOrdnerPfad: 'p', weitereVorhaben: [] }

describe('SitzungsDatensatz (S1)', () => {
  it('liest Datum, Art-Wort und Titel aus dem Beleg-Namen; Fremdnamen → null', () => {
    expect(belegNameLesen('2026-10-29 Code BigHop-Wiki als Library-Prototyp.md')).toEqual({ datum: '2026-10-29', artWort: 'Code', titel: 'BigHop-Wiki als Library-Prototyp' })
    expect(belegNameLesen('2026-10-29 Notiz.md')).toBeNull()
    expect(belegNameLesen('Protokoll.pdf')).toBeNull()
  })

  it('Ende aus dem Beleg-Kopf nur bei mehrtaegiger Sitzung, Art-Wort ersatzweise aus werkzeug, ohne Datum Grund statt Datensatz', () => {
    const mitEnde = sitzungAusTransformation(ZEILEN[1], ORT)
    expect(mitEnde.ok && mitEnde.sitzung).toMatchObject({ datum: '2026-09-15', ende: '2026-09-18', artWort: 'Code', belegName: '2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix', vorhabenPfad: 'p' })
    const eintaegig = sitzungAusTransformation(ZEILEN[2], ORT)
    expect(eintaegig.ok && eintaegig.sitzung.ende).toBeNull()
    const ohneArt = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'claude-chat', date: '2026-10-01' }), ORT)
    expect(ohneArt.ok && ohneArt.sitzung).toMatchObject({ artWort: 'Chat', titel: '2026-10-01 Notiz', teaser: '' })
    const unbekannt = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'fremd' }), ORT)
    expect(unbekannt.ok && unbekannt.sitzung.artWort).toBeNull()
    expect(sitzungAusTransformation(ZEILEN[6], ORT)).toEqual({ ok: false, beleg: 'Notiz ohne Datum.md', grund: expect.stringContaining('kein Datum') })
  })

  it('belegVorhaben liest YAML-Liste wie Minimal-YAML-String', () => {
    expect(belegVorhaben({ vorhaben: ['a', 'b'], hauptvorhaben: 'a' })).toEqual({ vorhaben: ['a', 'b'], hauptvorhaben: 'a' })
    expect(belegVorhaben({ vorhaben: '[a, b c]' })).toEqual({ vorhaben: ['a', 'b c'], hauptvorhaben: null })
    expect(belegVorhaben(null)).toEqual({ vorhaben: [], hauptvorhaben: null })
  })

  it('gruppiert in Archiv-Ordnung (numerisch), „Ohne Vorhaben" zuletzt, je Gruppe chronologisch', () => {
    const s = (datum: string, vorhabenPfad: string | null): SitzungsDatensatz => ({
      datum, ende: null, titel: 't', artWort: 'Code', werkzeug: null, sitzungId: null, vorhabenPfad,
      vorhabenFolderId: vorhabenPfad, belegOrdnerPfad: vorhabenPfad, weitereVorhaben: [],
      belegName: `${datum} Code t`, teaser: '', transformationAktualisiert: null, sourceId: datum,
    })
    const gruppen = gruppiereNachVorhaben([s('2026-02-01', null), s('2026-03-01', '10. Zehn/x'), s('2026-01-01', '9. Neun/y'), s('2025-12-01', '10. Zehn/x')])
    expect(gruppen.map((g) => g.pfad)).toEqual(['9. Neun/y', '10. Zehn/x', null])
    expect(gruppen[1].eintraege.map((e) => e.sitzung.datum)).toEqual(['2025-12-01', '2026-03-01'])
  })
})

describe('ordneSitzungenZu', () => {
  it('findet das Vorhaben ueber den Scan, steigt fuer tiefe Ordner auf, loest vorhaben: auf, weist Unaufloesbares aus', async () => {
    const r = await ordneSitzungenZu({ zeilen: ZEILEN, folders: FOLDERS, vorhabenMuster: null, elternVon })
    expect(r.sitzungen).toHaveLength(7)
    expect(r.uebersprungen).toEqual([{ beleg: 'Notiz ohne Datum.md', grund: expect.stringContaining('kein Datum') }])
    expect(r.hinweise).toEqual([
      expect.stringContaining('2026-10-30 Chat Audiodateien erschließen.md: Vorhaben „26.10 Ideensalon" aus vorhaben: nicht im Scan'),
      expect.stringContaining('2026-11-02 Chat Verwaister Ordner.md: Ordner weg nicht aufloesbar (NOT_FOUND weg)'),
    ])
    const by = Object.fromEntries(r.sitzungen.map((s) => [s.belegName, s]))
    expect(by['2026-11-07 Code Welle S1 planen']).toMatchObject({ vorhabenPfad: `${B6}/24.09 KnowledgeScout`, vorhabenFolderId: 'v-ks', belegOrdnerPfad: null })
    expect(by['2025-03-22 Chat Habitat-Daten']).toMatchObject({ vorhabenPfad: null, belegOrdnerPfad: 'Organisation/Sitzungen/Altbestand claude.ai' })
    expect(by['2026-11-02 Chat Verwaister Ordner'].vorhabenPfad).toBeNull()
    expect(by['2026-10-30 Chat Audiodateien erschließen'].weitereVorhaben).toEqual([{ pfad: `${B4}/24.03 bcoop`, folderId: 'v-bcoop' }])
    // Das Ablage-Vorhaben selbst ist kein Querverweis
    expect(by['2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix'].weitereVorhaben).toEqual([])
  })

  it('meldet hauptvorhaben ≠ Ablage und mehrdeutige Namen, Vorhaben auch ohne Bericht ueber das Namensmuster', async () => {
    const doppelt = [
      ...FOLDERS,
      folder({ folderId: 'v-neu', name: '26.11 Neu', path: `${B4}/26.11 Neu`, depth: 2, parentFolderId: 'b4' }),
      folder({ folderId: 'v-neu2', name: '26.11 Neu', path: `${B6}/26.11 Neu`, depth: 2, parentFolderId: 'b6' }),
    ]
    const r = await ordneSitzungenZu({
      zeilen: [zeile('2026-11-03 Code Neu.md', 'v-neu', { date: '2026-11-03' }, { vorhaben: ['26.11 Neu', '24.03 bcoop'], hauptvorhaben: '24.03 bcoop' })],
      folders: doppelt, vorhabenMuster: /^\d{2}\.\d{2} /, elternVon,
    })
    expect(r.sitzungen[0].vorhabenPfad).toBe(`${B4}/26.11 Neu`)
    expect(r.sitzungen[0].weitereVorhaben).toEqual([{ pfad: `${B4}/24.03 bcoop`, folderId: 'v-bcoop' }])
    expect(r.hinweise).toEqual([expect.stringContaining('hauptvorhaben sagt „24.03 bcoop" — Ablage gilt')])
  })
})

describe('renderSitzungen + sitzungenBlock', () => {
  it('Frontmatter mit Zaehlern, Abschnitte in Archiv-Ordnung, Zeilenformat, Querverweis, „Ohne Vorhaben" zuletzt', async () => {
    const { sitzungen } = await ordneSitzungenZu({ zeilen: ZEILEN, folders: FOLDERS, vorhabenMuster: null, elternVon })
    const out = renderSitzungen(sitzungen, NOW)
    expect(out.startsWith('---\ntype: sicht\nsicht: sitzungen\ngenerated_by: knowledgescout/sichten\n')).toBe(true)
    expect(out).toContain('anzahl_sitzungen: 7\nanzahl_vorhaben: 4\nanzahl_querverweise: 1\n---')
    expect(out).toContain('Erzeugt am 08.11.2026')
    expect(out).toContain('1 Zeilen sind Querverweise aus Nebenvorhaben')
    const abschnitte = [...out.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    expect(abschnitte).toEqual([`${B4}/24.03 bcoop (3)`, `${B4}/24.05 Konferenzen (1)`, `${B4}/26.01 Klima (1)`, `${B6}/24.09 KnowledgeScout (1)`, 'Ohne Vorhaben (2)'])
    const bcoop = out.split(`## ${B4}/24.03 bcoop (3)`)[1].split('## ')[0]
    expect(bcoop.trim().split('\n')).toEqual([
      '- 2026-09-15 (bis 2026-09-18) · Code · [[2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix]] — Projektheft aus dem Wiki.',
      '- 2026-10-29 · Code · [[2026-10-29 Code BigHop-Wiki als Library-Prototyp]] — BigHop-Wiki als Library erfasst.',
      `- 2026-10-30 · Chat · [[2026-10-30 Chat Audiodateien erschließen]] — Zwei Audiodateien erschlossen. *(Beleg liegt in ${B4}/24.05 Konferenzen)*`,
    ])
    const konf = out.split(`## ${B4}/24.05 Konferenzen (1)`)[1].split('## ')[0]
    expect(konf).not.toContain('Beleg liegt in')
    expect(out).toContain('- 2026-11-02 · Chat · [[2026-11-02 Chat Verwaister Ordner]] — Ordner weg.')
    // Beleg ohne Konvention und ohne bekanntes werkzeug: sichtbares „?" statt stillem Weglassen
    const fremd = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'fremd' }), ORT)
    expect(fremd.ok && sitzungsZeile({ sitzung: fremd.sitzung, belegAnderswo: false })).toBe('- 2026-10-01 · ? · [[2026-10-01 Notiz]]')
  })

  it('leere Chronik sagt das; Block eines Vorhabens traegt Marker, Ueberschrift „(erzeugt)", Querverweis und sortierte Zeilen', async () => {
    expect(renderSitzungen([], NOW)).toContain('Keine Sitzungsnotizen gefunden.')
    const { sitzungen } = await ordneSitzungenZu({ zeilen: ZEILEN, folders: FOLDERS, vorhabenMuster: null, elternVon })
    const eintraege = eintraegeFuerVorhaben(sitzungen, 'v-bcoop')
    expect(eintraege.map((e) => `${e.sitzung.datum}:${e.belegAnderswo}`)).toEqual(['2026-09-15:false', '2026-10-29:false', '2026-10-30:true'])
    const block = sitzungenBlock([eintraege[2], eintraege[0]], '2026-11-08')
    expect(block.startsWith(`${SITZUNGEN_BLOCK_START}\n### Sitzungen mit Claude (erzeugt)\n\nStand 2026-11-08`)).toBe(true)
    expect(block.endsWith(SITZUNGEN_BLOCK_END)).toBe(true)
    expect(block.indexOf('2026-09-15')).toBeLessThan(block.indexOf('2026-10-30'))
    expect(block).toContain('*(Beleg liegt in 4. Ökosozialer Aktivismus/24.05 Konferenzen)*')
    expect(eintraegeFuerVorhaben(sitzungen, 'org')).toEqual([])
  })
})
