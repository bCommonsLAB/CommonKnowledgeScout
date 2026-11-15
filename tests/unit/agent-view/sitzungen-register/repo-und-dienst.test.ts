import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ABLAGE_KS, JETZT, K1, doc } from './fixtures'

/**
 * Unit-Tests: Mongo-Zugriffe des Registers (getCollection gemockt, Muster
 * agent-view-worklists-repo.test.ts) und der Umschluessel-Weg im Dienst
 * (Repo gemockt): reine Archiv-Zeile wird hineingefuehrt, gepflegte nicht.
 */

interface MockCol {
  createIndex: ReturnType<typeof vi.fn>
  insertOne: ReturnType<typeof vi.fn>
  findOneAndUpdate: ReturnType<typeof vi.fn>
  bulkWrite: ReturnType<typeof vi.fn>
}

function mockCol(): MockCol {
  return {
    createIndex: vi.fn().mockResolvedValue('ok'),
    insertOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    findOneAndUpdate: vi.fn().mockResolvedValue(doc()),
    bulkWrite: vi.fn().mockResolvedValue({ insertedCount: 1, modifiedCount: 1 }),
  }
}

async function repoMit(col: MockCol) {
  vi.doMock('@/lib/mongodb-service', () => ({ getCollection: vi.fn().mockResolvedValue(col) }))
  return import('@/lib/repositories/agent-view-sitzungen-repo')
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('agent-view-sitzungen-repo', () => {
  it('Collection je Library, partieller Unique-Index auf sitzungId', async () => {
    const col = mockCol()
    const repo = await repoMit(col)
    expect(repo.getSitzungenCollectionName('lib-1')).toBe('agent_view_sitzungen__lib-1')
    await repo.legeZeileAn('lib-1', doc())
    expect(col.createIndex).toHaveBeenCalledWith({ libraryId: 1, sitzungId: 1 }, { unique: true, partialFilterExpression: { sitzungId: { $type: 'string' } } })
  })

  it('Duplikat beim Anlegen wirft SitzungsKennungVergebenError', async () => {
    const col = mockCol()
    col.insertOne.mockRejectedValue(Object.assign(new Error('E11000'), { code: 11000 }))
    const repo = await repoMit(col)
    await expect(repo.legeZeileAn('lib-1', doc())).rejects.toBeInstanceOf(repo.SitzungsKennungVergebenError)
  })

  it('aendereZeile: $set, $unset und $addToSet fuer PRs', async () => {
    const col = mockCol()
    const repo = await repoMit(col)
    await repo.aendereZeile('lib-1', K1, { set: { bemerkung: 'x' }, unset: ['kennungPraefix'], neuePrs: ['#2'] })
    expect(col.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { bemerkung: 'x' }, $unset: { kennungPraefix: '' }, $addToSet: { prs: { $each: ['#2'] } },
    })
  })

  it('schreibeAbgleich: Stempel als Einzelfeld, sourceIds per $addToSet, ungeordnet', async () => {
    const col = mockCol()
    const repo = await repoMit(col)
    const r = await repo.schreibeAbgleich('lib-1', {
      neu: [doc({ registerId: 'neu', sitzungId: 'neu-kennung-1234567890' })],
      aenderungen: [{ registerId: K1, am: JETZT, ablage: ABLAGE_KS, stempel: { feld: 'chronikAm', am: JETZT }, neueBelegSourceIds: ['src-1'] }],
      hinweise: [],
    })
    const [ops, optionen] = col.bulkWrite.mock.calls[0]
    expect(optionen).toEqual({ ordered: false })
    expect(ops[1]).toEqual({ updateOne: {
      filter: { libraryId: 'lib-1', registerId: K1 },
      update: { $set: { geaendertAm: JETZT, ablage: ABLAGE_KS, 'berichtet.chronikAm': JETZT }, $addToSet: { belegSourceIds: { $each: ['src-1'] } } },
    } })
    expect(r).toEqual({ angelegt: 1, aktualisiert: 1, fehler: [] })
  })

  it('schreibeAbgleich: Schreibfehler je Operation statt Abbruch', async () => {
    const col = mockCol()
    col.bulkWrite.mockRejectedValue({ writeErrors: [{ index: 0, errmsg: 'E11000 duplicate key' }], result: { insertedCount: 0, modifiedCount: 2 } })
    const repo = await repoMit(col)
    const r = await repo.schreibeAbgleich('lib-1', { neu: [doc()], aenderungen: [], hinweise: [] })
    expect(r).toEqual({ angelegt: 0, aktualisiert: 2, fehler: ['Operation 0: E11000 duplicate key'] })
  })

  it('leerer Plan schreibt nichts', async () => {
    const col = mockCol()
    const repo = await repoMit(col)
    expect(await repo.schreibeAbgleich('lib-1', { neu: [], aenderungen: [], hinweise: [] })).toEqual({ angelegt: 0, aktualisiert: 0, fehler: [] })
    expect(col.bulkWrite).not.toHaveBeenCalled()
  })
})

