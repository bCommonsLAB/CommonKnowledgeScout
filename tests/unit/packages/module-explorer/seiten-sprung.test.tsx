// @vitest-environment jsdom

/**
 * Sprung auf die Seite in der Detailansicht (D7): Der Hook sucht den Anker
 * `[data-page-marker]` (Markdown) oder `[data-page]` (PDF) im Viewport der
 * ScrollArea, versucht es mehrfach (Inhalt laedt nach) und scrollt dorthin;
 * ohne Seite oder vor dem Laden tut er nichts.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { useRef } from 'react'
import { seitenAnker, useSeitenSprung } from '../../../../packages/module-explorer/src/gallery/components/detail-overlay/seiten-sprung'

function Probe({ page, bereit, anker }: { page?: number; bereit: boolean; anker: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useSeitenSprung(page, ref, bereit)
  return (
    <div ref={ref}>
      <div data-radix-scroll-area-viewport="">
        {anker && <div data-page-marker="3">Seite 3</div>}
      </div>
    </div>
  )
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('seitenAnker', () => {
  it('findet Markdown- und PDF-Anker', () => {
    const w = document.createElement('div')
    w.innerHTML = '<div data-page-marker="2"></div><canvas data-page="5"></canvas>'
    expect(seitenAnker(w, 2)?.tagName).toBe('DIV')
    expect(seitenAnker(w, 5)?.tagName).toBe('CANVAS')
    expect(seitenAnker(w, 9)).toBeNull()
  })
})

describe('useSeitenSprung', () => {
  it('scrollt den Viewport zum Anker, sobald er bereit ist — und nur einmal', () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    render(<Probe page={3} bereit anker />)
    vi.advanceTimersByTime(10)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(scrollTo).toHaveBeenCalledTimes(1)
  })

  it('ohne Seite oder nicht bereit: kein Sprung; fehlender Anker wird einmal gemeldet', () => {
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rerender } = render(<Probe bereit anker />)
    vi.advanceTimersByTime(5000)
    rerender(<Probe page={3} bereit={false} anker />)
    vi.advanceTimersByTime(5000)
    expect(scrollTo).not.toHaveBeenCalled()
    rerender(<Probe page={3} bereit anker={false} />)
    vi.advanceTimersByTime(5000)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
