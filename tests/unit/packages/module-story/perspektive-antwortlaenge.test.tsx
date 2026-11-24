// @vitest-environment jsdom
/**
 * Antwortlaenge im Dialog „Antworten anpassen" (Owner 24.11.2026): Sie steht nur dort, wo der
 * Gastgeber sie hereinreicht, und gilt wie die uebrige Wahl erst mit dem Speichern.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@ks/ui'
import { PerspektiveDialog, type PerspektivWahl } from '@ks/module-story/react'

vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'de' }) }))

afterEach(() => cleanup())

// Speicherbar: je eine Wahl bei Interessen und Zugang (hier „nicht spezifiziert").
const WAHL: PerspektivWahl = { targetLanguage: 'de', character: ['undefined'], accessPerspective: ['undefined'], socialContext: 'undefined', llmModel: 'm' }

function dialog(antwortLaenge?: Parameters<typeof PerspektiveDialog>[0]['antwortLaenge']) {
  const onSpeichern = vi.fn()
  const onOpenChange = vi.fn()
  render(<TooltipProvider><PerspektiveDialog open onOpenChange={onOpenChange} wert={WAHL} onSpeichern={onSpeichern} antwortLaenge={antwortLaenge} /></TooltipProvider>)
  return { onSpeichern, onOpenChange }
}

describe('PerspektiveDialog: Antwortlaenge', () => {
  it('ohne Angabe gibt es den Abschnitt nicht (Story-Modus, Galerie)', () => {
    dialog()
    expect(document.querySelector('[data-perspektive-antwortlaenge]')).toBeNull()
  })

  it('die Wahl gilt erst mit dem Speichern', () => {
    const onWahl = vi.fn()
    const { onSpeichern } = dialog({ wert: 'mittel', onWahl })
    expect(document.querySelector('[data-perspektive-antwortlaenge]')).not.toBeNull()
    fireEvent.click(screen.getByText('chat.answerLengthLabels.kurz'))
    expect(onWahl).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('chat.perspectivePage.saveButton'))
    expect(onWahl).toHaveBeenCalledWith('kurz')
    expect(onSpeichern).toHaveBeenCalledTimes(1)
  })

  it('unveraendert gespeichert meldet keine Laenge', () => {
    const onWahl = vi.fn()
    dialog({ wert: 'mittel', onWahl })
    fireEvent.click(screen.getByText('chat.perspectivePage.saveButton'))
    expect(onWahl).not.toHaveBeenCalled()
  })
})
