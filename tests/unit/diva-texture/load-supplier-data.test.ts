import { describe, it, expect } from 'vitest'
import { loadSupplierData, SIDECAR_FILENAME } from '@/lib/diva-texture/load-supplier-data'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'

function makeFile(id: string, name: string): StorageItem {
  return {
    id,
    parentId: 'folder',
    type: 'file',
    metadata: { name, size: 0, modifiedAt: new Date(), mimeType: 'application/octet-stream' },
  }
}

/**
 * Minimaler Fake-Provider: nur listItemsById + getBinary werden vom Loader
 * benoetigt. Restliche Interface-Methoden bleiben unbenutzt.
 */
function makeProvider(items: StorageItem[], sidecarJson: string): StorageProvider {
  const provider: Partial<StorageProvider> = {
    listItemsById: async () => items,
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

describe('loadSupplierData', () => {
  it('gibt null zurueck, wenn keine Sidecar-Datei vorhanden ist', async () => {
    const provider = makeProvider([makeFile('1', '3_ST_1_basecolor.jpg')], SIDECAR_CONTENT)
    const result = await loadSupplierData(provider, 'folder')
    expect(result).toBeNull()
  })

  it('laedt nur IsTexture === "True"-Eintraege (Edge-Case #3)', async () => {
    const items = [makeFile('1', '3_ST_1_basecolor.jpg'), makeFile('2', SIDECAR_FILENAME)]
    const provider = makeProvider(items, SIDECAR_CONTENT)
    const result = await loadSupplierData(provider, 'folder')
    expect(result).not.toBeNull()
    expect(result?.sourceFileName).toBe(SIDECAR_FILENAME)
    expect(result?.entries).toHaveLength(1)
    expect(result?.entries[0].entry.VCodex).toBe('ST-1')
    // Die beiden IsTexture=False-Eintraege werden ignoriert + gezaehlt.
    expect(result?.ignoredNonTextureCount).toBe(2)
  })

  it('wirft bei fehlendem Optionvalues-Objekt (kein stiller Fallback)', async () => {
    const items = [makeFile('2', SIDECAR_FILENAME)]
    const provider = makeProvider(items, JSON.stringify({ foo: 'bar' }))
    await expect(loadSupplierData(provider, 'folder')).rejects.toThrow(/Optionvalues/)
  })
})
