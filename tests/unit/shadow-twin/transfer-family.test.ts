import { describe, it, expect, vi } from 'vitest'
import type { ShadowTwinDocument } from '@/lib/repositories/shadow-twin-repo'
import { MAX_UEBERGABE_BYTES, uebergibFamilie, type TransferArgs, type TransferPorts } from '@/lib/shadow-twin/transfer-family'
import type { StorageProvider } from '@/lib/storage/types'

interface Eintrag { id: string; name: string; type: 'file' | 'folder'; parentId: string; size?: number }

/** In-Memory-Speicher einer Library: Items, Pfade, Uploads, Loeschungen. */
function speicher(eintraege: Eintrag[], pfade: Record<string, string>) {
  const items = new Map(eintraege.map((e) => [e.id, e]))
  const uploads: Array<{ parentId: string; name: string; text: string }> = []
  const geloescht: string[] = []
  let nr = 0
  const alsItem = (e: Eintrag) => ({ id: e.id, type: e.type, parentId: e.parentId, metadata: { name: e.name, size: e.size ?? 0, mimeType: 'application/pdf' } })
  const provider = {
    getItemById: async (id: string) => { const e = items.get(id); if (!e) throw new Error(`${id} nicht gefunden`); return alsItem(e) },
    listItemsById: async (parentId: string) => [...items.values()].filter((e) => e.parentId === parentId).map(alsItem),
    getPathById: async (id: string) => pfade[id] ?? '',
    getBinary: async () => ({ blob: new Blob(['abc']), mimeType: 'application/pdf' }),
    uploadFile: async (parentId: string, file: File) => {
      const id = `neu-${++nr}`
      items.set(id, { id, name: file.name, type: 'file', parentId, size: file.size })
      uploads.push({ parentId, name: file.name, text: await file.text() })
      return alsItem(items.get(id) as Eintrag)
    },
    deleteItem: async (id: string) => { geloescht.push(id); items.delete(id) },
  } as unknown as StorageProvider
  return { provider, uploads, geloescht, items }
}

const DOC: ShadowTwinDocument = {
  libraryId: 'A', sourceId: 'src', sourceName: 'Flyer.pdf', parentId: 'ev', userEmail: 'u@x',
  artifacts: {
    transcript: { markdown: 'Text', createdAt: 't', updatedAt: 't' },
    transformation: { standard: { de: { markdown: 'T', createdAt: 't', updatedAt: 't' } } },
  },
  createdAt: 't', updatedAt: 't',
}

function aufbau(ueber: { doc?: ShadowTwinDocument | null; quelleGroesse?: number; zielHatDatei?: boolean; elternName?: string } = {}) {
  const a = speicher([
    { id: 'ev', name: ueber.elternName ?? 'Ereignis', type: 'folder', parentId: 'root' },
    { id: 'src', name: 'Flyer.pdf', type: 'file', parentId: 'ev', size: ueber.quelleGroesse ?? 3 },
  ], { src: 'Ereignis/Flyer.pdf', ev: 'Ereignis' })
  const b = speicher([
    { id: 'ziel', name: 'Schulung', type: 'folder', parentId: 'root' },
    ...(ueber.zielHatDatei ? [{ id: 'alt', name: 'Flyer.pdf', type: 'file' as const, parentId: 'ziel' }] : []),
    { id: '_tw', name: '_Flyer.pdf', type: 'folder', parentId: 'root' },
  ], { ziel: 'events/Schulung' })
  const doc = ueber.doc === undefined ? DOC : ueber.doc
  const ports = {
    ladeTwin: vi.fn(async () => doc),
    importiere: vi.fn(async () => undefined),
    exportiere: vi.fn(async () => undefined),
    legeTwinAn: vi.fn(async () => undefined),
    kopiereSegmente: vi.fn(async () => true),
    setzeKennung: vi.fn(async () => undefined),
    verwirf: vi.fn(async () => ({ folderId: 'klaer', name: 'zu klären' })),
    adresseInZiel: (pfad: string) => `@dv-neu/${pfad}`,
    jetzt: () => '2026-10-13T12:00:00.000Z',
  } satisfies TransferPorts
  const args: TransferArgs = {
    von: { libraryId: 'A', libraryName: 'Archiv', provider: a.provider },
    nach: { libraryId: 'B', libraryName: 'Neuaufbau', provider: b.provider },
    sourceId: 'src', zielOrdnerId: 'ziel', herkunft: 'behalten', vorschau: false,
  }
  return { a, b, ports, args }
}

