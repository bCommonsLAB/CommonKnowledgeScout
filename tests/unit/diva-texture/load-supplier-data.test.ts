import { describe, it, expect } from 'vitest'
import {
  loadSupplierData,
  resolveTextureDirectoryId,
  resolveGrandparentFolderId,
  SIDECAR_FILENAME,
} from '@/lib/diva-texture/load-supplier-data'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

const MODIFIED_AT = new Date('2026-06-30T12:23:00.000Z')

function makeFolder(id: string, parentId: string, name: string): StorageItem {
  return {
    id,
    parentId,
    type: 'folder',
    metadata: { name, size: 0, modifiedAt: new Date(), mimeType: 'application/folder' },
  }
}

function makeFile(
  id: string,
  name: string,
  parentId: string,
  modifiedAt: Date = new Date(),
): StorageItem {
  return {
    id,
    parentId,
    type: 'file',
    metadata: { name, size: 0, modifiedAt, mimeType: 'application/octet-stream' },
  }
}

/**
 * Fake-Provider mit Ordnerkette ILN → textures → _tex.
 * Sidecar liegt standardmaessig im Grosseltern-Ordner (ILN).
 */
function makeHierarchyProvider(args: {
  sidecarJson: string
  sidecarName?: string
  sidecarParentId?: string
  includeSidecar?: boolean
}): StorageProvider {
  const {
    sidecarJson,
    sidecarName = SIDECAR_FILENAME,
    sidecarParentId = 'iln',
    includeSidecar = true,
  } = args

  const folders = [
    makeFolder('iln', 'root', '7609999144608'),
    makeFolder('textures', 'iln', 'textures'),
    makeFolder('tex', 'textures', '_tex'),
  ]
  const files: StorageItem[] = [makeFile('tex-1', '3_ST_1_basecolor.jpg', 'tex')]
  if (includeSidecar) {
    files.push(makeFile('sidecar', sidecarName, sidecarParentId, MODIFIED_AT))
  }
  const all = [...folders, ...files]

  const provider: Partial<StorageProvider> = {
    listItemsById: async (folderId: string) => all.filter((it) => it.parentId === folderId),
    getItemById: async (id: string) => {
      const found = all.find((it) => it.id === id)
      if (!found) throw new Error(`Item ${id} nicht gefunden`)
      return found
    },
    getBinary: async () => ({ blob: new Blob([sidecarJson]), mimeType: 'application/json' }),
  }
  return provider as StorageProvider
}

const SIDECAR_CONTENT = JSON.stringify({
  Optionvalues: {
    OPV_TEX: { VCodex: 'ST-1', IsTexture: 'True', Name: 'Feincord thyme', PFTFile: '3_ST_1' },
    OPV_FOOT: { VCodex: 'X-SF', IsTexture: 'False', Name: 'Anschluss Stuetzfuss' },
    OPV_PRICE: { VCodex: 'PG', IsTexture: 'False', Name: 'Preisgruppe' },
  },
})

describe('resolveGrandparentFolderId', () => {
  it('liefert den Grosseltern-Ordner zwei Ebenen ueber dem Texturordner', async () => {
    const provider = makeHierarchyProvider({ sidecarJson: SIDECAR_CONTENT })
    await expect(resolveGrandparentFolderId(provider, 'tex')).resolves.toBe('iln')
  })

  it('gibt null zurueck, wenn kein Grosseltern-Ordner existiert', async () => {
    const provider = makeHierarchyProvider({ sidecarJson: SIDECAR_CONTENT })
    // 'textures' hat Grosseltern 'root' — root gilt nicht als nutzbarer Ordner.
    await expect(resolveGrandparentFolderId(provider, 'textures')).resolves.toBeNull()
  })
})

