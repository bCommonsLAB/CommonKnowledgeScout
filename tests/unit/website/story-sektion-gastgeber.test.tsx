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
const zustand = vi.hoisted(() => ({ nachrichten: [] as unknown[] }))
vi.mock('@ks/module-story/react', async (original) => {
  const echt = await original<typeof import('@ks/module-story/react')>()
  return {
    ...echt,
    useStoryKonversation: () => ({
      stand: 's', nachrichten: zustand.nachrichten, laeuft: false, schritte: [], fehler: null, fehlerDetail: null,
      antwortLaenge: 'mittel', setAntwortLaenge: vi.fn(), frageSenden: vi.fn(),
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

  it('mit Dialog-Slot: Knopf „Antworten anpassen" oeffnet ihn', () => {
    const { g } = gastgeber({ perspektiveDialog: ({ offen }) => (offen ? <div data-testid="dialog">Dialog</div> : null) })
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)
    const knopf = container.querySelector('[data-story-perspektive-knopf]')
    expect(knopf).not.toBeNull()
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
})
