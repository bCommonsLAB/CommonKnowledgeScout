/**
 * @fileoverview Unit-Tests R4: Anschluesse von sitzung_abschliessen an Speicher, Register und Job.
 *
 * Nicht-Finden wird benannt (mit dem Sync-Hinweis, ohne Warten), eine
 * aktuelle Notiz wird Absage statt Fehler, Ersetzen geht nur versioniert,
 * der Job laeuft mit chatverlauf-de und ohne Ingest. Repo, Job-Start und
 * Vorlagen-Stand sind gemockt; der Provider ist ein Objekt mit den
 * Interface-Methoden.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  starte: vi.fn(), vorlageStand: vi.fn(), holeNachKennung: vi.fn(), holeZeile: vi.fn(), aendereZeile: vi.fn(),
  melde: vi.fn(), setze: vi.fn(), sicht: vi.fn(),
}))

vi.mock('@/lib/mcp/transformation-start', () => ({ starteTransformation: h.starte }))
vi.mock('@/lib/mcp/tools-vorlagen', () => ({ vorlageAktualisiertAm: h.vorlageStand }))
vi.mock('@/lib/repositories/agent-view-sitzungen-repo', () => ({ holeNachKennung: h.holeNachKennung, holeZeile: h.holeZeile, aendereZeile: h.aendereZeile }))
vi.mock('@/lib/agent-view/sitzungen-register/register-dienst', () => ({ meldeSitzungen: h.melde, setzeSitzung: h.setze }))
vi.mock('@/lib/agent-view/sitzungen-register/ist-laden', () => ({ ladeRegisterSicht: h.sicht }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { abschlussPorts } from '@/lib/mcp/sitzung-abschluss-ports'
import { TransformationAbgesagtError } from '@/lib/mcp/transformation-erzwingen'
import type { StorageProvider } from '@/lib/storage/types'
import type { Library } from '@/types/library'

const LIBRARY = { id: 'lib-1', label: 'Archiv', config: { agentView: { enabled: true } } } as unknown as Library

function provider(extra: Partial<Record<string, unknown>> = {}): StorageProvider {
  return {
    name: 'test',
    listItemsById: vi.fn(async () => []),
    getItemById: vi.fn(async (id: string) => { throw new Error(`Item ${id} nicht gefunden`) }),
    getPathById: vi.fn(async () => '/'),
    ...extra,
  } as unknown as StorageProvider
}

const ports = (p: StorageProvider) => abschlussPorts({ library: LIBRARY, userEmail: 'owner@example.com', provider: p, jetzt: () => '2026-11-15T12:00:00.000Z' })

beforeEach(() => vi.resetAllMocks())

describe('abschlussPorts', () => {
  it('Beleg nicht da: benannter Fehler mit Meldung des Speichers und Sync-Hinweis', async () => {
    await expect(ports(provider()).speicher.datei({ sourceId: 's-x' })).rejects.toThrow(/beleg_nicht_gefunden: Item s-x nicht gefunden — Gerade erst abgelegt\?.*in einer Minute erneut aufrufen/)
  })

  it('Ordner nicht da: vorhaben_nicht_gefunden', async () => {
    await expect(ports(provider()).speicher.ordner({ folderId: 'f-x' })).rejects.toThrow(/vorhaben_nicht_gefunden/)
  })

  it('Ersetzen nur versioniert und nur mit Version', async () => {
    await expect(ports(provider()).speicher.ersetzen('s-1', 'x', 'v1')).rejects.toThrow(/kann nicht versioniert ersetzen/)
    const updateFile = vi.fn(async () => ({ id: 's-1', version: 'v2' }))
    const p = provider({ updateFile })
    await expect(ports(p).speicher.ersetzen('s-1', 'x', null)).rejects.toThrow(/Version von s-1 unbekannt/)
    expect(await ports(p).speicher.ersetzen('s-1', 'x', 'v1')).toEqual({ id: 's-1' })
    expect(updateFile).toHaveBeenCalledWith('s-1', expect.any(Blob), { ifVersion: 'v1' })
  })

  it('Job mit chatverlauf-de ohne Ingest; aktuelle Notiz wird Absage, anderer Fehler bleibt Fehler', async () => {
    h.vorlageStand.mockResolvedValue('2026-11-01T00:00:00.000Z')
    h.starte.mockResolvedValueOnce({ jobId: 'job-1', erzwungen: 'nicht_noetig' })
    const t = ports(provider()).transformation
    expect(await t({ id: 's-1', parentId: 'v-ks', name: 'B.md' }, undefined)).toEqual({ jobId: 'job-1', erzwungen: 'nicht_noetig' })
    expect(h.starte).toHaveBeenCalledWith(expect.objectContaining({
      template: 'chatverlauf-de', zielsprache: 'de', ingest: false, erzwingen: undefined,
      source: { itemId: 's-1', parentId: 'v-ks', name: 'B.md' },
    }))
    h.starte.mockRejectedValueOnce(new TransformationAbgesagtError('ist aktuell'))
    expect(await t({ id: 's-1', parentId: 'v-ks', name: 'B.md' }, undefined)).toEqual({ abgesagt: 'ist aktuell' })
    h.starte.mockRejectedValueOnce(new Error('Secretary weg'))
    await expect(t({ id: 's-1', parentId: 'v-ks', name: 'B.md' }, undefined)).rejects.toThrow('Secretary weg')
  })

  it('Stand aus der Register-Sicht; fehlende Zeile ist ein Fehler', async () => {
    h.sicht.mockResolvedValue({ zeilen: [{ sitzungId: 'k', stand: 'berichtet' }], imSpeicherGeprueft: 0 })
    const r = ports(provider()).register
    expect(await r.stand('k')).toBe('berichtet')
    await expect(r.stand('andere')).rejects.toThrow(/nicht in der Register-Sicht/)
  })

  it('Register: Melden mit gemeldetVon skill, Fehler der Zeile wird geworfen; Beleg nur einmal anhaengen', async () => {
    h.melde.mockResolvedValueOnce([{ sitzungId: 'k', aktion: 'angelegt' }])
    const r = ports(provider()).register
    expect(await r.melden({ sitzungId: 'k', quelle: 'cowork' })).toBe('angelegt')
    expect(h.melde).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'lib-1', gemeldetVon: 'skill' }))
    h.melde.mockResolvedValueOnce([{ sitzungId: 'k', fehler: 'kaputt' }])
    await expect(r.melden({ sitzungId: 'k', quelle: 'cowork' })).rejects.toThrow(/kaputt/)

    h.holeNachKennung.mockResolvedValue({ registerId: 'k', belegSourceIds: ['s-1'] })
    expect(await r.belegAnhaengen('k', 's-1')).toBe(false)
    expect(await r.belegAnhaengen('k', 's-2')).toBe(true)
    expect(h.aendereZeile).toHaveBeenCalledWith('lib-1', 'k', { set: { belegSourceIds: ['s-1', 's-2'], geaendertAm: '2026-11-15T12:00:00.000Z' } })
  })
})
