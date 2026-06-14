// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LibraryVerificationWarningView } from '@/components/library/library-verification-warning'

afterEach(() => cleanup())

describe('LibraryVerificationWarningView', () => {
  it('zeigt nichts fuer gepruefte Library', () => {
    const { container } = render(
      <LibraryVerificationWarningView status="verified" context="publish" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('warnt beim Veroeffentlichen, wenn nicht geprueft', () => {
    render(<LibraryVerificationWarningView status="unchecked" context="publish" />)
    expect(screen.getByText('Vor dem Veröffentlichen prüfen')).toBeTruthy()
  })

  it('warnt beim Oeffnen einer oeffentlichen Library, wenn reparaturbeduerftig', () => {
    render(<LibraryVerificationWarningView status="needs-repair" context="public-open" />)
    expect(screen.getByText('Diese Bibliothek ist noch nicht geprüft')).toBeTruthy()
  })
})
