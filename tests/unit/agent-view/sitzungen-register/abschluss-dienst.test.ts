/**
 * @fileoverview Unit-Tests R4: Ablauf von sitzung_abschliessen mit Anschluessen aus dem Speicher (ohne Provider, ohne Mongo).
 *
 * Abnahme-Fall des Plans im Kleinen: ein Beleg ueber 300 kB ueber den
 * Dateiverweis — Bytes und SHA-256 stimmen, nichts wird neu geschrieben.
 */

import { createHash } from 'crypto'
import { describe, it, expect, vi } from 'vitest'
import { schliesseSitzungAb, type AbschlussPorts } from '@/lib/agent-view/sitzungen-register/abschluss/abschluss-dienst'
import { leseAbschlussEingabe, type AbschlussRoh } from '@/lib/agent-view/sitzungen-register/abschluss/eingabe-lesen'
import type { SitzungsRegisterDoc } from '@/lib/agent-view/sitzungen-register/types'
import { K1, K2, LIB, doc } from './fixtures'

const VORHABEN = '6. Lab/24.09 KnowledgeScout'
const NAME = '2026-11-15 Chat Register gebaut.md'
const beleg = (kennung = K1, rumpf = 'Zug 1') =>
  `---\ntype: chatverlauf\nwerkzeug: cowork\nsession_id: ${kennung}\ntitel: Register gebaut\nzuege_von_bis: 1-3\nvorhaben: [24.09 KnowledgeScout]\nhauptvorhaben: 24.09 KnowledgeScout\n---\n\n${rumpf}\n`

function aufbau(dateien: Record<string, { parentId: string; name: string; text: string; version?: string }>, zeilen: SitzungsRegisterDoc[] = []) {
  const register = new Map(zeilen.map((z) => [z.registerId, z]))
  const schreiben = vi.fn()
  const gemeldet: unknown[] = []
  const ports: AbschlussPorts = {
    speicher: {
      ordner: async (ref) => {
        if ('pfad' in ref && ref.pfad === VORHABEN) return { id: 'v-ks', name: '24.09 KnowledgeScout', pfad: VORHABEN }
        if ('pfad' in ref && ref.pfad === 'Organisation/Sitzungen') return { id: 'v-org', name: 'Sitzungen', pfad: 'Organisation/Sitzungen' }
        throw new Error(`vorhaben_nicht_gefunden: ${JSON.stringify(ref)}`)
      },
      datei: async (ref) => {
        const id = 'sourceId' in ref ? ref.sourceId : Object.keys(dateien).find((k) => `${VORHABEN}/${dateien[k].name}` === ref.pfad)
        const d = id === undefined ? undefined : dateien[id]
        return d === undefined || id === undefined ? null : { id, parentId: d.parentId, name: d.name }
      },
      dateiImOrdner: async (ordnerId, name) => {
        const id = Object.keys(dateien).find((k) => dateien[k].parentId === ordnerId && dateien[k].name === name)
        return id === undefined ? null : { id, version: dateien[id].version ?? null }
      },
      lesen: async (id) => dateien[id].text,
      anlegen: async (ordnerId, name, text) => { schreiben('anlegen', name); dateien['neu-1'] = { parentId: ordnerId, name, text }; return { id: 'neu-1' } },
      ersetzen: async (id, text, version) => { schreiben('ersetzen', id, version); dateien[id].text = text; return { id } },
    },
    register: {
      holeNachKennung: async (k) => [...register.values()].find((z) => z.sitzungId === k) ?? null,
      holeZeile: async (rid) => register.get(rid) ?? null,
      umschluesseln: async (rid, k) => { const z = register.get(rid); if (z) { register.delete(rid); register.set(k, { ...z, registerId: k, sitzungId: k }) } return { zusammengefuehrt: null } },
      melden: async (e) => { gemeldet.push(e); return register.has(e.sitzungId) ? 'ergaenzt' : 'angelegt' },
      belegAnhaengen: async () => true,
      stand: vi.fn(async () => 'berichtet' as const),
    },
    transformation: vi.fn(async () => ({ jobId: 'job-1', erzwungen: 'nicht_noetig' })),
  }
  return { ports, schreiben, gemeldet, register }
}

const roh = (o: Partial<AbschlussRoh>): AbschlussRoh => ({ libraryId: LIB, sitzungId: K1, quelle: 'cowork', vorhabenPfad: VORHABEN, ...o })

