import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bewerteTreffer, sortiereNachUebereinstimmung } from '@/lib/shadow-twin/quelle-suche'

const findeQuellKandidaten = vi.fn()
vi.mock('@/lib/repositories/shadow-twin-suche', () => ({ findeQuellKandidaten: (...a: unknown[]) => findeQuellKandidaten(...a) }))

const { sucheQuelle, sucheVerschwundeneAnderswo, suchLibrariesAus } = await import('@/lib/shadow-twin/quelle-suche-lauf')

const H1 = 'a'.repeat(64)
const H2 = 'b'.repeat(64)

describe('bewerteTreffer', () => {
  it('hash schlaegt Namen — auch umbenannt', () => {
    expect(bewerteTreffer({ name: 'a.pdf', hash: H1, groesse: null }, { sourceName: 'neu.pdf', sourceContentHash: H1, sourceSize: 1 })).toEqual({ art: 'hash' })
  })

  it('gleicher Name, andere Kennung oder Groesse ist belegt verschieden', () => {
    expect(bewerteTreffer({ name: 'a.pdf', hash: H1, groesse: null }, { sourceName: 'a.pdf', sourceContentHash: H2, sourceSize: null }).art).toBe('verschieden')
    expect(bewerteTreffer({ name: 'a.pdf', hash: null, groesse: 10 }, { sourceName: 'a.pdf', sourceContentHash: null, sourceSize: 11 }).art).toBe('verschieden')
  })

  it('Name und Groesse gleich → name_groesse, eine Groesse unbekannt → name, anderer Name → kein_treffer', () => {
    expect(bewerteTreffer({ name: 'a.pdf', hash: null, groesse: 10 }, { sourceName: 'a.pdf', sourceContentHash: H1, sourceSize: 10 }).art).toBe('name_groesse')
    expect(bewerteTreffer({ name: 'a.pdf', hash: null, groesse: null }, { sourceName: 'a.pdf', sourceContentHash: null, sourceSize: 10 }).art).toBe('name')
    expect(bewerteTreffer({ name: 'a.pdf', hash: null, groesse: null }, { sourceName: 'A.pdf', sourceContentHash: null, sourceSize: null }).art).toBe('kein_treffer')
  })

  it('sortiert hash vor name_groesse vor name', () => {
    const sortiert = sortiereNachUebereinstimmung([
      { uebereinstimmung: 'name' as const, libraryName: 'A', sourceName: 'x' },
      { uebereinstimmung: 'hash' as const, libraryName: 'Z', sourceName: 'x' },
      { uebereinstimmung: 'name_groesse' as const, libraryName: 'B', sourceName: 'x' },
    ])
    expect(sortiert.map((s) => s.uebereinstimmung)).toEqual(['hash', 'name_groesse', 'name'])
  })
})

describe('Suchlauf ueber Libraries (MongoDB gemockt)', () => {
  const libraries = suchLibrariesAus([
    { id: 'archiv', label: 'Archiv Peter' },
    { id: 'neu', label: 'Dachverband Neuaufbau', config: { adresse: { slug: 'dv-neu' } } },
  ])

  beforeEach(() => {
    findeQuellKandidaten.mockReset()
    findeQuellKandidaten.mockImplementation(async ({ libraryId }: { libraryId: string }) => libraryId === 'neu'
      ? [
          { libraryId: 'neu', sourceId: 'n1', sourceName: 'Teil 2.m4a', parentId: 'p', sourceContentHash: null, sourceSize: 500 },
          { libraryId: 'neu', sourceId: 'n2', sourceName: 'Flyer.pdf', parentId: 'p', sourceContentHash: H2, sourceSize: 9 },
        ]
      : [{ libraryId: 'archiv', sourceId: 'a1', sourceName: 'Teil 2.m4a', parentId: 'p', sourceContentHash: null, sourceSize: null }])
  })

  it('Scan-Weg: findet die Kopie in der anderen Library, laesst die Quelle selbst aus und nennt @slug', async () => {
    const orte = await sucheVerschwundeneAnderswo({
      libraries, eigeneLibraryId: 'archiv',
      quellen: [{ sourceId: 'a1', sourceName: 'Teil 2.m4a', sourceContentHash: null, sourceSize: null }],
    })
    expect(orte.get('a1')).toEqual({
      gesamt: 1,
      orte: [{ libraryId: 'neu', libraryName: 'Dachverband Neuaufbau', bibliothek: '@dv-neu', sourceId: 'n1', sourceName: 'Teil 2.m4a', uebereinstimmung: 'name' }],
    })
    // EINE Abfrage je Library, nur Kopf-Felder
    expect(findeQuellKandidaten).toHaveBeenCalledTimes(2)
    expect(findeQuellKandidaten.mock.calls[0][0]).toMatchObject({ mitErschliessung: false, namen: ['Teil 2.m4a'] })
  })

  it('Werkzeug-Weg: trennt Treffer und belegt Verschiedenes', async () => {
    findeQuellKandidaten.mockImplementation(async ({ libraryId }: { libraryId: string }) => libraryId === 'neu'
      ? [{ libraryId: 'neu', sourceId: 'n2', sourceName: 'Flyer.pdf', parentId: 'p', sourceContentHash: H2, sourceSize: 9 }]
      : [{ libraryId: 'archiv', sourceId: 'a9', sourceName: 'anders.pdf', parentId: 'p', sourceContentHash: H1, sourceSize: 9 }])
    const ergebnis = await sucheQuelle({ libraries, such: { name: 'Flyer.pdf', hash: H1, groesse: null } })
    expect(ergebnis.treffer.map((t) => [t.sourceId, t.uebereinstimmung, t.slug])).toEqual([['a9', 'hash', 'archiv-peter']])
    expect(ergebnis.verschieden.map((v) => v.sourceId)).toEqual(['n2'])
    expect(ergebnis.durchsucht).toBe(2)
  })
})
