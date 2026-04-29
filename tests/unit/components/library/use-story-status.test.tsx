// @vitest-environment jsdom

/**
 * Characterization Tests fuer `useStoryStatus` (Welle 3-II, Schritt 3).
 *
 * Fixiert:
 * - 3 Steps werden zurueckgegeben (text, transform, publish)
 * - Step-State `missing` wenn keine Daten
 * - Step-State `present` wenn Transcript bzw. Transformation vorhanden
 * - Publish-Step bleibt `missing`, wenn weder Transcript noch Transformation
 *   vorhanden sind (kein API-Call, kein Loading)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import * as React from 'react'
import { useStoryStatus } from '@/components/library/shared/use-story-status'
import type { StorageItem } from '@/lib/storage/types'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // global.fetch verhindert echte API-Calls. Default: Promise haengt
  // (kein Resolve) — wir testen NUR den Initial-State.
  global.fetch = fetchMock as unknown as typeof fetch
  fetchMock.mockReturnValue(new Promise(() => undefined))
})

afterEach(() => {
  cleanup()
})

function makeFile(): StorageItem {
  return {
    id: 'file-1',
    parentId: 'root',
    type: 'file',
    metadata: {
      name: 'audio.mp3',
      size: 100,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'audio/mpeg',
    },
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const store = createStore()
  return <Provider store={store}>{children}</Provider>
}

describe('useStoryStatus', () => {
  it('liefert 3 Steps zurueck (text, transform, publish)', () => {
    const { result } = renderHook(
      () => useStoryStatus({
        libraryId: 'lib-1',
        file: makeFile(),
        shadowTwinState: undefined,
      }),
      { wrapper }
    )
    expect(result.current.steps).toHaveLength(3)
    expect(result.current.steps.map(s => s.id)).toEqual(['text', 'transform', 'publish'])
  })

  it('alle Steps sind missing, wenn shadowTwinState undefined ist', () => {
    const { result } = renderHook(
      () => useStoryStatus({
        libraryId: 'lib-1',
        file: makeFile(),
        shadowTwinState: undefined,
      }),
      { wrapper }
    )
    expect(result.current.steps[0].state).toBe('missing')
    expect(result.current.steps[1].state).toBe('missing')
    expect(result.current.steps[2].state).toBe('missing')
  })

  it('text-Step ist present, wenn transcriptFiles vorhanden sind', () => {
    const transcript = makeFile()
    const { result } = renderHook(
      () => useStoryStatus({
        libraryId: 'lib-1',
        file: makeFile(),
        shadowTwinState: {
          baseItem: makeFile(),
          transcriptFiles: [transcript],
        } as Parameters<typeof useStoryStatus>[0]['shadowTwinState'],
      }),
      { wrapper }
    )
    expect(result.current.steps[0].state).toBe('present')
  })

  it('transform-Step ist present, wenn transformed vorhanden ist', () => {
    const transformed = makeFile()
    const { result } = renderHook(
      () => useStoryStatus({
        libraryId: 'lib-1',
        file: makeFile(),
        shadowTwinState: {
          baseItem: makeFile(),
          transformed,
        } as Parameters<typeof useStoryStatus>[0]['shadowTwinState'],
      }),
      { wrapper }
    )
    expect(result.current.steps[1].state).toBe('present')
  })

  it('publish-Step bleibt missing ohne Transcript/Transformation (kein fetch)', () => {
    renderHook(
      () => useStoryStatus({
        libraryId: 'lib-1',
        file: makeFile(),
        shadowTwinState: undefined,
      }),
      { wrapper }
    )
    // Da weder hasText noch hasTransform: shouldFetchPublish=false → kein fetch
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
