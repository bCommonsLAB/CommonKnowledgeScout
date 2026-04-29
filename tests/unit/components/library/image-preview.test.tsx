// @vitest-environment jsdom

/**
 * Characterization Tests fuer `ImagePreview` (Welle 3-II, Schritt 3).
 *
 * Fixiert das Render-Verhalten:
 * - Render ohne Crash, wenn provider=null
 * - Render ohne Crash, wenn kein selectedFile-Atom-Eintrag
 *
 * ImageTransform-Sub-Komponente ist gemockt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { ImagePreview } from '@/components/library/image-preview'
import { selectedFileAtom } from '@/atoms/library-atom'
import type { StorageItem } from '@/lib/storage/types'

vi.mock('@/components/library/image-transform', () => ({
  ImageTransform: () => <div data-testid="image-transform-mock" />,
}))

function makeFile(): StorageItem {
  return {
    id: 'img-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'foto.jpg',
      size: 1234,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'image/jpeg',
    },
  }
}

describe('ImagePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('rendert ohne Crash, wenn provider=null und kein File ausgewaehlt', () => {
    const store = createStore()
    expect(() => {
      render(
        <Provider store={store}>
          <ImagePreview provider={null} activeLibraryId="lib-1" />
        </Provider>
      )
    }).not.toThrow()
  })

  it('rendert ohne Crash, wenn provider=null und ein File ausgewaehlt ist', () => {
    const store = createStore()
    store.set(selectedFileAtom, makeFile())
    expect(() => {
      render(
        <Provider store={store}>
          <ImagePreview provider={null} activeLibraryId="lib-1" />
        </Provider>
      )
    }).not.toThrow()
  })

  it('rendert ohne Crash, wenn showTransformControls=false', () => {
    const store = createStore()
    store.set(selectedFileAtom, makeFile())
    expect(() => {
      render(
        <Provider store={store}>
          <ImagePreview
            provider={null}
            activeLibraryId="lib-1"
            showTransformControls={false}
          />
        </Provider>
      )
    }).not.toThrow()
  })
})
