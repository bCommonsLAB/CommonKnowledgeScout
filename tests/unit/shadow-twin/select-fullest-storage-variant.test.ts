/**
 * Unit-Tests fuer `selectFullestStorageVariant`.
 *
 * Befund 2026-09-10: batch-resolve reichte einen per `{ ...provider }`
 * kopierten Provider an den Resolver. Die Methoden der Provider-Klassen liegen
 * auf dem Prototype und fehlten danach (u.a. `getBinary`); jede Variante galt
 * still als leer. Diese Tests halten fest: fehlende Methode = laut,
 * echter Lesefehler = toleriert, Request-Cache-Proxy = funktioniert.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import { FileLogger } from '@/lib/debug/logger'
import { selectFullestStorageVariant } from '@/lib/shadow-twin/select-fullest-storage-variant'
import { ShadowTwinProviderIncompleteError } from '@/lib/shadow-twin/errors'
import { withRequestStorageCache } from '@/lib/storage/provider-request-cache'

vi.mock('@/lib/debug/logger', () => ({
  FileLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

type BinaryReader = Pick<StorageProvider, 'getBinary'>

/** Methoden auf dem Prototype — genau wie bei den echten Provider-Klassen. */
class PrototypeBinaryProvider {
  constructor(private readonly contents: Record<string, string>) {}

  async getBinary(fileId: string): Promise<{ blob: Blob; mimeType: string }> {
    const content = this.contents[fileId]
    if (content === undefined) throw new Error(`404 Not Found: ${fileId}`)
    return { blob: new Blob([content]), mimeType: 'text/markdown' }
  }
}

function markdownItem(id: string, name: string): StorageItem {
  return {
    id,
    parentId: 'twin-folder',
    type: 'file',
    metadata: { name, size: 0, modifiedAt: new Date(0), mimeType: 'text/markdown' },
  }
}

const candidates = [
  markdownItem('de', '2026-03-09 Voice-test Oromo.de.md'),
  markdownItem('en', '2026-03-09 Voice-test Oromo.en.md'),
]
const contents = { de: 'kurz', en: 'deutlich laengerer Inhalt der Variante' }
const canonical = '2026-03-09 Voice-test Oromo.md'

describe('selectFullestStorageVariant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('waehlt ueber einen Klassen-Provider die vollstaendigste Variante', async () => {
    const provider = new PrototypeBinaryProvider(contents) as unknown as BinaryReader

    const { best } = await selectFullestStorageVariant(provider, candidates, canonical)

    expect(best?.ref.id).toBe('en')
  })

  it('wirft laut, wenn getBinary fehlt (per Spread kopierter Provider)', async () => {
    // Genau der Fehler aus batch-resolve: Spread kopiert nur eigene Felder.
    const spread = { ...new PrototypeBinaryProvider(contents) } as unknown as BinaryReader

    await expect(selectFullestStorageVariant(spread, candidates, canonical)).rejects.toBeInstanceOf(
      ShadowTwinProviderIncompleteError,
    )
    expect(FileLogger.warn).not.toHaveBeenCalled()
  })

  it('toleriert echte Lesefehler einzelner Varianten und meldet sie', async () => {
    const provider = new PrototypeBinaryProvider({ en: 'lesbar' }) as unknown as BinaryReader

    const { best } = await selectFullestStorageVariant(provider, candidates, canonical)

    expect(best?.ref.id).toBe('en')
    expect(FileLogger.warn).toHaveBeenCalledWith(
      'select-fullest-storage-variant',
      'Variante nicht lesbar – als leer gewertet',
      expect.objectContaining({ fileName: '2026-03-09 Voice-test Oromo.de.md' }),
    )
  })

  it('funktioniert mit dem Request-Cache-Proxy aus batch-resolve', async () => {
    const provider = withRequestStorageCache(
      new PrototypeBinaryProvider(contents) as unknown as StorageProvider,
    )

    const { best } = await selectFullestStorageVariant(provider, candidates, canonical)

    expect(best?.ref.id).toBe('en')
  })
})
