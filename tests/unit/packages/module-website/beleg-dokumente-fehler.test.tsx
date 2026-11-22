// @vitest-environment jsdom
/**
 * Zitierte Dokumente der Story-Sektion (23.11.2026): Scheitert das Laden, meldet der Hook
 * `fehler` statt still eine leere Liste; `erneut` laedt noch einmal.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { InstanceApi } from '@ks/api-client'
import type { DocReference } from '@ks/contracts'
import { useBelegDokumenteStand } from '@ks/module-website/react'

afterEach(cleanup)

const refs = [{ number: 1, fileId: 'a' }] as DocReference[]
const kopf = {}

function instanzMit(fetch: ReturnType<typeof vi.fn>): InstanceApi {
  return { fetch } as unknown as InstanceApi
}

describe('useBelegDokumenteStand', () => {
  it('meldet einen Fehler, wenn das Laden scheitert, und laedt mit erneut nach', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ fileId: 'a', title: 'A' }] }), { status: 200 }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const instanz = instanzMit(fetch) // stabil: eine neue Instanz je Render laedt neu
    const { result } = renderHook(() => useBelegDokumenteStand(instanz, 'lib', refs, kopf))
    await waitFor(() => expect(result.current.fehler).toBe(true))
    expect(result.current.laedt).toBe(false)
    expect(result.current.docs).toEqual([])

    act(() => result.current.erneut())
    expect(result.current.laedt).toBe(true)
    await waitFor(() => expect(result.current.docs).toHaveLength(1))
    expect(result.current.fehler).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('wertet eine Antwort ohne items als Fehler, nicht als leere Liste', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const instanz = instanzMit(fetch) // stabil: eine neue Instanz je Render laedt neu
    const { result } = renderHook(() => useBelegDokumenteStand(instanz, 'lib', refs, kopf))
    await waitFor(() => expect(result.current.fehler).toBe(true))
  })
})