describe('uebergibFamilie — Vorbedingungen (nichts wird geschrieben)', () => {
  it.each([
    ['dieselbe Library', (s: ReturnType<typeof aufbau>) => ({ ...s.args, nach: { ...s.args.nach, libraryId: 'A' } }), /familie_umziehen/],
    ['Ziel ist Twin-Ordner', (s: ReturnType<typeof aufbau>) => ({ ...s.args, zielOrdnerId: '_tw' }), /Twin-Ordner/],
  ])('%s', async (_name, varianteArgs, fehler) => {
    const s = aufbau()
    await expect(uebergibFamilie(varianteArgs(s), s.ports)).rejects.toThrow(fehler)
    expect(s.b.uploads).toHaveLength(0)
  })

  it('weist Namensgleichheit am Ziel, Uebergroesse und verwerfen aus „zu klären" ab', async () => {
    const gleich = aufbau({ zielHatDatei: true })
    await expect(uebergibFamilie(gleich.args, gleich.ports)).rejects.toThrow(/bereits "Flyer.pdf"/)
    const gross = aufbau({ quelleGroesse: MAX_UEBERGABE_BYTES + 1 })
    await expect(uebergibFamilie(gross.args, gross.ports)).rejects.toThrow(/Zu gross/)
    const klaer = aufbau({ elternName: 'zu klären' })
    await expect(uebergibFamilie({ ...klaer.args, herkunft: 'verwerfen' }, klaer.ports)).rejects.toThrow(/schon in „zu klären"/)
    expect([gleich, gross, klaer].every((s) => s.b.uploads.length === 0 && s.a.uploads.length === 0)).toBe(true)
  })
})

describe('uebergibFamilie — Ablauf', () => {
  it('vorschau zeigt den Plan und schreibt nichts', async () => {
    const s = aufbau()
    const e = await uebergibFamilie({ ...s.args, vorschau: true }, s.ports)
    expect(e.plan).toMatchObject({
      quelle: { name: 'Flyer.pdf', pfad: 'Ereignis/Flyer.pdf' },
      ziel: { pfad: 'events/Schulung/Flyer.pdf', adresse: '@dv-neu/events/Schulung/Flyer.pdf' },
      familie: { twinDokument: true, transkript: true, transformationen: 1 },
      verweisDatei: 'Verweis – Flyer.pdf.md',
    })
    expect(s.b.uploads).toHaveLength(0)
    expect(s.ports.importiere).not.toHaveBeenCalled()
  })

  it('behalten: Quelle und Twin nach B, Verweis in A, nichts verworfen', async () => {
    const s = aufbau()
    const e = await uebergibFamilie(s.args, s.ports)
    expect(e.schritte.map((x) => `${x.schritt}:${x.status}`)).toEqual([
      'import_herkunft:ok', 'quelle_kopiert:ok', 'twin_angelegt:ok', 'segmente_kopiert:ok',
      'export_ziel:ok', 'kennung_herkunft:ok', 'verweis_geschrieben:ok', 'herkunft:ok',
    ])
    expect(s.b.uploads.map((u) => [u.parentId, u.name])).toEqual([['ziel', 'Flyer.pdf']])
    expect(s.ports.legeTwinAn).toHaveBeenCalledWith(expect.objectContaining({ nachLibraryId: 'B', sourceId: e.neueSourceId, parentId: 'ziel' }))
    expect(s.a.uploads.map((u) => [u.parentId, u.name])).toEqual([['ev', 'Verweis – Flyer.pdf.md']])
    expect(s.a.uploads[0].text).toContain('[[@dv-neu/events/Schulung/Flyer.pdf|Flyer.pdf]]')
    expect(s.ports.verwirf).not.toHaveBeenCalled()
    expect(s.a.items.has('src')).toBe(true)
  })

  it('verwerfen: dieselben Schritte, am Ende nach „zu klären"', async () => {
    const s = aufbau()
    const e = await uebergibFamilie({ ...s.args, herkunft: 'verwerfen' }, s.ports)
    expect(s.ports.verwirf).toHaveBeenCalledWith('src')
    expect(e.schritte.at(-1)).toEqual({ schritt: 'herkunft', status: 'ok', detail: 'nach „zu klären" verschoben' })
  })

  it('scheitert der Twin in B, wird die Kopie entfernt und A bleibt unveraendert', async () => {
    const s = aufbau()
    s.ports.legeTwinAn.mockRejectedValueOnce(new Error('E11000 duplicate key'))
    await expect(uebergibFamilie(s.args, s.ports)).rejects.toThrow(/wieder entfernt.*Herkunft ist unveraendert/)
    expect(s.b.geloescht).toEqual(['neu-1'])
    expect(s.a.uploads).toHaveLength(0)
    expect(s.ports.verwirf).not.toHaveBeenCalled()
  })

  it('ein spaeterer Fehler haelt die Kette an und steht in offen', async () => {
    const s = aufbau()
    s.ports.exportiere.mockRejectedValueOnce(new Error('Spiegel nicht schreibbar'))
    const e = await uebergibFamilie({ ...s.args, herkunft: 'verwerfen' }, s.ports)
    expect(e.schritte.at(-1)).toEqual({ schritt: 'export_ziel', status: 'fehler', detail: 'Spiegel nicht schreibbar' })
    expect(e.offen[0]).toContain('export_ziel ist gescheitert')
    expect(s.a.uploads).toHaveLength(0)
    expect(s.ports.verwirf).not.toHaveBeenCalled()
  })

  it('ohne Twin-Dokument: nur die Datei plus Verweis, Familien-Schritte uebersprungen', async () => {
    const s = aufbau({ doc: null })
    const e = await uebergibFamilie(s.args, s.ports)
    const status = Object.fromEntries(e.schritte.map((x) => [x.schritt, x.status]))
    expect(status).toMatchObject({ import_herkunft: 'uebersprungen', quelle_kopiert: 'ok', segmente_kopiert: 'uebersprungen', export_ziel: 'uebersprungen', verweis_geschrieben: 'ok' })
    expect(s.ports.legeTwinAn).not.toHaveBeenCalled()
  })
})
