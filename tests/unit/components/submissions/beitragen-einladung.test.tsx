// @vitest-environment jsdom
/**
 * G4: Einladung zum Beitragen im geführten Profil — Anonyme sehen den Knopf
 * zur Anmeldung, Angemeldete den Erfassen-Knopf (rechte-gegated).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BeitragenEinladung } from '@/components/submissions/beitragen-einladung'

let mockUser = { isSignedIn: false, isLoaded: true }
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUser,
  SignInButton: ({ children }: { children: ReactNode }) => <div data-testid="sign-in">{children}</div>,
}))
vi.mock('@/components/submissions/capture-content-button', () => ({
  CaptureContentButton: ({ variant }: { variant?: string }) => <div data-testid="capture" data-variant={variant} />,
}))
vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts && 'defaultValue' in opts ? String(opts.defaultValue) : key),
    locale: 'de',
  }),
}))

describe('BeitragenEinladung', () => {
  afterEach(() => cleanup())

  it('anonym: Knopf „Beitragen" im Anmelde-Rahmen', () => {
    mockUser = { isSignedIn: false, isLoaded: true }
    render(<BeitragenEinladung libraryId="lib-1" />)
    expect(screen.getByTestId('sign-in')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Zum Beitragen anmelden' }).textContent).toContain('Beitragen')
    expect(screen.queryByTestId('capture')).toBeNull()
  })

  it('angemeldet: Erfassen-Knopf in der ruhigen Variante; ohne Library oder vor dem Laden nichts', () => {
    mockUser = { isSignedIn: true, isLoaded: true }
    render(<BeitragenEinladung libraryId="lib-1" />)
    expect(screen.getByTestId('capture').getAttribute('data-variant')).toBe('ruhig')
    expect(screen.queryByTestId('sign-in')).toBeNull()
    cleanup()
    mockUser = { isSignedIn: true, isLoaded: false }
    const { container } = render(<BeitragenEinladung libraryId="lib-1" />)
    expect(container.innerHTML).toBe('')
  })
})