describe('setzeSitzung — Kennung nachtragen', () => {
  const ALT = doc({ registerId: 'alt:17', sitzungId: undefined, kennung: 'keine', nrAlt: 17, gemeldetVon: 'import', titelOriginal: 'Altliste' })

  async function dienstMit(andere: ReturnType<typeof doc> | null) {
    const repo = {
      holeZeile: vi.fn(async (_lib: string, id: string) => (id === 'alt:17' ? ALT : null)),
      holeNachKennung: vi.fn().mockResolvedValue(andere),
      loescheZeile: vi.fn().mockResolvedValue(true),
      aendereZeile: vi.fn(async (_lib: string, _id: string, a: { set: object }) => ({ ...ALT, ...a.set })),
    }
    vi.doMock('@/lib/repositories/agent-view-sitzungen-repo', async (orig) => ({ ...(await orig<object>()), ...repo }))
    const dienst = await import('@/lib/agent-view/sitzungen-register/register-dienst')
    return { dienst, repo }
  }

  it('fuehrt eine reine Archiv-Zeile hinein und loescht sie vor dem Umschluesseln', async () => {
    const archiv = doc({ gemeldetVon: 'archiv', belegSourceIds: ['src-1'], ablage: ABLAGE_KS })
    const { dienst, repo } = await dienstMit(archiv)
    const r = await dienst.setzeSitzung({ libraryId: 'lib-1', registerId: 'alt:17', eingabe: { sitzungId: K1 }, jetzt: JETZT })
    expect(r).toMatchObject({ umgeschluesselt: { von: 'alt:17', nach: K1 }, zusammengefuehrt: K1 })
    expect(repo.loescheZeile).toHaveBeenCalledWith('lib-1', K1)
    const set = repo.aendereZeile.mock.calls[0][2].set
    expect(set).toMatchObject({ registerId: K1, sitzungId: K1, belegSourceIds: ['src-1'], ablage: ABLAGE_KS, titelOriginal: 'Altliste' })
  })

  it('wirft, wenn die Kennung eine gepflegte Zeile traegt', async () => {
    const { dienst, repo } = await dienstMit(doc({ gemeldetVon: 'skill' }))
    await expect(dienst.setzeSitzung({ libraryId: 'lib-1', registerId: 'alt:17', eingabe: { sitzungId: K1 }, jetzt: JETZT }))
      .rejects.toThrow(/nicht zusammengefuehrt/)
    expect(repo.loescheZeile).not.toHaveBeenCalled()
  })

  it('unbekannte Zeile ist ein benannter Fehler', async () => {
    const { dienst } = await dienstMit(null)
    await expect(dienst.setzeSitzung({ libraryId: 'lib-1', registerId: 'alt:99', eingabe: { bemerkung: 'x' }, jetzt: JETZT }))
      .rejects.toBeInstanceOf(dienst.SitzungNichtGefundenError)
  })
})
