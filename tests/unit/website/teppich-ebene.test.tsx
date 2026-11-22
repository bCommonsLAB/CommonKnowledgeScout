// @vitest-environment jsdom
/**
 * Teppich der Dokumente als Ebene der Fragen-Sektion (Plan `teppich-der-dokumente`, T2):
 * Punkte laden, Titel beim Ueberfahren, Klick auf einen Punkt oeffnet das Dokument,
 * Klick ins Leere blendet den Vordergrund aus, Escape holt ihn zurueck.
 *
 * jsdom zeichnet nicht: `getContext` liefert null, die Flaeche ist 800 × 400, die
 * Leinwand liegt bei (0, 0). Ein einzelner Punkt in der Mitte steht dann bei (400, 200).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SAME_ORIGIN_API } from '@ks/api-client'
import { WebsiteTeppichEbene } from '@ks/module-website/react'

const PUNKT = { fileId: 'f1', x: 0.5, y: 0.5, gewicht: 0.5, jahr: 2024, titel: 'Vortrag über Wasser' }

function antwort(zustand: string, items: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ zustand, stand: null, gesamt: items.length || 3, ohneLage: 0, items }) }
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    constructor(private cb: (e: Array<{ contentRect: { width: number; height: number } }>) => void) {}
    observe() { this.cb([{ contentRect: { width: 800, height: 400 } }]) }
    disconnect() {}
  })
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
    observe() { this.cb([{ isIntersecting: true }]) }
    disconnect() {}
  })
  // Reduzierte Bewegung: ein Bild statt Schleife.
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  // Der Teppich misst die Flaeche, auf der er liegt; jsdom kennt keine Lage, also 800 × 400 bei (0, 0).
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 400, width: 800, height: 400, toJSON: () => ({}) } as DOMRect,
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function zeichne(props: Partial<Parameters<typeof WebsiteTeppichEbene>[0]> = {}) {
  const onDokument = vi.fn()
  const onAbgetaucht = vi.fn()
  const r = render(
    <WebsiteTeppichEbene instanz={SAME_ORIGIN_API} libraryId="lib-1" abgetaucht={false} onAbgetaucht={onAbgetaucht} onDokument={onDokument} {...props} />,
  )
  const leinwand = r.container.querySelector('canvas') as HTMLCanvasElement
  return { ...r, leinwand, onDokument, onAbgetaucht }
}

describe('Teppich-Ebene', () => {
  it('zeigt beim Ueberfahren Titel und Jahr und oeffnet den Punkt beim Klick', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/teppich')) return antwort('bereit', [PUNKT])
      expect(String(url)).toContain('/api/chat/lib-1/docs/by-fileids?fileId=f1')
      return { ok: true, status: 200, json: async () => ({ items: [{ id: 'f1', fileId: 'f1', title: 'Vortrag über Wasser' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { leinwand, onDokument, container } = zeichne()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await waitFor(() => {
      fireEvent.pointerMove(leinwand, { clientX: 402, clientY: 198 })
      expect(screen.getByText('Vortrag über Wasser')).toBeTruthy()
    })
    expect(screen.getByText('2024')).toBeTruthy()
    expect(container.querySelector('[data-teppich-tooltip]')).not.toBeNull()

    fireEvent.click(leinwand, { clientX: 400, clientY: 200 })
    await waitFor(() => expect(onDokument).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'f1' })))
  })

  it('Klick auf eine freie Stelle blendet den Vordergrund aus; Escape holt ihn zurueck', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => antwort('bereit', [PUNKT])))
    const erst = zeichne()
    fireEvent.click(erst.leinwand, { clientX: 30, clientY: 30 })
    expect(erst.onAbgetaucht).toHaveBeenCalledWith(true)
    expect(erst.onDokument).not.toHaveBeenCalled()
    cleanup()

    const zweit = zeichne({ abgetaucht: true })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(zweit.onAbgetaucht).toHaveBeenCalledWith(false)
  })

  it('ohne berechneten Teppich bleibt die Ebene leer und die Konsole sagt es', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn(async () => antwort('nicht_berechnet', [])))
    const { leinwand, container } = zeichne()
    await waitFor(() => expect(warnung).toHaveBeenCalledWith(expect.stringContaining('noch nicht berechnet')))
    fireEvent.pointerMove(leinwand, { clientX: 400, clientY: 200 })
    expect(container.querySelector('[data-teppich-tooltip]')).toBeNull()
    warnung.mockRestore()
  })
})
