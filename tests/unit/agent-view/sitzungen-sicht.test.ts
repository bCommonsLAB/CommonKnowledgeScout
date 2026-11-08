/**
 * @fileoverview Unit-Tests: Sitzungs-Sicht (S1) — Datensatz, Zuordnung zu Vorhaben,
 * Chronik SITZUNGEN.md und Bericht-Block.
 */

import { describe, it, expect } from 'vitest'
import type { ArchiveFolderNode } from '@/lib/agent-view/archive-types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'
import {
  belegNameLesen, gruppiereNachVorhaben, sitzungAusTransformation, type SitzungsDatensatz,
} from '@/lib/agent-view/sichten/sitzungen-types'
import {
  SITZUNGEN_BLOCK_END, SITZUNGEN_BLOCK_START, renderSitzungen, sitzungenBlock, sitzungsZeile,
} from '@/lib/agent-view/sichten/sitzungen-render'
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
  folder({ folderId: 'v-klima', name: '26.01 Klima', path: `${B4}/26.01 Klima`, depth: 2, parentFolderId: 'b4', bericht: bericht(`${B4}/26.01 Klima`) }),
  folder({ folderId: 'v-ks', name: '24.09 KnowledgeScout', path: `${B6}/24.09 KnowledgeScout`, depth: 2, parentFolderId: 'b6', bericht: bericht(`${B6}/24.09 KnowledgeScout`) }),
  folder({ folderId: 'org', name: 'Organisation', path: 'Organisation', depth: 1, parentFolderId: 'root' }),
  folder({ folderId: 'org-s', name: 'Sitzungen', path: 'Organisation/Sitzungen', depth: 2, parentFolderId: 'org' }),
  folder({ folderId: 'alt', name: 'Altbestand claude.ai', path: 'Organisation/Sitzungen/Altbestand claude.ai', depth: 3, parentFolderId: 'org-s' }),
]

const zeile = (sourceName: string, parentId: string, frontmatter: Record<string, unknown> | null): TransformationZeile =>
  ({ sourceId: `id-${sourceName}`, sourceName, parentId, frontmatter, updatedAt: '2026-11-05T12:00:00.000Z' })

const ZEILEN: TransformationZeile[] = [
  zeile('2026-10-29 Code BigHop-Wiki als Library-Prototyp.md', 'v-bcoop', { title: 'BigHop als Library', teaser: 'BigHop-Wiki als Library erfasst.', werkzeug: 'claude-code', sitzung: 'da8f', date: '2026-10-29' }),
  zeile('2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix.md', 'v-bcoop', { title: 'Projektheft', teaser: 'Projektheft aus dem Wiki.', werkzeug: 'claude-code', date: '2026-09-15', ende: '2026-09-18' }),
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

describe('SitzungsDatensatz (S1)', () => {
  it('liest Datum, Art-Wort und Titel aus dem Beleg-Namen; Fremdnamen → null', () => {
    expect(belegNameLesen('2026-10-29 Code BigHop-Wiki als Library-Prototyp.md')).toEqual({ datum: '2026-10-29', artWort: 'Code', titel: 'BigHop-Wiki als Library-Prototyp' })
    expect(belegNameLesen('2026-10-29 Notiz.md')).toBeNull()
    expect(belegNameLesen('Protokoll.pdf')).toBeNull()
  })

  it('nimmt Ende nur bei mehrtaegiger Sitzung, Art-Wort ersatzweise aus werkzeug, ohne Datum Grund statt Datensatz', () => {
    const mitEnde = sitzungAusTransformation(ZEILEN[1], { pfad: 'p', folderId: 'f' })
    expect(mitEnde.ok && mitEnde.sitzung).toMatchObject({ datum: '2026-09-15', ende: '2026-09-18', artWort: 'Code', belegName: '2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix', vorhabenPfad: 'p' })
    const ohneArt = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'claude-chat', date: '2026-10-01' }), null)
    expect(ohneArt.ok && ohneArt.sitzung).toMatchObject({ artWort: 'Chat', titel: '2026-10-01 Notiz', teaser: '', vorhabenPfad: null })
    const unbekannt = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'fremd' }), null)
    expect(unbekannt.ok && unbekannt.sitzung.artWort).toBeNull()
    expect(sitzungAusTransformation(ZEILEN[5], null)).toEqual({ ok: false, beleg: 'Notiz ohne Datum.md', grund: expect.stringContaining('kein Datum') })
  })

  it('gruppiert in Archiv-Ordnung (numerisch), „Ohne Vorhaben" zuletzt, je Gruppe chronologisch', () => {
    const s = (datum: string, vorhabenPfad: string | null): SitzungsDatensatz => ({
      datum, ende: null, titel: 't', artWort: 'Code', werkzeug: null, sitzungId: null, vorhabenPfad, vorhabenFolderId: null,
      belegName: `${datum} Code t`, teaser: '', transformationAktualisiert: null, sourceId: datum,
    })
    const gruppen = gruppiereNachVorhaben([s('2026-02-01', null), s('2026-03-01', '10. Zehn/x'), s('2026-01-01', '9. Neun/y'), s('2025-12-01', '10. Zehn/x')])
    expect(gruppen.map((g) => g.pfad)).toEqual(['9. Neun/y', '10. Zehn/x', null])
    expect(gruppen[1].sitzungen.map((x) => x.datum)).toEqual(['2025-12-01', '2026-03-01'])
  })
})

