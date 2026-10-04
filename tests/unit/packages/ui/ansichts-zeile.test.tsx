// @vitest-environment jsdom

/**
 * `AnsichtsZeile` (D10b, Figma „Schritt 7"): Name der Ansicht mit ⓘ, Werkzeuge
 * rechts, Erklaerung darunter mit Pfeil-nach-oben zum Einklappen; beim
 * Scrollen eingeklappt bleibt die Zeile, die Erklaerung geht zu.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AnsichtsZeile } from '../../../../packages/ui/src/ansichts-zeile'

afterEach(cleanup)

const labels = { oeffnen: 'Wie funktioniert das?', schliessen: 'Erklärung einklappen' }

describe('AnsichtsZeile', () => {
  it('zu: Name, ⓘ und Werkzeuge, keine Erklaerung; ⓘ ruft den Schalter', () => {
    const onToggle = vi.fn()
    render(
      <AnsichtsZeile
        name="Story-Modus"
        erklaerung={{ titel: 'So geht es', text: 'Text.', offen: false, onToggle, labels }}
        werkzeuge={<button type="button">Zurück</button>}
      />,
    )
    expect(screen.getByText('Story-Modus')).toBeTruthy()
    expect(screen.getByText('Zurück')).toBeTruthy()
    expect(screen.queryByText('So geht es')).toBeNull()
    const info = screen.getByRole('button', { name: labels.oeffnen })
    expect(info.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(info)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('auf: Erklaerung mit Titel, Text und Pfeil zum Einklappen', () => {
    const onToggle = vi.fn()
    render(<AnsichtsZeile name="Inhalte" erklaerung={{ titel: 'So geht es', text: 'Text.', offen: true, onToggle, labels }} />)
    expect(screen.getByText('So geht es')).toBeTruthy()
    expect(screen.getByText('Text.')).toBeTruthy()
    const schliessen = screen.getAllByRole('button', { name: labels.schliessen })
    expect(schliessen).toHaveLength(2) // ⓘ (aktiv) und der Pfeil im Kasten
    fireEvent.click(schliessen[1])
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('beim Scrollen eingeklappt: Zeile bleibt, Erklaerung zu', () => {
    render(<AnsichtsZeile name="Inhalte" eingeklappt erklaerung={{ titel: 'So geht es', text: 'Text.', offen: true, onToggle: () => {}, labels }} />)
    expect(screen.getByText('Inhalte')).toBeTruthy()
    expect(screen.queryByText('So geht es')).toBeNull()
  })
})
