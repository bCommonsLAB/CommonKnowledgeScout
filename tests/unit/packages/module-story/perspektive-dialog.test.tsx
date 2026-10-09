// @vitest-environment jsdom

/**
 * `PerspektiveDialog` (09.10.2026): Sprache und Modell nur, wenn der
 * Montagepunkt sie zur Wahl stellt; Speichern gibt die bereinigte Wahl
 * zurueck und schliesst; Abbrechen verwirft den Entwurf.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@ks/ui'
import type { TargetLanguage } from '@ks/contracts'
import { PerspektiveDialog, StoryKopfzeile, type PerspektivWahl } from '@ks/module-story/react'

vi.mock('@ks/ui', async (original) => ({
  ...(await original<typeof import('@ks/ui')>()),
  // Die Ansichtszeile merkt sich ihren Zustand im Browser; hier zaehlen nur die Knoepfe.
  useAnsichtErklaerung: () => ({ offen: false, toggle: () => undefined }),
}))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

afterEach(cleanup)

const WERT: PerspektivWahl = { targetLanguage: 'de', character: ['undefined'], accessPerspective: ['undefined'], socialContext: 'general', llmModel: 'm1' }

function zeigen(props: Partial<Parameters<typeof PerspektiveDialog>[0]> = {}) {
  const onSpeichern = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <TooltipProvider>
      <PerspektiveDialog open onOpenChange={onOpenChange} wert={WERT} onSpeichern={onSpeichern} {...props} />
    </TooltipProvider>,
  )
  return { onSpeichern, onOpenChange }
}

describe('PerspektiveDialog', () => {
  it('ohne Sprach- und Modellwahl: nur Interessen, Zugang, Sprachstil', () => {
    zeigen()
    expect(screen.queryByText('chat.perspectivePage.languageSectionTitle')).toBeNull()
    expect(screen.queryByText('chat.perspectivePage.modelLabel')).toBeNull()
    expect(screen.getByText('chat.perspectivePage.characterSectionTitle')).toBeTruthy()
    expect(screen.getByText('chat.perspectivePage.socialContextSectionTitle')).toBeTruthy()
  })

  it('mit Wahl: Sprache und Modell erscheinen', () => {
    zeigen({
      sprachwahl: { sprachen: ['global', 'de'], labels: { global: 'Global', de: 'Deutsch' } as Record<TargetLanguage, string> },
      modellwahl: { modelle: [], laedt: false },
    })
    expect(screen.getByText('chat.perspectivePage.languageSectionTitle')).toBeTruthy()
    expect(screen.getByText('chat.perspectivePage.noModelsAvailable')).toBeTruthy()
  })

  it('Speichern liefert die bereinigte Wahl und schliesst; Sprache und Modell bleiben fest', () => {
    const { onSpeichern, onOpenChange } = zeigen()
    fireEvent.click(screen.getByText('chat.characterLabels.ecology'))
    fireEvent.click(screen.getByText('chat.characterLabels.business'))
    fireEvent.click(screen.getByText('chat.socialContextLabels.youth'))
    fireEvent.click(screen.getByText('chat.perspectivePage.saveButton'))
    expect(onSpeichern).toHaveBeenCalledWith({ ...WERT, character: ['ecology', 'business'], socialContext: 'youth' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('„nicht festgelegt" ist gesperrt, solange etwas gewaehlt ist', () => {
    zeigen({ wert: { ...WERT, character: ['ecology'] } })
    const offen = screen.getByText('chat.characterLabels.undefined').closest('button') as HTMLButtonElement
    expect(offen.disabled).toBe(true)
  })
})

describe('StoryKopfzeile mit Perspektive', () => {
  it('ohne `perspektive` kein Knopf; mit: Knopf oeffnet', () => {
    const { unmount } = render(<TooltipProvider><StoryKopfzeile onBackToGallery={() => undefined} /></TooltipProvider>)
    expect(screen.queryByLabelText('gallery.storyMode.perspective.adjustPerspective')).toBeNull()
    unmount()
    const onOpen = vi.fn()
    render(<TooltipProvider><StoryKopfzeile onBackToGallery={() => undefined} perspektive={{ wahl: { ...WERT, character: ['ecology'] }, onOpen }} /></TooltipProvider>)
    fireEvent.click(screen.getByLabelText('gallery.storyMode.perspective.adjustPerspective'))
    expect(onOpen).toHaveBeenCalled()
    expect(screen.getByText('chat.characterLabels.ecology')).toBeTruthy()
  })
})