describe('schliesseSitzungAb', () => {
  it('Abnahme: Beleg ueber 300 kB per Dateiverweis — Bytes, SHA-256, kein Schreiben, Job und Folgeaufrufe', async () => {
    const gross = beleg(K1, 'ä'.repeat(160 * 1024))
    const { ports, schreiben } = aufbau({ 's-gross': { parentId: 'v-ks', name: NAME, text: gross } })
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegPfad: `${VORHABEN}/${NAME}` })), ports)
    expect(r.beleg).toEqual({
      pfad: `${VORHABEN}/${NAME}`, sourceId: 's-gross', ordnerId: 'v-ks', aktion: 'vorhanden',
      bytes: Buffer.byteLength(gross, 'utf-8'), sha256: createHash('sha256').update(gross, 'utf-8').digest('hex'),
    })
    expect(r.beleg.bytes).toBeGreaterThan(300 * 1024)
    expect(schreiben).not.toHaveBeenCalled()
    expect(ports.transformation).toHaveBeenCalledWith({ id: 's-gross', parentId: 'v-ks', name: NAME }, undefined)
    // Stand aus dem Register, nicht geraten (Befund R4-Abnahme: „beleg" bei berichteter Zeile)
    expect(r).toMatchObject({ stand: 'berichtet', transformation: { jobId: 'job-1' }, register: { aktion: 'angelegt', belegNeu: true } })
    expect(r.folgeaufrufe.map((f) => f.werkzeug)).toEqual(['job_status', 'sitzung_eintragen'])
  })

  it('Text: neu anlegen; gleiche Kennung ersetzt (mit Version, erzwungen); fremde Kennung bricht ab', async () => {
    const neu = aufbau({})
    expect((await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegText: beleg(), belegName: NAME })), neu.ports)).beleg.aktion).toBe('angelegt')

    const gleich = aufbau({ 's-1': { parentId: 'v-ks', name: NAME, text: beleg(K1, 'alt'), version: 'v7' } })
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegText: beleg(), belegName: NAME })), gleich.ports)
    expect(r.beleg.aktion).toBe('ersetzt')
    expect(gleich.schreiben).toHaveBeenCalledWith('ersetzen', 's-1', 'v7')
    expect(gleich.ports.transformation).toHaveBeenCalledWith(expect.anything(), true)

    const fremd = aufbau({ 's-1': { parentId: 'v-ks', name: NAME, text: beleg(K2) } })
    await expect(schliesseSitzungAb(leseAbschlussEingabe(roh({ belegText: beleg(), belegName: NAME })), fremd.ports)).rejects.toThrow(/andere_kennung_am_namen/)
    expect(fremd.schreiben).not.toHaveBeenCalled()
  })

  it('Verweis: fehlt (noch nicht synchronisiert) oder liegt woanders → benannter Fehler, kein Job', async () => {
    const leer = aufbau({})
    await expect(schliesseSitzungAb(leseAbschlussEingabe(roh({ belegPfad: `${VORHABEN}/${NAME}` })), leer.ports)).rejects.toThrow(/beleg_nicht_gefunden: .*in einer Minute erneut aufrufen/)
    const woanders = aufbau({ 's-1': { parentId: 'v-anders', name: NAME, text: beleg() } })
    await expect(schliesseSitzungAb(leseAbschlussEingabe(roh({ belegSourceId: 's-1' })), woanders.ports)).rejects.toThrow(/beleg_falscher_ort/)
    expect(woanders.ports.transformation).not.toHaveBeenCalled()
  })

  it('Register lehnt ab, bevor etwas geschrieben wird', async () => {
    const { ports, schreiben } = aufbau({}, [doc({ registerId: K1, sitzungId: K1, bemerkung: 'gepflegt' }), doc({ registerId: 'alt:B45', sitzungId: undefined, gemeldetVon: 'import' })])
    await expect(schliesseSitzungAb(leseAbschlussEingabe(roh({ belegText: beleg(), belegName: NAME, nrAlt: 'B45' })), ports)).rejects.toThrow(/kennung_vergeben/)
    expect(schreiben).not.toHaveBeenCalled()
  })

  it('nrAlt schluesselt um; gemeldet wird mit dem Kopf', async () => {
    const { ports, gemeldet, register } = aufbau({}, [doc({ registerId: 'alt:B45', sitzungId: undefined, kennung: 'keine', gemeldetVon: 'import', quelle: 'chat' })])
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegText: beleg(), belegName: NAME, nrAlt: 'B45' })), ports)
    expect(r.register.umgeschluesselt).toEqual({ von: 'alt:B45', nach: K1 })
    expect(register.has(K1)).toBe(true)
    expect(gemeldet[0]).toMatchObject({ sitzungId: K1, quelle: 'cowork', titel: 'Register gebaut', beginn: '2026-11-15' })
  })

  it('Job-Start scheitert oder Notiz ist aktuell: kein Fehler des Aufrufs, Folgeaufruf passt', async () => {
    const kaputt = aufbau({ 's-1': { parentId: 'v-ks', name: NAME, text: beleg() } })
    kaputt.ports.transformation = vi.fn(async () => { throw new Error('Secretary nicht erreichbar') })
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegSourceId: 's-1' })), kaputt.ports)
    expect(r.transformation).toEqual({ fehler: 'Secretary nicht erreichbar' })
    expect(r.folgeaufrufe[0].werkzeug).toBe('transformation_starten')

    const aktuell = aufbau({ 's-1': { parentId: 'v-ks', name: NAME, text: beleg() } })
    aktuell.ports.transformation = vi.fn(async () => ({ abgesagt: 'Transformation ist aktuell' }))
    expect(await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegSourceId: 's-1' })), aktuell.ports)).toMatchObject({ transformation: { abgesagt: 'Transformation ist aktuell' } })
  })

  it('Stand nicht lesbar: null mit Hinweis, kein Fehler des Aufrufs', async () => {
    const { ports } = aufbau({ 's-1': { parentId: 'v-ks', name: NAME, text: beleg() } })
    ports.register.stand = vi.fn(async () => { throw new Error('Mongo weg') })
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ belegSourceId: 's-1' })), ports)
    expect(r.stand).toBeNull()
    expect(r.hinweise).toContain('Stand nicht lesbar: Mongo weg — sitzungen_auflisten nennt ihn')
  })

  it('ohne Vorhaben: Ablage in Organisation/Sitzungen, kein Block, nur die Chronik', async () => {
    const { ports } = aufbau({})
    const text = beleg().replace('hauptvorhaben: 24.09 KnowledgeScout\n', '')
    const r = await schliesseSitzungAb(leseAbschlussEingabe(roh({ vorhabenPfad: undefined, ohneVorhaben: true, belegText: text, belegName: NAME })), ports)
    expect(r.beleg.pfad).toBe(`Organisation/Sitzungen/${NAME}`)
    expect(r.folgeaufrufe.map((f) => f.werkzeug)).toEqual(['job_status', 'sichten_regenerieren'])
  })
})