describe('ordneSitzungenZu', () => {
  it('findet das Vorhaben ueber den Scan, steigt fuer tiefe Ordner ueber elternVon auf, weist Unaufloesbares aus', async () => {
    const r = await ordneSitzungenZu({ zeilen: ZEILEN, folders: FOLDERS, vorhabenMuster: null, elternVon })
    expect(r.sitzungen).toHaveLength(6)
    expect(r.uebersprungen).toEqual([{ beleg: 'Notiz ohne Datum.md', grund: expect.stringContaining('kein Datum') }])
    expect(r.hinweise).toEqual([expect.stringContaining('2026-11-02 Chat Verwaister Ordner.md: Ordner weg nicht aufloesbar (NOT_FOUND weg)')])
    const pfade = Object.fromEntries(r.sitzungen.map((s) => [s.belegName, s.vorhabenPfad]))
    expect(pfade['2026-11-07 Code Welle S1 planen']).toBe(`${B6}/24.09 KnowledgeScout`)
    expect(pfade['2025-03-22 Chat Habitat-Daten']).toBeNull()
    expect(pfade['2026-11-02 Chat Verwaister Ordner']).toBeNull()
    expect(r.sitzungen.find((s) => s.belegName.startsWith('2026-11-07'))?.vorhabenFolderId).toBe('v-ks')
  })

  it('erkennt Vorhaben auch ohne Bericht ueber das Namensmuster', async () => {
    const ohneBericht = [...FOLDERS, folder({ folderId: 'v-neu', name: '26.11 Neu', path: `${B4}/26.11 Neu`, depth: 2, parentFolderId: 'b4' })]
    const r = await ordneSitzungenZu({
      zeilen: [zeile('2026-11-03 Code Neu.md', 'v-neu', { date: '2026-11-03' })], folders: ohneBericht,
      vorhabenMuster: /^\d{2}\.\d{2} /, elternVon,
    })
    expect(r.sitzungen[0].vorhabenPfad).toBe(`${B4}/26.11 Neu`)
  })
})

describe('renderSitzungen + sitzungenBlock', () => {
  it('Frontmatter mit Zaehlern, Abschnitte in Archiv-Ordnung, Zeilenformat, „Ohne Vorhaben" zuletzt', async () => {
    const { sitzungen } = await ordneSitzungenZu({ zeilen: ZEILEN, folders: FOLDERS, vorhabenMuster: null, elternVon })
    const out = renderSitzungen(sitzungen, NOW)
    expect(out.startsWith('---\ntype: sicht\nsicht: sitzungen\ngenerated_by: knowledgescout/sichten\n')).toBe(true)
    expect(out).toContain('anzahl_sitzungen: 6\nanzahl_vorhaben: 3\n---')
    expect(out).toContain('Erzeugt am 08.11.2026')
    const abschnitte = [...out.matchAll(/^## (.+)$/gm)].map((m) => m[1])
    expect(abschnitte).toEqual([`${B4}/24.03 bcoop (2)`, `${B4}/26.01 Klima (1)`, `${B6}/24.09 KnowledgeScout (1)`, 'Ohne Vorhaben (2)'])
    const bcoop = out.split(`## ${B4}/24.03 bcoop (2)`)[1].split('## ')[0]
    expect(bcoop.trim().split('\n')).toEqual([
      '- 2026-09-15 (bis 2026-09-18) · Code · [[2026-09-15 Code Projektheft-Wiki, bcoop-Logo und QR-Fix]] — Projektheft aus dem Wiki.',
      '- 2026-10-29 · Code · [[2026-10-29 Code BigHop-Wiki als Library-Prototyp]] — BigHop-Wiki als Library erfasst.',
    ])
    expect(out).toContain('- 2026-11-02 · Chat · [[2026-11-02 Chat Verwaister Ordner]] — Ordner weg.')
    // Beleg ohne Konvention und ohne bekanntes werkzeug: sichtbares „?" statt stillem Weglassen
    const fremd = sitzungAusTransformation(zeile('2026-10-01 Notiz.md', 'v', { werkzeug: 'fremd' }), null)
    expect(fremd.ok && sitzungsZeile(fremd.sitzung)).toBe('- 2026-10-01 · ? · [[2026-10-01 Notiz]]')
  })

  it('leere Chronik sagt das; Block traegt Marker, Ueberschrift „(erzeugt)" und sortierte Zeilen', () => {
    expect(renderSitzungen([], NOW)).toContain('Keine Sitzungsnotizen gefunden.')
    const a = sitzungAusTransformation(ZEILEN[0], { pfad: 'p', folderId: 'f' })
    const b = sitzungAusTransformation(ZEILEN[1], { pfad: 'p', folderId: 'f' })
    if (!a.ok || !b.ok) throw new Error('Fixture')
    const block = sitzungenBlock([a.sitzung, b.sitzung], '2026-11-08')
    expect(block.startsWith(`${SITZUNGEN_BLOCK_START}\n### Sitzungen mit Claude (erzeugt)\n\nStand 2026-11-08`)).toBe(true)
    expect(block.endsWith(SITZUNGEN_BLOCK_END)).toBe(true)
    expect(block.indexOf(sitzungsZeile(b.sitzung))).toBeLessThan(block.indexOf(sitzungsZeile(a.sitzung)))
  })
})
