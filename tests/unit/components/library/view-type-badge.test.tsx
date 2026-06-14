// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ViewTypeBadge } from '@/components/library/view-type-badge'

afterEach(() => cleanup())

describe('ViewTypeBadge', () => {
  it('zeigt das Format-Label fuer gueltige Typen', () => {
    render(<ViewTypeBadge detailViewType="climateAction" />)
    expect(screen.getByText('Klimamaßnahme')).toBeTruthy()
  })

  it('rendert nichts fuer unbekannte oder fehlende Typen', () => {
    const { container } = render(<ViewTypeBadge detailViewType="nope" />)
    expect(container.textContent).toBe('')

    const { container: emptyContainer } = render(<ViewTypeBadge />)
    expect(emptyContainer.textContent).toBe('')
  })
})
