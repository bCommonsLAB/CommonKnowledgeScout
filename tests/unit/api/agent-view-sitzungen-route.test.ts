/**
 * @fileoverview Routen-Tests: Reiter „Sitzungen" (Register, Welle R3).
 *
 * GET liest das Register ueber `ladeRegisterSicht` (gemockt) und liefert Zeilen
 * juengste zuerst samt Bilanz; die Archivpflege-Sperre antwortet 409 statt
 * einer leeren Liste. PATCH reicht die Felder von `sitzung_setzen` an
 * `setzeSitzung` und uebersetzt die benannten Fehler (400/404/409). Clerk,
 * LibraryService, Register-Dienst und Provider sind gemockt — kein Mongo.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  class SitzungNichtGefundenError extends Error { readonly code = 'nicht_gefunden' as const }
  class SitzungsKennungVergebenError extends Error {}
  return {
    auth: vi.fn(), currentUser: vi.fn(), getLibrary: vi.fn(), laden: vi.fn(), setzen: vi.fn(), provider: vi.fn(),
    NichtGefunden: SitzungNichtGefundenError, Vergeben: SitzungsKennungVergebenError,
  }
})

vi.mock('@clerk/nextjs/server', () => ({ auth: h.auth, currentUser: h.currentUser }))
vi.mock('@/lib/services/library-service', () => ({ LibraryService: { getInstance: () => ({ getLibrary: h.getLibrary }) } }))
vi.mock('@/lib/agent-view/sitzungen-register/ist-laden', () => ({ ladeRegisterSicht: h.laden }))
vi.mock('@/lib/agent-view/sitzungen-register/register-dienst', () => ({ setzeSitzung: h.setzen, SitzungNichtGefundenError: h.NichtGefunden }))
vi.mock('@/lib/repositories/agent-view-sitzungen-repo', () => ({ SitzungsKennungVergebenError: h.Vergeben }))
vi.mock('@/lib/storage/server-provider', () => ({ getServerProvider: h.provider }))
vi.mock('@/lib/debug/logger', () => ({ FileLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import { GET } from '@/app/api/library/[libraryId]/agent-view/sitzungen/route'
import { PATCH } from '@/app/api/library/[libraryId]/agent-view/sitzungen/[registerId]/route'
import { SitzungsEingabeError } from '@/lib/agent-view/sitzungen-register/schreib-plaene'
import type { SitzungsSicht } from '@/lib/agent-view/sitzungen-register/types'

const params = Promise.resolve({ libraryId: 'lib-1' })
const zeileParams = (registerId: string) => Promise.resolve({ libraryId: 'lib-1', registerId })

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/library/lib-1/agent-view/sitzungen', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  })
}

function authOk(agentView = true): void {
  h.auth.mockResolvedValue({ userId: 'user-1' })
  h.currentUser.mockResolvedValue({ emailAddresses: [{ emailAddress: 'owner@example.com' }] })
  h.getLibrary.mockResolvedValue({ id: 'lib-1', label: 'Archiv', config: { agentView: { enabled: agentView } } })
}

function sicht(o: Partial<SitzungsSicht>): SitzungsSicht {
  return {
    registerId: 'r', sitzungId: null, kennung: 'keine', quelle: 'chat', titel: 'T', beginn: null, ende: null, link: null,
    repo: null, branch: null, prs: [], stand: 'gemeldet', hinweise: [], imBericht: false, berichtet: { chronikAm: null, blockAm: null },
    entscheidung: 'offen', entscheidungGrund: null, zugbereiche: [], vorhabenVorschlag: null, bemerkung: null,
    vorhabenPfad: null, vorhabenFolderId: null, vorhabenBestimmt: false, belegOrdnerPfad: null, belege: [], gemeldetVon: 'import',
    gemeldetAm: '2026-11-15T00:00:00.000Z', gespeichert: true, ...o,
  }
}

beforeEach(() => vi.resetAllMocks())

describe('GET …/agent-view/sitzungen', () => {
  it('401 ohne Anmeldung', async () => {
    h.auth.mockResolvedValue({ userId: null })
    expect((await GET(req('GET'), { params })).status).toBe(401)
  })

  it('409 archivpflege_aus statt leerer Liste', async () => {
    authOk(false)
    const res = await GET(req('GET'), { params })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'archivpflege_aus' })
    expect(h.laden).not.toHaveBeenCalled()
  })

  it('Zeilen juengste zuerst, Bilanz, ohne Speicherzugriff wenn nicht noetig', async () => {
    authOk()
    h.laden.mockResolvedValue({
      zeilen: [sicht({ registerId: 'a', beginn: '2026-10-01' }), sicht({ registerId: 'b', beginn: '2026-11-01', quelle: 'cowork' })],
      imSpeicherGeprueft: 0,
    })
    const res = await GET(req('GET'), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.zeilen.map((z: SitzungsSicht) => z.registerId)).toEqual(['b', 'a'])
    expect(body.bilanz).toMatchObject({ gesamt: 2, jeQuelle: { cowork: 1, chat: 1 } })
    expect(h.provider).not.toHaveBeenCalled()
  })
})

describe('PATCH …/agent-view/sitzungen/[registerId]', () => {
  const ok = { zeile: { registerId: 'alt:B12' }, felder: ['entscheidung', 'entscheidungGrund'], umgeschluesselt: null, zusammengefuehrt: null }

  it('reicht die Felder an setzeSitzung, dekodiert den Schluessel', async () => {
    authOk()
    h.setzen.mockResolvedValue(ok)
    const res = await PATCH(req('PATCH', { entscheidung: 'ueberspringen', entscheidungGrund: 'ohne Substanz' }), { params: zeileParams('alt%3AB12') })
    expect(res.status).toBe(200)
    expect(h.setzen).toHaveBeenCalledWith(expect.objectContaining({
      libraryId: 'lib-1', registerId: 'alt:B12', eingabe: { entscheidung: 'ueberspringen', entscheidungGrund: 'ohne Substanz' },
    }))
    expect(await res.json()).toMatchObject({ registerId: 'alt:B12', unveraendert: false })
  })

  it('400 bei unbekanntem Feld oder leerem Body, ohne Dienstaufruf', async () => {
    authOk()
    expect((await PATCH(req('PATCH', { stand: 'berichtet' }), { params: zeileParams('x') })).status).toBe(400)
    expect((await PATCH(req('PATCH', {}), { params: zeileParams('x') })).status).toBe(400)
    expect(h.setzen).not.toHaveBeenCalled()
  })

  it('benannte Fehler: Eingabe 400, unbekannte Zeile 404, Kennung vergeben 409', async () => {
    authOk()
    h.setzen.mockRejectedValueOnce(new SitzungsEingabeError('ueberspringen braucht entscheidungGrund'))
    expect((await PATCH(req('PATCH', { entscheidung: 'ueberspringen' }), { params: zeileParams('x') })).status).toBe(400)
    h.setzen.mockRejectedValueOnce(new h.NichtGefunden('gibt es nicht'))
    expect((await PATCH(req('PATCH', { bemerkung: 'b' }), { params: zeileParams('x') })).status).toBe(404)
    h.setzen.mockRejectedValueOnce(new h.Vergeben('vergeben'))
    const res = await PATCH(req('PATCH', { sitzungId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }), { params: zeileParams('x') })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'kennung_vergeben' })
  })
})
