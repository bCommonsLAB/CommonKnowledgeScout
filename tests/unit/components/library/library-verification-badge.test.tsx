// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LibraryVerificationBadgeView } from '@/components/library/library-verification-badge'

afterEach(() => cleanup())

describe('LibraryVerificationBadgeView', () => {
  it('zeigt das passende Label je Status', () => {
    const { rerender } = render(<LibraryVerificationBadgeView status="verified" />)
    expect(screen.getByText('Geprüft')).toBeTruthy()

    rerender(<LibraryVerificationBadgeView status="needs-repair" />)
    expect(screen.getByText('Reparaturbedürftig')).toBeTruthy()

    rerender(<LibraryVerificationBadgeView status="unchecked" />)
    expect(screen.getByText('Ungeprüft')).toBeTruthy()
  })
})
