// @vitest-environment jsdom
/**
 * WE3 — Die Fragen-Sektion laeuft ohne App: kein Clerk, kein Story-Kontext,
 * keine Library-Konfig. Was sie braucht, kommt vom Gastgeber; der Knopf
 * „Antworten anpassen" erscheint nur mit Dialog-Slot, Platzhalter und Fehler
 * kommen aus `eingabe`, Abrufe gehen ueber die Instanz des Gastgebers.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InstanceApi } from '@ks/api-client'
import { appNavigation, parseWebsiteSections } from '@ks/module-website'
import { WebsiteStorySektion, type WebsiteStoryGastgeber } from '@ks/module-website/react'

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'de' }),
}))

// Die Konversation selbst prueft das Story-Paket; hier zaehlt nur, was die Sektion vom Gastgeber nimmt.
const zustand = vi.hoisted(() => ({ nachrichten: [] as unknown[], frageSenden: vi.fn(), laeuft: false }))
vi.mock('@ks/module-story/react', async (original) => {
  const echt = await original<typeof import('@ks/module-story/react')>()
  return {
    ...echt,
    useStoryKonversation: () => ({
      stand: 's', nachrichten: zustand.nachrichten, laeuft: zustand.laeuft, schritte: [], fehler: null, fehlerDetail: null,
      antwortLaenge: 'mittel', setAntwortLaenge: vi.fn(), frageSenden: zustand.frageSenden,
    }),
    useNeuStellen: () => undefined,
  }
})

const SEKTION = parseWebsiteSections('<!-- section layout=story -->\n## Frag den Scout\n\n<!-- questions -->\n- Was ist das?\n<!-- /section -->')[0]

function gastgeber(teil: Partial<WebsiteStoryGastgeber> = {}): { g: WebsiteStoryGastgeber; abrufe: string[] } {
  const abrufe: string[] = []
  const instanz: InstanceApi = {
    baseUrl: 'https://instanz.example',
    url: (p) => `https://instanz.example${p}`,
    fetch: async (p) => {
      abrufe.push(p)
      return new Response(JSON.stringify({ total: 7, items: [] }), { status: 200 })
    },
  }
  const g: WebsiteStoryGastgeber = {
    instanz,
    angemeldet: false,
    perspektive: { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'undefined', genderInclusive: true, llmModel: 'm' },
    eingabe: { platzhalter: 'Deine Frage …', laedt: false, fehler: null },
    ...teil,
  }
  return { g, abrufe }
}

afterEach(() => {
  cleanup()
  zustand.nachrichten = []
  zustand.frageSenden.mockClear()
  zustand.laeuft = false
  Reflect.deleteProperty(window, 'matchMedia')
})

function paar(n: number) {
  return [
    { id: `f${n}`, art: 'frage', text: `Frage ${n}`, createdAt: '2026-11-18', queryId: `q-${n}` },
    { id: `a${n}`, art: 'antwort', text: `Antwort ${n}`, createdAt: '2026-11-18', queryId: `q-${n}`, belege: [] },
  ]
}

describe('WebsiteStorySektion mit Gastgeber', () => {
  it('rendert ohne App: Platzhalter aus der Eingabe, Katalog ueber die Instanz, kein Knopf ohne Dialog', async () => {
    const { g, abrufe } = gastgeber()
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    expect(screen.getByPlaceholderText('Deine Frage …')).toBeTruthy()
    expect(screen.getByText('Was ist das?')).toBeTruthy()
    expect(container.querySelector('[data-story-perspektive-knopf]')).toBeNull()
    await waitFor(() => expect(abrufe.some((p) => p.startsWith('/api/chat/lib/docs?'))).toBe(true))
  })

  it('mit Dialog-Slot: Knopf „Antworten anpassen" steht bei der Antwort und oeffnet ihn', () => {
    zustand.nachrichten = paar(1)
    const { g } = gastgeber({ perspektiveDialog: ({ offen }) => (offen ? <div data-testid="dialog">Dialog</div> : null) })
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    const knopf = container.querySelector('[data-antwort] [data-story-perspektive-knopf]')
    expect(knopf).not.toBeNull()
    expect(container.querySelectorAll('[data-story-perspektive-knopf]')).toHaveLength(1)
    fireEvent.click(knopf as Element)
    expect(screen.getByTestId('dialog')).toBeTruthy()
  })

  it('Fehler der Konfig steht als Meldung da', () => {
    const { g } = gastgeber({ eingabe: { laedt: false, fehler: 'Konfig nicht ladbar' } })
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    expect(screen.getByRole('alert').textContent).toBe('Konfig nicht ladbar')
  })

  it('Antwort: Fuss und Bild vom Gastgeber, „fruehere Fragen" ueber die Navigation', () => {
    zustand.nachrichten = [...paar(1), ...paar(2)]
    const onShowStory = vi.fn()
    const { g } = gastgeber({
      antwortFuss: (a) => <span data-testid="fuss">Fuss zu {a.queryId}</span>,
      antwortAvatar: <span data-testid="avatar">Logo</span>,
    })
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation({ onShowStory })} />)
    expect(screen.getByText('Antwort 2')).toBeTruthy()
    expect(screen.queryByText('Antwort 1')).toBeNull()
    expect(screen.getByTestId('fuss').textContent).toBe('Fuss zu q-2')
    expect(screen.getByTestId('avatar')).toBeTruthy()
    const verweis = document.querySelector('[data-story-fruehere-fragen] a') as HTMLAnchorElement
    expect(verweis.getAttribute('href')).toBe('?mode=story&q=q-1')
    fireEvent.click(verweis)
    expect(onShowStory).toHaveBeenCalledWith({ q: 'q-1' })
  })

  // R1 (24.11.2026): eine Fragebox — Eingabe und Anzeige der Frage zugleich.
  it('Beispielfrage: fuellt die Box und wird sofort gestellt', () => {
    const { g } = gastgeber()
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    fireEvent.click(screen.getByText('Was ist das?'))
    expect(zustand.frageSenden).toHaveBeenCalledWith('Was ist das?')
    expect((screen.getByPlaceholderText('Deine Frage …') as HTMLTextAreaElement).value).toBe('Was ist das?')
  })

  it('Antwort: die Frage steht in der Box (kein Block „Deine Frage"), die Box steht ueber der Antwort', () => {
    zustand.nachrichten = paar(1)
    const { g } = gastgeber()
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    const feld = screen.getByPlaceholderText('Deine Frage …') as HTMLTextAreaElement
    expect(feld.value).toBe('Frage 1')
    expect(container.querySelector('[data-story-frage]')).toBeNull()
    expect(screen.queryByText('story.konversation.deineFrage')).toBeNull()
    expect(container.querySelectorAll('[data-story-eingabe-inline]').length).toBe(1)
    const antwort = container.querySelector('[data-antwort]') as Element
    expect(feld.compareDocumentPosition(antwort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('geaenderte Frage: Enter stellt sie neu', () => {
    zustand.nachrichten = paar(1)
    const { g } = gastgeber()
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    const feld = screen.getByPlaceholderText('Deine Frage …')
    fireEvent.change(feld, { target: { value: 'Frage 1, genauer' } })
    fireEvent.keyDown(feld, { key: 'Enter' })
    expect(zustand.frageSenden).toHaveBeenCalledWith('Frage 1, genauer')
  })

  it('Weiterfrage: wird sofort gestellt und steht in der Box', () => {
    const [frage, antwort] = paar(1)
    zustand.nachrichten = [frage, { ...antwort, anschlussfragen: ['Und weiter?'] }]
    const { g } = gastgeber()
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    fireEvent.click(screen.getByText('Und weiter?'))
    expect(zustand.frageSenden).toHaveBeenCalledWith('Und weiter?')
    expect((screen.getByPlaceholderText('Deine Frage …') as HTMLTextAreaElement).value).toBe('Und weiter?')
  })

  it('Beispielfragen: nach der Antwort eingeklappt, ein Klick holt sie zurueck', () => {
    zustand.nachrichten = paar(1)
    const { g } = gastgeber()
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    expect(screen.queryByText('Was ist das?')).toBeNull()
    fireEvent.click(container.querySelector('[data-story-beispiele] button') as Element)
    expect(screen.getByText('Was ist das?')).toBeTruthy()
  })

  // R3 (24.11.2026): auf dem Telefon laeuft die Frage im Vollbild — dieselbe Sektion, fest ueber dem Bildschirm.
  describe('Telefon', () => {
    function telefon() {
      window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
      vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} })
    }

    it('eine laufende Frage oeffnet das Vollbild; Schliessen legt die Sektion zurueck in die Seite', async () => {
      telefon()
      zustand.laeuft = true
      zustand.nachrichten = [paar(1)[0]]
      const { g } = gastgeber()
      const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
      await waitFor(() => expect(container.querySelector('[data-story-vollbild]')).not.toBeNull())
      // Im Vollbild: nur Fragebox und Antwortzone — keine Beispielfragen, keine Ueberschrift der Sektion.
      expect(container.querySelectorAll('[data-story-eingabe-inline]').length).toBe(1)
      expect(screen.queryByText('Was ist das?')).toBeNull()
      expect(screen.queryByText('Frag den Scout')).toBeNull()
      expect(document.documentElement.style.overflow).toBe('hidden')
      fireEvent.click(container.querySelector('[data-story-vollbild-zu]') as Element)
      expect(container.querySelector('[data-story-vollbild]')).toBeNull()
      expect(document.documentElement.style.overflow).toBe('')
      expect(screen.getByText('Frag den Scout')).toBeTruthy()
    })

    it('ohne Frage bleibt die Sektion in der Seite', () => {
      telefon()
      const { g } = gastgeber()
      const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
      expect(container.querySelector('[data-story-vollbild]')).toBeNull()
      expect(screen.getByText('Was ist das?')).toBeTruthy()
    })
  })
})