describe('loadSupplierData', () => {
  it('gibt null zurueck, wenn keine Sidecar-Datei im Grosseltern-Ordner liegt', async () => {
    const provider = makeHierarchyProvider({ sidecarJson: SIDECAR_CONTENT, includeSidecar: false })
    const result = await loadSupplierData(provider, 'tex')
    expect(result).toBeNull()
  })

  it('laedt optionvalues.json aus dem Grosseltern-Ordner (IsTexture === "True" + PFTFile)', async () => {
    const provider = makeHierarchyProvider({ sidecarJson: SIDECAR_CONTENT })
    const result = await loadSupplierData(provider, 'tex')
    expect(result).not.toBeNull()
    expect(result?.sourceFileName).toBe(SIDECAR_FILENAME)
    expect(result?.modifiedAt.toISOString()).toBe(MODIFIED_AT.toISOString())
    expect(result?.entries).toHaveLength(1)
    expect(result?.entries[0].entry.PFTFile).toBe('3_ST_1')
    expect(result?.ignoredNonTextureCount).toBe(2)
  })

  it('akzeptiert Textur-Eintraege ohne VCodex, wenn PFTFile gesetzt ist', async () => {
    const content = JSON.stringify({
      Optionvalues: {
        OPV_TEX: { IsTexture: 'True', Name: 'Perla stone', PFTFile: '10_perla_stone' },
      },
    })
    const provider = makeHierarchyProvider({ sidecarJson: content })
    const result = await loadSupplierData(provider, 'tex')
    expect(result?.entries).toHaveLength(1)
    expect(result?.entries[0].entry.PFTFile).toBe('10_perla_stone')
  })

  it('ignoriert IsTexture === "True" ohne PFTFile (kein Schluessel)', async () => {
    const content = JSON.stringify({
      Optionvalues: {
        OPV_TEX: { VCodex: 'ST-1', IsTexture: 'True', Name: 'ohne PFT' },
      },
    })
    const provider = makeHierarchyProvider({ sidecarJson: content })
    const result = await loadSupplierData(provider, 'tex')
    expect(result?.entries).toHaveLength(0)
  })

  it('ignoriert optionvalues.json im Texturordner selbst', async () => {
    const provider = makeHierarchyProvider({
      sidecarJson: SIDECAR_CONTENT,
      sidecarParentId: 'tex',
    })
    const result = await loadSupplierData(provider, 'tex')
    expect(result).toBeNull()
  })

  it('ignoriert den Legacy-Dateinamen api2_GetJsonOptionValues.json', async () => {
    const provider = makeHierarchyProvider({
      sidecarJson: SIDECAR_CONTENT,
      sidecarName: 'api2_GetJsonOptionValues.json',
    })
    const result = await loadSupplierData(provider, 'tex')
    expect(result).toBeNull()
  })

  it('wirft bei fehlendem Optionvalues-Objekt (kein stiller Fallback)', async () => {
    const provider = makeHierarchyProvider({
      sidecarJson: JSON.stringify({ foo: 'bar' }),
    })
    await expect(loadSupplierData(provider, 'tex')).rejects.toThrow(/Optionvalues/)
  })
})

describe('resolveTextureDirectoryId', () => {
  it('liefert parentId der Textur-Datei', async () => {
    const provider = makeHierarchyProvider({ sidecarJson: SIDECAR_CONTENT })
    const dirId = await resolveTextureDirectoryId(provider, 'tex-1')
    expect(dirId).toBe('tex')
  })

  it('wirft, wenn die Textur kein parentId hat', async () => {
    const orphan: StorageItem = {
      id: 'orphan',
      parentId: '',
      type: 'file',
      metadata: { name: 'x.jpg', size: 0, modifiedAt: new Date(), mimeType: 'image/jpeg' },
    }
    const provider: Partial<StorageProvider> = {
      getItemById: async () => orphan,
    }
    await expect(
      resolveTextureDirectoryId(provider as StorageProvider, 'orphan'),
    ).rejects.toThrow(/parentId/)
  })
})
