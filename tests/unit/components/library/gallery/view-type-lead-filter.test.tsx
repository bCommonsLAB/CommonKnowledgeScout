// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { ViewTypeLeadFilter } from '@/components/library/gallery/view-type-lead-filter'

afterEach(() => cleanup())

describe('ViewTypeLeadFilter', () => {
  it('rendert nichts bei < 2 Typen (Einzeltyp-Library)', () => {
    const { container } = render(
      <ViewTypeLeadFilter viewTypes={['book']} selected={null} onSelect={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('zeigt „Alle" + lesbare Labels bei gemischter Library', () => {
    render(<ViewTypeLeadFilter viewTypes={['book', 'session']} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('Alle')).toBeTruthy()
    expect(screen.getByText('Buch')).toBeTruthy()
    expect(screen.getByText('Session')).toBeTruthy()
  })

  it('meldet die Typ-Wahl bzw. „Alle" (null)', () => {
    const onSelect = vi.fn()
    render(<ViewTypeLeadFilter viewTypes={['book', 'session']} selected={'book'} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Session'))
    expect(onSelect).toHaveBeenCalledWith('session')
    fireEvent.click(screen.getByText('Alle'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('faellt fuer unbekannte Typen auf den Roh-Schluessel zurueck', () => {
    render(<ViewTypeLeadFilter viewTypes={['book', 'mystery']} selected={null} onSelect={() => {}} />)
    expect(screen.getByText('mystery')).toBeTruthy()
  })
})
