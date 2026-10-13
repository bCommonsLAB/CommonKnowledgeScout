import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QuellTreffer } from '@/lib/shadow-twin/quelle-suche-lauf'
import type { StorageProvider } from '@/lib/storage/types'

const setzeQuellkennung = vi.fn()
vi.mock('@/lib/repositories/shadow-twin-repo', () => ({ setzeQuellkennung: (...a: unknown[]) => setzeQuellkennung(...a) }))
vi.mock('@/lib/mcp/tool-shared', () => ({ requireProvider: vi.fn() }))

const { loeseTrefferAuf, rechneNach, MAX_AUFGELOEST } = await import('@/lib/mcp/quelle-suchen-speicher')

/** SHA-256 von "abc". */
const SHA_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

function treffer(sourceId: string, ueber: Partial<QuellTreffer> = {}): QuellTreffer {
  return {
    libraryId: 'neu', libraryName: 'Neuaufbau', slug: 'dv-neu', sourceId, sourceName: 'Flyer.pdf', parentId: 'p',
    sourceContentHash: null, sourceSize: null, erschliessung: { transkript: true, transformationen: 1 }, uebereinstimmung: 'name', ...ueber,
  }
}

function provider(dateien: Record<string, { pfad: string; size: number; inhalt?: string }>): StorageProvider {
  return {
    getItemById: async (id: string) => {
      const datei = dateien[id]
      if (!datei) throw new Error(`Item ${id} nicht gefunden`)
      return { id, type: 'file', metadata: { name: 'Flyer.pdf', size: datei.size } }
    },
    getPathById: async (id: string) => `/${dateien[id].pfad}`,
    getBinary: async (id: string) => ({ blob: new Blob([dateien[id].inhalt ?? '']), mimeType: 'application/pdf' }),
  } as unknown as StorageProvider
}

describe('loeseTrefferAuf', () => {
  it('nennt Pfad und Adresse, schaerft mit der Groesse aus dem Speicher und trennt Verschiedenes', async () => {
    const p = provider({ a: { pfad: 'events/Schulung/Flyer.pdf', size: 10 }, b: { pfad: 'x/Flyer.pdf', size: 99 } })
    const { zeilen, verschieden } = await loeseTrefferAuf({
      treffer: [treffer('a'), treffer('b'), treffer('weg')],
      such: { name: 'Flyer.pdf', hash: null, groesse: 10 },
      provider: async () => p,
    })
    expect(zeilen[0]).toMatchObject({ sourceId: 'a', uebereinstimmung: 'name_groesse', imSpeicher: true, pfad: 'events/Schulung/Flyer.pdf', adresse: '@dv-neu/events/Schulung/Flyer.pdf', groesse: 10 })
    expect(verschieden.map((v) => v.sourceId)).toEqual(['b'])
    expect(zeilen[1]).toMatchObject({ sourceId: 'weg', imSpeicher: false, adresse: null })
    expect(zeilen[1].grund).toContain('Twin ohne Datei')
  })

  it('benennt einen nicht erreichbaren Speicher und die Grenze, statt zu raten', async () => {
    const viele = Array.from({ length: MAX_AUFGELOEST + 1 }, (_, i) => treffer(`t${i}`))
    const { zeilen } = await loeseTrefferAuf({
      treffer: viele, such: { name: 'Flyer.pdf', hash: null, groesse: null },
      provider: async () => { throw new Error('kein Token') },
    })
    expect(zeilen[0]).toMatchObject({ imSpeicher: null })
    expect(zeilen[0].grund).toContain('Speicher nicht erreichbar')
    expect(zeilen[MAX_AUFGELOEST].grund).toContain(`Grenze ${MAX_AUFGELOEST}`)
  })
})

describe('rechneNach', () => {
  beforeEach(() => {
    setzeQuellkennung.mockReset()
    setzeQuellkennung.mockResolvedValue({ gesetzt: true })
  })

  it('rechnet die Kennung, schreibt sie und hebt auf hash, wenn die gesuchte Kennung passt', async () => {
    const p = provider({ a: { pfad: 'a.pdf', size: 3, inhalt: 'abc' } })
    const zeile = { ...treffer('a'), adresse: '@dv-neu/a.pdf', pfad: 'a.pdf', imSpeicher: true, groesse: 3, erschliessung: null }
    const ergebnis = await rechneNach({ zeilen: [zeile], such: { name: 'Flyer.pdf', hash: SHA_ABC, groesse: null }, provider: async () => p })
    expect(ergebnis.zeilen[0]).toMatchObject({ uebereinstimmung: 'hash', sourceContentHash: SHA_ABC })
    expect(setzeQuellkennung).toHaveBeenCalledWith(expect.objectContaining({ libraryId: 'neu', sourceId: 'a' }))
    expect(ergebnis.nachgerechnet).toEqual([{ libraryName: 'Neuaufbau', sourceName: 'Flyer.pdf', ergebnis: 'Kennung gesetzt' }])
  })

  it('ueberspringt grosse Dateien und Zeilen, die nicht im Speicher liegen', async () => {
    const gross = { ...treffer('g'), adresse: null, pfad: 'g.pdf', imSpeicher: true, groesse: 60 * 1024 * 1024, erschliessung: null }
    const weg = { ...treffer('w'), adresse: null, pfad: null, imSpeicher: false, groesse: null, erschliessung: null }
    const ergebnis = await rechneNach({ zeilen: [gross, weg], such: { name: 'Flyer.pdf', hash: null, groesse: null }, provider: async () => provider({}) })
    expect(ergebnis.nachgerechnet.map((n) => n.ergebnis)).toEqual(['uebersprungen: groesser als 50 MB'])
    expect(setzeQuellkennung).not.toHaveBeenCalled()
    expect(ergebnis.zeilen).toHaveLength(2)
  })
})
