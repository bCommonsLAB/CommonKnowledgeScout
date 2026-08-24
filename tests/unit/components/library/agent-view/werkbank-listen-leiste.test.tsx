// @vitest-environment jsdom

/**
 * @fileoverview Unit-Tests: Arbeitslisten-Steuerung (F7, Welle W6).
 *
 * Anlegen mit optionalem Seeding (Checkbox reicht die `status: aktiv`-Kopie
 * durch), Klartext bei 409 `name_vergeben` (kein stilles Schlucken) und das
 * zweistufige Loeschen mit dem Kreuztest-Hinweis. Der Worklists-Hook ist als
 * schmales Fake-Objekt gestubbt — kein Fetch im Test.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WerkbankListenLeiste } from '@/components/library/agent-view/werkbank/werkbank-listen-leiste'
import type { useWorklists } from '@/hooks/agent-view/use-worklists'

afterEach(() => cleanup())

function fakeWorklists(overrides: { anlegen?: ReturnType<typeof vi.fn>; loeschen?: ReturnType<typeof vi.fn> } = {}) {
  return {
    anlegen: { mutateAsync: overrides.anlegen ?? vi.fn().mockResolvedValue({ list: { listId: 'l-neu' } }) },
    loeschen: { mutateAsync: overrides.loeschen ?? vi.fn().mockResolvedValue({ deleted: true }) },
  } as unknown as ReturnType<typeof useWorklists>
}

const LISTEN = [{ listId: 'l-1', name: 'Aktuelle Projekte', position: 0, folders: [] }]

describe('WerkbankListenLeiste', () => {
  it('legt eine Liste an und reicht die Seeding-Kopie nur mit gesetzter Checkbox durch', async () => {
    const anlegen = vi.fn().mockResolvedValue({ list: { listId: 'l-neu' } })
    const onWaehleListe = vi.fn()
    const seed = [{ folderId: 'f-1', pathSnapshot: 'A/P', name: 'P' }]
    render(
      <WerkbankListenLeiste
        lists={LISTEN}
        aktiveListeId={null}
        onWaehleListe={onWaehleListe}
        worklists={fakeWorklists({ anlegen })}
        seedKandidaten={() => seed}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Neu/ }))
    fireEvent.change(screen.getByLabelText('Name der neuen Liste'), { target: { value: 'Aufraeumen 2019' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    await vi.waitFor(() => expect(anlegen).toHaveBeenCalledWith({ name: 'Aufraeumen 2019', folders: seed }))
    expect(onWaehleListe).toHaveBeenCalledWith('l-neu')
  })

  it('zeigt den 409-Klartext, statt den Fehler zu schlucken', async () => {
    const anlegen = vi.fn().mockRejectedValue(new Error('Listenname bereits vergeben: X'))
    render(
      <WerkbankListenLeiste
        lists={LISTEN}
        aktiveListeId={null}
        onWaehleListe={() => {}}
        worklists={fakeWorklists({ anlegen })}
        seedKandidaten={() => []}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Neu/ }))
    fireEvent.change(screen.getByLabelText('Name der neuen Liste'), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }))
    expect(await screen.findByText(/Listenname bereits vergeben/)).toBeTruthy()
  })

  it('loescht zweistufig und benennt, dass Report und Archiv unberuehrt bleiben', async () => {
    const loeschen = vi.fn().mockResolvedValue({ deleted: true })
    const onWaehleListe = vi.fn()
    render(
      <WerkbankListenLeiste
        lists={LISTEN}
        aktiveListeId="l-1"
        onWaehleListe={onWaehleListe}
        worklists={fakeWorklists({ loeschen })}
        seedKandidaten={() => []}
      />,
    )
    fireEvent.click(screen.getByLabelText('Aktive Liste loeschen'))
    fireEvent.click(screen.getByRole('button', { name: /Wirklich loeschen\? \(Report und Archiv bleiben unberuehrt\)/ }))
    await vi.waitFor(() => expect(loeschen).toHaveBeenCalledWith('l-1'))
    expect(onWaehleListe).toHaveBeenCalledWith(null)
  })
})
