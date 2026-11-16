/**
 * @fileoverview Unit-Tests: `sitzung_eintragen` (R4b) mit Anschluessen im Speicher — kein Provider, kein Mongo.
 */

import { describe, it, expect, vi } from 'vitest'
import { eintraegeFuerVorhaben } from '@/lib/agent-view/sichten/sitzungen-gruppen'
import { renderSitzungen, sitzungenBlock } from '@/lib/agent-view/sichten/sitzungen-render'
import type { SitzungsDatensatz } from '@/lib/agent-view/sichten/sitzungen-types'
import { trageSitzungEin } from '@/lib/agent-view/sitzungen-register/eintragen/eintragen-dienst'
import type { EintragOrdner, EintragPorts } from '@/lib/agent-view/sitzungen-register/eintragen/eintragen-typen'
import type { SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'
import type { TransformationZeile } from '@/lib/repositories/shadow-twin-transformationen'

const NOW = new Date('2026-11-16T09:00:00.000Z')
const K1 = 'session_01TESTKENNUNGERFUNDEN0001'
const KS = '6. bCommonsLab prototyping/24.09 KnowledgeScout'
const AR = '10. Archiv/26.08 Archiv'
const NAME = '2026-11-16 Chat Abschluss beschleunigt.md'

const ALT: SitzungsDatensatz = {
  datum: '2026-11-10', ende: null, titel: 'Archiv aufraeumen', artWort: 'Chat', werkzeug: null, sitzungId: null,
  vorhabenPfad: AR, vorhabenFolderId: 'v-ar', belegOrdnerPfad: AR, weitereVorhaben: [{ pfad: KS, folderId: 'v-ks' }],
  belegName: '2026-11-10 Chat Archiv aufraeumen', teaser: 'Aufgeraeumt.', transformationAktualisiert: null, sourceId: 's-alt',
}

function doc(o: Partial<SitzungsRegisterDoc> = {}): SitzungsRegisterDoc {
  return {
    libraryId: 'lib', registerId: K1, sitzungId: K1, kennung: 'voll', quelle: 'cowork', titelOriginal: null, beginn: null, ende: null,
    link: null, repo: null, branch: null, prs: [], nrAlt: null, entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [],
    vorhabenVorschlag: null, bemerkung: null, belegSourceIds: ['s-1'], altNotizPfad: null, ablage: null,
    berichtet: { chronikAm: null, blockAm: null }, gemeldetVon: 'skill', gemeldetAm: '2026-11-16', geaendertAm: '2026-11-16', ...o,
  }
}

const notiz: TransformationZeile = {
  sourceId: 's-1', sourceName: NAME, parentId: 'v-ks', updatedAt: '2026-11-16T00:13:00.000Z', sourceFrontmatter: null,
  frontmatter: { title: 'Abschluss beschleunigt', teaser: 'Zwei Vollscans durch eine Zeile ersetzt.', sitzung: K1 },
}

const bericht = (folderId: string, mitBlock = true) =>
  `# Bericht\n\n${mitBlock ? sitzungenBlock(eintraegeFuerVorhaben([ALT], folderId), '2026-11-10') : ''}\n\n## Naechste Schritte\n`

function aufbau(o: { vorhaben?: string[]; dateien?: Record<string, string>; notizen?: TransformationZeile[]; register?: SitzungsRegisterDoc | null } = {}) {
  const ordner: Record<string, EintragOrdner> = {
    'v-ks': { id: 'v-ks', pfad: KS, name: '24.09 KnowledgeScout' },
    'v-ar': { id: 'v-ar', pfad: AR, name: '26.08 Archiv' },
  }
  const dateien: Record<string, string> = {
    'b-ks': bericht('v-ks'), 'b-ar': bericht('v-ar'), chronik: renderSitzungen([ALT], NOW), ...o.dateien,
  }
  const ersetzen = vi.fn(async (id: string, text: string, version: string | null) => {
    if (version !== `v-${id}`) throw new Error(`Version ${version} gilt nicht mehr`)
    dateien[id] = text
  })
  const nachLauf = vi.fn<EintragPorts['register']['nachLauf']>(async () => ({
    angelegt: 0, aktualisiert: 1, fehler: [], geplant: { neu: 0, aenderungen: 1 }, hinweise: [],
  }))
  const ports: EintragPorts = {
    register: { holeNachKennung: async () => (o.register === undefined ? doc() : o.register), nachLauf },
    notizen: async () => o.notizen ?? [notiz],
    belegKopf: async () => ({ fields: { session_id: K1, vorhaben: o.vorhaben ?? [KS, AR] }, modifiedAt: null }),
    ordner: {
      nachId: async (id) => ordner[id],
      nachPfad: async (pfad) => Object.values(ordner).find((x) => x.pfad === pfad) ?? null,
      bericht: async (id) => (id === 'v-ks' ? 'b-ks' : id === 'v-ar' ? 'b-ar' : null),
    },
    chronik: async () => 'chronik',
    datei: { lesen: async (id) => ({ text: dateien[id], version: `v-${id}` }), ersetzen },
    jetzt: () => NOW,
  }
  return { ports, dateien, ersetzen, nachLauf }
}

describe('trageSitzungEin', () => {
  it('Block im Ablage-Vorhaben, Querverweis im Nebenvorhaben, Chronik, Register-Stempel — ohne Scan', async () => {
    const { ports, dateien, ersetzen, nachLauf } = aufbau()
    const r = await trageSitzungEin(K1, ports)
    expect(r.berichte).toEqual([
      { pfad: KS, status: 'geschrieben', querverweis: false },
      { pfad: AR, status: 'geschrieben', querverweis: true },
    ])
    expect(r).toMatchObject({ chronik: 'geschrieben', offen: [], folgeaufrufe: [], belege: [{ beleg: NAME.replace(/\.md$/, ''), vorhaben: KS, querverweise: [AR] }] })
    expect(dateien['b-ks']).toContain('[[2026-11-16 Chat Abschluss beschleunigt]] — Zwei Vollscans durch eine Zeile ersetzt.')
    // Der alte Querverweis im Block 24.09 bleibt (Befund 16.11.: genau der ging verloren).
    expect(dateien['b-ks']).toContain(`[[2026-11-10 Chat Archiv aufraeumen]] — Aufgeraeumt. *(Beleg liegt in ${AR})*`)
    expect(dateien['b-ar']).toContain(`[[2026-11-16 Chat Abschluss beschleunigt]] — Zwei Vollscans durch eine Zeile ersetzt. *(Beleg liegt in ${KS})*`)
    expect(dateien.chronik).toContain('anzahl_sitzungen: 2\nanzahl_vorhaben: 2\nanzahl_querverweise: 2\n')
    expect(ersetzen).toHaveBeenCalledTimes(3)
    expect(nachLauf.mock.calls.map((c) => [c[0].art, [...c[0].berichtet]])).toEqual([['block', ['s-1']], ['chronik', ['s-1']]])
  })

  it('zweiter Aufruf: alles unveraendert, nichts geschrieben', async () => {
    const a = aufbau()
    await trageSitzungEin(K1, a.ports)
    a.ersetzen.mockClear()
    const r = await trageSitzungEin(K1, a.ports)
    expect(r.berichte.map((b) => b.status)).toEqual(['unveraendert', 'unveraendert'])
    expect(r.chronik).toBe('unveraendert')
    expect(a.ersetzen).not.toHaveBeenCalled()
  })

  it('Bericht ohne erzeugten Block und Nebenvorhaben nur als Name: offen, volle Laeufe als Folgeaufrufe, kein Block-Stempel', async () => {
    const { ports, nachLauf } = aufbau({ vorhaben: [KS, '26.08 Archiv'], dateien: { 'b-ks': bericht('v-ks', false) } })
    const r = await trageSitzungEin(K1, ports)
    expect(r.berichte).toEqual([{ pfad: KS, status: 'kein_block', querverweis: false }])
    expect(r.offen).toHaveLength(2)
    expect(r.offen.join('\n')).toMatch(/nur als Name/)
    expect(r.offen.join('\n')).toMatch(/keinen erzeugten Block/)
    expect(r.folgeaufrufe.map((f) => f.werkzeug)).toEqual(['sitzungen_block_schreiben', 'sichten_regenerieren'])
    expect(r.chronik).toBe('geschrieben')
    expect([...nachLauf.mock.calls[0][0].berichtet]).toEqual([])
  })

  it('Schreibkonflikt am Bericht: Status fehler, Rest laeuft weiter, Aufruf ist wiederholbar', async () => {
    const a = aufbau()
    a.ports.datei.lesen = async (id) => ({ text: a.dateien[id], version: id === 'b-ar' ? 'veraltet' : `v-${id}` })
    const r = await trageSitzungEin(K1, a.ports)
    expect(r.berichte.map((b) => b.status)).toEqual(['geschrieben', 'fehler'])
    expect(r.offen.join('\n')).toMatch(/erneut aufrufen/)
    expect(r.chronik).toBe('geschrieben')
  })

  it('benannte Fehler: nicht im Register, ohne Beleg, Notiz fehlt (Job noch nicht fertig)', async () => {
    await expect(trageSitzungEin(K1, aufbau({ register: null }).ports)).rejects.toThrow(/^nicht_im_register:/)
    await expect(trageSitzungEin(K1, aufbau({ register: doc({ belegSourceIds: [] }) }).ports)).rejects.toThrow(/^ohne_beleg:/)
    await expect(trageSitzungEin(K1, aufbau({ notizen: [] }).ports)).rejects.toThrow(/^notiz_fehlt: .*job_status/)
  })
})
