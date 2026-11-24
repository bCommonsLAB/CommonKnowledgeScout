// @vitest-environment jsdom
/**
 * Ueberlagerungen der Fragen-Sektion (Owner 24.11.2026): die Zurueck-Taste schliesst sie (App-Teil
 * `zurueckTaste`, Paket-Teil `useZurueckTaste`), und ein Vorfahr mit `transform` haelt sie auf der
 * Flaeche der Sektion (`faengtFestes`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { faengtFestes, useZurueckTaste } from '@ks/module-website/react'
import { zurueckTaste } from '@/components/library/website/story/zurueck-taste'

afterEach(() => cleanup())

/** jsdom meldet `popstate` nach `history.back()` nicht sofort: einen Takt warten. */
const takt = () => new Promise((r) => setTimeout(r, 20))

describe('zurueckTaste (App)', () => {
  it('Zurueck schliesst die zuletzt geoeffnete Ueberlagerung, dann die davor', async () => {
    const vollbild = vi.fn()
    const graph = vi.fn()
    const vorher = window.history.length
    const abVollbild = zurueckTaste(vollbild)
    const abGraph = zurueckTaste(graph)
    expect(window.history.length).toBe(vorher + 2)
    window.history.back()
    await takt()
    expect(graph).toHaveBeenCalledTimes(1)
    expect(vollbild).not.toHaveBeenCalled()
    // Abmelden nach dem Schliessen per Zurueck-Taste: kein weiterer Schritt zurueck.
    abGraph(true)
    await takt()
    expect(vollbild).not.toHaveBeenCalled()
    window.history.back()
    await takt()
    expect(vollbild).toHaveBeenCalledTimes(1)
    abVollbild(true)
  })

  it('Schliessen per Knopf nimmt den Schritt aus der Chronik, ohne `onZurueck` zu rufen', async () => {
    const onZurueck = vi.fn()
    const ab = zurueckTaste(onZurueck)
    const zurueck = vi.spyOn(window.history, 'back')
    ab(true)
    await takt()
    expect(zurueck).toHaveBeenCalledTimes(1)
    expect(onZurueck).not.toHaveBeenCalled()
    zurueck.mockRestore()
  })

  it('Aushaengen der Sektion laesst die Chronik, wie sie ist', async () => {
    const zurueck = vi.spyOn(window.history, 'back')
    zurueckTaste(vi.fn())(false)
    await takt()
    expect(zurueck).not.toHaveBeenCalled()
    zurueck.mockRestore()
  })
})

describe('useZurueckTaste (Paket)', () => {
  function Probe({ offen, taste, zu }: { offen: boolean; taste?: Parameters<typeof useZurueckTaste>[0]; zu: () => void }) {
    useZurueckTaste(taste, offen, zu)
    return null
  }

  it('meldet beim Oeffnen an; Schliessen meldet mit Schritt ab, Aushaengen ohne', () => {
    const abmelden = vi.fn()
    const taste = vi.fn(() => abmelden)
    const { rerender, unmount } = render(<Probe offen={false} taste={taste} zu={() => {}} />)
    expect(taste).not.toHaveBeenCalled()
    rerender(<Probe offen taste={taste} zu={() => {}} />)
    expect(taste).toHaveBeenCalledTimes(1)
    rerender(<Probe offen={false} taste={taste} zu={() => {}} />)
    expect(abmelden).toHaveBeenLastCalledWith(true)
    rerender(<Probe offen taste={taste} zu={() => {}} />)
    unmount()
    expect(abmelden).toHaveBeenLastCalledWith(false)
  })

  it('die Zurueck-Taste ruft das aktuelle `schliessen`; ohne Gastgeber-Funktion passiert nichts', () => {
    let zurueck: (() => void) | undefined
    const taste = vi.fn((f: () => void) => { zurueck = f; return vi.fn() })
    const alt = vi.fn()
    const neu = vi.fn()
    const { rerender } = render(<Probe offen taste={taste} zu={alt} />)
    rerender(<Probe offen taste={taste} zu={neu} />)
    zurueck?.()
    expect(neu).toHaveBeenCalledTimes(1)
    expect(alt).not.toHaveBeenCalled()
    expect(() => render(<Probe offen zu={() => {}} />)).not.toThrow()
  })
})

describe('faengtFestes', () => {
  function baum(stil: string): HTMLElement {
    document.body.innerHTML = `<div id="aussen" style="${stil}"><div><section id="ziel"></section></div></div>`
    return document.getElementById('ziel') as HTMLElement
  }

  it('ohne besonderen Vorfahr haengt Festes am Bildschirm', () => {
    expect(faengtFestes(baum(''))).toBe(false)
    expect(faengtFestes(baum('transform: none; filter: none'))).toBe(false)
  })

  it('ein Vorfahr mit transform, filter oder contain faengt es', () => {
    expect(faengtFestes(baum('transform: translateX(0)'))).toBe(true)
    expect(faengtFestes(baum('filter: blur(0)'))).toBe(true)
    expect(faengtFestes(baum('contain: layout'))).toBe(true)
    expect(faengtFestes(baum('will-change: transform'))).toBe(true)
  })
})
