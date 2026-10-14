// @vitest-environment jsdom

/**
 * Characterization Tests fuer `CreateLibraryDialog` — seit C2 (Plan
 * speicher-verbindungen-und-library-anlage) der Anlege-Wizard.
 *
 * Fixiert:
 *
 * - Dialog rendert Titel, Schritt 1 (Name, Inhaltstyp) und blockiert „Weiter",
 *   solange Pflichtangaben fehlen.
 * - Die Vorlage-Library (Nachfolger des Klon-Haekchens) erscheint nur, wenn
 *   eine Library gleichen Inhaltstyps existiert.
 * - Abbrechen ruft `onOpenChange(false)` auf.
 *
 * Keine echten API-Calls (`fetch` wird gemockt).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { CreateLibraryDialog } from '@/components/library/create-library-dialog'
import { seedLibrarySelection } from '@ks/shell/testing'
import type { ClientLibrary } from '@/types/library'

vi.mock('@ks/ui', async (orig) => ({
  ...(await orig<typeof import('@ks/ui')>()),
  toast: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

function makeLibrary(overrides: Partial<ClientLibrary> = {}): ClientLibrary {
  return {
    id: 'lib-existing', label: 'Existing Library', type: 'local', path: '/tmp', isEnabled: true,
    config: { chat: { gallery: { detailViewType: 'book' } } },
    ...overrides,
  } as ClientLibrary
}

function renderDialog(store = createStore(), onOpenChange = () => {}) {
  return render(
    <Provider store={store}>
      <CreateLibraryDialog open={true} onOpenChange={onOpenChange} />
    </Provider>,
  )
}

describe('CreateLibraryDialog (Anlege-Wizard)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ connections: [] }))))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('rendert Titel und Schritt Grundlagen; Weiter erst mit Name und Inhaltstyp', () => {
    renderDialog()
    expect(screen.getByText('Neue Bibliothek erstellen')).toBeTruthy()
    expect(screen.getByText(/Schritt 1 von/)).toBeTruthy()
    const weiter = screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement
    expect(weiter.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Neues Archiv' } })
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent?.includes('Buch') || b.textContent?.includes('Dokument')) as HTMLElement)
    expect((screen.getByRole('button', { name: 'Weiter' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('rendert nichts, wenn open=false', () => {
    render(
      <Provider store={createStore()}>
        <CreateLibraryDialog open={false} onOpenChange={() => {}} />
      </Provider>,
    )
    expect(screen.queryByText('Neue Bibliothek erstellen')).toBeNull()
  })

  it('zeigt die Vorlage-Library nur, wenn eine Library gleichen Typs existiert', () => {
    const store = createStore()
    seedLibrarySelection(store, { libraries: [makeLibrary({ id: 'lib-1', label: 'Quelle' })], activeLibraryId: 'lib-1' })
    renderDialog(store)
    expect(screen.queryByLabelText(/Konfiguration einer bestehenden Bibliothek/)).toBeNull()
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent?.includes('Buch') || b.textContent?.includes('Dokument')) as HTMLElement)
    expect(screen.getByLabelText(/Konfiguration einer bestehenden Bibliothek/)).toBeTruthy()
  })

  it('ruft onOpenChange(false) auf, wenn Abbrechen geklickt wird', () => {
    const onOpenChange = vi.fn()
    renderDialog(createStore(), onOpenChange)
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
