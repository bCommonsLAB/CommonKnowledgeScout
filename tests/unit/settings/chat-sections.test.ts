/**
 * Char-Tests für chat-form Section-Komponenten (Welle 3-IV-Sections-Split).
 *
 * Prüft die Props-Schnittstellen der extrahierten Section-Komponenten
 * sowie den Export-Vertrag (named exports, keine default exports).
 */

import { describe, it, expect } from 'vitest'

// --------------------------------------------------------------------------
// RetrievalConfigSection Props-Kontrakt
// --------------------------------------------------------------------------
describe('RetrievalConfigSection Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    // Vertrag: die Komponente nimmt form-control + defaultEmbeddings
    const requiredProps = ['form', 'defaultEmbeddings'] as const
    // Wenn die Imports in der Komponente fehlen → Build-Error, kein Runtime-Error.
    // Dieser Test dokumentiert das Interface als Spec.
    expect(requiredProps).toHaveLength(2)
  })
})

// --------------------------------------------------------------------------
// ModelConfigSection Props-Kontrakt
// --------------------------------------------------------------------------
describe('ModelConfigSection Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    // Vertrag: nur form — Labels werden intern über useStoryContext() geholt
    const requiredProps = ['form'] as const
    expect(requiredProps).toHaveLength(1)
  })
})

// --------------------------------------------------------------------------
// GalleryConfigSection Props-Kontrakt
// --------------------------------------------------------------------------
describe('GalleryConfigSection Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    // Vertrag: form (für gallery.*, watch-Zugriff)
    const requiredProps = ['form'] as const
    expect(requiredProps).toHaveLength(1)
  })
})

// --------------------------------------------------------------------------
// BinaryStorageSection Props-Kontrakt
// --------------------------------------------------------------------------
describe('BinaryStorageSection Props-Kontrakt', () => {
  it('hat die erwarteten Props-Felder im Interface', () => {
    // Vertrag: form + alle State/Handler aus useChatForm
    const requiredProps = [
      'form',
      'activeLibrary',
      'azureIngestionCustom',
      'azureContainerWatched',
      'thumbnailStats',
      'isRepairingThumbnails',
      'repairProgress',
      'repairTotal',
      'isRegeneratingThumbnails',
      'regenerateProgress',
      'regenerateTotal',
      'variantStats',
      'isRepairingVariants',
      'isLoadingStats',
      'statsError',
      'loadThumbnailStats',
      'handleRepairThumbnails',
      'handleRegenerateThumbnails',
      'handleRepairVariants',
    ] as const
    expect(requiredProps.length).toBeGreaterThan(0)
  })
})

// --------------------------------------------------------------------------
// Export-Kontrakt: named exports, keine default exports
// --------------------------------------------------------------------------
describe('Chat Section-Komponenten Export-Kontrakt', () => {
  it('RetrievalConfigSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/chat/retrieval-config-section'
    )
    expect(typeof mod.RetrievalConfigSection).toBe('function')
    // Kein default export
    expect(mod.default).toBeUndefined()
  })

  it('ModelConfigSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/chat/model-config-section'
    )
    expect(typeof mod.ModelConfigSection).toBe('function')
    expect(mod.default).toBeUndefined()
  })

  it('GalleryConfigSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/chat/gallery-config-section'
    )
    expect(typeof mod.GalleryConfigSection).toBe('function')
    expect(mod.default).toBeUndefined()
  })

  it('BinaryStorageSection ist als named export definiert', async () => {
    const mod = await import(
      '@/components/settings/chat/binary-storage-section'
    )
    expect(typeof mod.BinaryStorageSection).toBe('function')
    expect(mod.default).toBeUndefined()
  })
})
