// @vitest-environment jsdom
/**
 * P4 — die Fragen-Sektion ueber der Buehne (Plan `commonux-buehne-fragen-sektion`): Der Gastgeber
 * reicht die Buehne als Slot; die Sektion meldet das Gespraech, misst die Zitatmarken und faerbt
 * sie. Ohne Slot bleibt die Sektion, wie sie ist.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InstanceApi } from '@ks/api-client'
import { appNavigation, parseWebsiteSections } from '@ks/module-website'
import {
  WebsiteStorySektion,
  erzeugeAnkerQuelle,
  markenFarbenCss,
  messeMarken,
  type WebsiteBuehneEbene,
  type WebsiteStoryBuehne,
  type WebsiteStoryGastgeber,
} from '@ks/module-website/react'

vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'de' }) }))

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

// Zitatmarken sichtbar (`citations=visible`), damit sie eine Lage haben.
const SEKTION = parseWebsiteSections('<!-- section layout=story citations=visible -->\n## Frag den Scout\n<!-- /section -->')[0]

const instanz: InstanceApi = {
  baseUrl: 'https://instanz.example',
  url: (p) => `https://instanz.example${p}`,
  fetch: async () => new Response(JSON.stringify({ total: 7, items: [] }), { status: 200 }),
}
function gastgeber(buehne?: WebsiteStoryBuehne): WebsiteStoryGastgeber {
  return {
    instanz,
    angemeldet: false,
    perspektive: { targetLanguage: 'de', character: [], accessPerspective: [], socialContext: 'undefined', genderInclusive: true, llmModel: 'm' },
    eingabe: { laedt: false, fehler: null },
    buehne,
  }
}

type Darstellung = NonNullable<WebsiteStoryBuehne['darstellung']>
const FARBE: Darstellung['farbeFuerBeleg'] = (id) => (id === 'dok-a' ? '#AA0000' : '#00AA00')

/** Eine Buehne des Gastgebers; `ebene` merkt sich, was die Sektion ihr reicht. */
function buehneMit(modus: WebsiteStoryBuehne['modus'], gesehen: WebsiteBuehneEbene[] = []) {
  const onModus = vi.fn()
  const buehne: WebsiteStoryBuehne = {
    modus,
    onModus,
    darstellung: { ebene: (p) => { gesehen.push(p); return <div data-testid="ebene" /> }, farbeFuerBeleg: FARBE },
  }
  return { buehne, onModus, gesehen }
}

const ANTWORT = [
  { id: 'f1', art: 'frage', text: 'Wie beginnt es?', createdAt: '2026-11-21', queryId: 'q-1' },
  {
    id: 'a1', art: 'antwort', text: 'So [3]. Und so [11]. Nochmal [3].', createdAt: '2026-11-21', queryId: 'q-1',
    belege: [{ number: 3, fileId: 'dok-a', description: 'a' }, { number: 11, fileId: 'dok-b', description: 'b' }],
    anschlussfragen: ['Und dann?'],
  },
]

/** Jede Marke bekommt eine Lage: 20 × 20 px, untereinander im Abstand von 100 px. */
function gebeMarkenEineLage(): void {
  let y = 0
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (!this.matches('a[data-beleg]')) return new DOMRect(0, 0, 0, 0)
    const oben = Number(this.dataset.lageY ?? (this.dataset.lageY = String((y += 100))))
    return new DOMRect(50, oben, 20, 20)
  })
}

// jsdom kennt keinen ResizeObserver; die Messung selbst loest hier der erste Bildwechsel aus.
vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  zustand.nachrichten = []
})

describe('Fragen-Sektion ueber der Buehne', () => {
  it('ohne Buehne am Gastgeber: keine Ebene, kein Messbereich, keine Stilregeln', () => {
    zustand.nachrichten = ANTWORT
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber()} navigation={appNavigation()} />)
    expect(container.querySelector('[data-story-hintergrund]')).toBeNull()
    expect(container.querySelector('[data-story-buehne]')).toBeNull()
    expect(container.querySelector('style')).toBeNull()
    expect(container.querySelectorAll('a[data-beleg]').length).toBe(3)
  })

  it('hinten: die Ebene liegt im Fenster des Chats, bekommt das Gespraech und die Lage der Marken je Beleg', async () => {
    zustand.nachrichten = ANTWORT
    gebeMarkenEineLage()
    const { buehne, gesehen } = buehneMit('hinten')
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber(buehne)} navigation={appNavigation()} />)

    const fenster = container.querySelector('[data-story-hintergrund]') as HTMLElement
    expect(fenster.querySelector('[data-testid="ebene"]')).not.toBeNull()
    // Klicks gehen nie an die Buehne; das Fenster schneidet sie zu.
    expect(fenster.getAttribute('data-story-hintergrund')).toBe('hinten')
    expect(fenster.className).toContain('pointer-events-none')
    expect(fenster.style.clipPath).toContain('inset(0')

    const letzte = gesehen[gesehen.length - 1]
    expect(letzte.vorn).toBe(false)
    expect(letzte.gespraech).toMatchObject({ stand: 'fertig', lesen: true, frage: { text: 'Wie beginnt es?' } })
    expect(letzte.gespraech?.belege.map((b) => [b.id, b.nummer])).toEqual([['dok-a', 1], ['dok-b', 2]])

    await waitFor(() => expect(letzte.anker.stand().length).toBe(2))
    const anker = letzte.anker.stand()
    // dok-a hat zwei Marken im Text, jede mit eigenem, stabilem Schluessel.
    expect(anker.find((a) => a.belegId === 'dok-a')?.marken.map((m) => m.key)).toEqual(['1-0', '1-1'])
    expect(anker.find((a) => a.belegId === 'dok-b')?.marken).toEqual([{ key: '2-0', x: 60, y: 210 }])
  })

  it('hinten: jede Marke traegt die Farbe ihres Belegs, nur im Bereich dieser Sektion', () => {
    zustand.nachrichten = ANTWORT
    const { buehne } = buehneMit('hinten')
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber(buehne)} navigation={appNavigation()} />)
    const bereich = container.querySelector('[data-story-buehne]') as HTMLElement
    const scope = bereich.getAttribute('data-story-buehne')
    const css = bereich.querySelector('style')?.textContent ?? ''
    expect(css).toContain(`[data-story-buehne="${scope}"] a[data-beleg="1"]{background-color:color-mix(in srgb,#AA0000 30%,white)!important;border-color:#AA0000!important`)
    expect(css).toContain(`a[data-beleg="2"]{background-color:color-mix(in srgb,#00AA00 30%,white)!important`)
    // Die Marken liegen im Bereich.
    expect(bereich.querySelectorAll('a[data-beleg]').length).toBe(3)
  })

  it('ohne Frage bekommt die Ebene kein Gespraech und keine Anker', () => {
    const { buehne, gesehen } = buehneMit('hinten')
    render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber(buehne)} navigation={appNavigation()} />)
    expect(gesehen[gesehen.length - 1].gespraech).toBeNull()
  })
})

describe('Symbol im Kopf der Karte und Buehnen-Modus (K4)', () => {
  it('ohne Buehne am Gastgeber gibt es kein Symbol', () => {
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber()} navigation={appNavigation()} />)
    expect(container.querySelector('[data-story-buehne-knopf]')).toBeNull()
  })

  it('aus: das Symbol mit den Kreisen fuehrt zur Buehne; die Sektion bleibt, wie sie ist', () => {
    zustand.nachrichten = ANTWORT
    const onModus = vi.fn()
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber({ modus: 'aus', onModus })} navigation={appNavigation()} />)
    const knopf = container.querySelector('[data-story-buehne-knopf]') as HTMLElement
    expect(knopf.getAttribute('data-story-buehne-knopf')).toBe('buehne')
    expect(knopf.getAttribute('aria-label')).toBe('website.story.zurBuehne')
    expect(knopf.querySelectorAll('svg circle').length).toBe(3)
    expect(container.querySelector('[data-story-hintergrund]')).toBeNull()
    expect(container.querySelector('style')).toBeNull()
    fireEvent.click(knopf)
    expect(onModus).toHaveBeenCalledWith('vorn')
  })

  it('vorn gewaehlt, der Player laedt noch: der Text bleibt stehen', () => {
    zustand.nachrichten = ANTWORT
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={gastgeber({ modus: 'vorn', onModus: vi.fn() })} navigation={appNavigation()} />)
    expect(container.querySelector('[data-story-buehne-raum]')).toBeNull()
    expect(container.querySelectorAll('a[data-beleg]').length).toBe(3)
  })

  it('vorn: die Buehne steht statt des Texts und nimmt Klicks an; die Eingabe bleibt darunter', () => {
    zustand.nachrichten = ANTWORT
    const { buehne, gesehen, onModus } = buehneMit('vorn')
    const g = { ...gastgeber(buehne), eingabe: { platzhalter: 'Deine Frage …', laedt: false, fehler: null } }
    const { container } = render(<WebsiteStorySektion libraryId="lib" section={SEKTION} gastgeber={g} navigation={appNavigation()} />)

    expect(container.querySelector('[data-story-buehne-raum]')).not.toBeNull()
    expect(container.querySelectorAll('a[data-beleg]').length).toBe(0)
    const fenster = container.querySelector('[data-story-hintergrund]') as HTMLElement
    expect(fenster.getAttribute('data-story-hintergrund')).toBe('vorn')
    expect(fenster.className).not.toContain('pointer-events-none')
    // Die Eingabe liegt ausserhalb des Fensters: Die Buehne verdeckt sie nicht.
    const eingabe = screen.getByPlaceholderText('Deine Frage …')
    expect(fenster.parentElement?.contains(eingabe)).toBe(false)

    const letzte = gesehen[gesehen.length - 1]
    expect(letzte.vorn).toBe(true)
    expect(letzte.gespraech).toMatchObject({ lesen: false, stand: 'fertig' })
    expect(letzte.anker.stand()).toEqual([])

    const knopf = container.querySelector('[data-story-buehne-knopf]') as HTMLElement
    expect(knopf.getAttribute('data-story-buehne-knopf')).toBe('text')
    expect(knopf.getAttribute('aria-label')).toBe('website.story.zumText')
    fireEvent.click(knopf)
    expect(onModus).toHaveBeenCalledWith('hinten')
  })
})

describe('messeMarken', () => {
  function behaelter(html: string): HTMLElement {
    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)
    return el
  }

  it('verborgene Marken (ohne Flaeche) haben keine Lage; eine Marke ohne Beleg wird uebergangen', () => {
    const el = behaelter('<a data-beleg="1">1</a><a data-beleg="9">9</a><a data-beleg="2" data-sichtbar>2</a>')
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-sichtbar') ? new DOMRect(10, 30, 20, 20) : new DOMRect(0, 0, 0, 0)
    })
    expect(messeMarken(el, { 1: 'dok-a', 2: 'dok-b' })).toEqual([{ belegId: 'dok-b', marken: [{ key: '2-0', x: 20, y: 40 }] }])
    el.remove()
  })
})

describe('markenFarbenCss', () => {
  it('lehnt eine Farbe ab, die kein #RRGGBB ist — sie kaeme ungeprueft in eine Stilregel', () => {
    expect(() => markenFarbenCss('s', { 1: 'dok-a' }, () => 'red;}body{display:none')).toThrow(/kein #RRGGBB/)
  })
})

describe('erzeugeAnkerQuelle', () => {
  it('meldet nur, wenn sich eine Lage aendert, und haelt den Stand dazwischen stabil', () => {
    const quelle = erzeugeAnkerQuelle()
    const horcher = vi.fn()
    const ab = quelle.abonniere(horcher)
    const a = [{ belegId: 'dok-a', marken: [{ key: '1-0', x: 1, y: 2 }] }]
    quelle.setze(a)
    quelle.setze([{ belegId: 'dok-a', marken: [{ key: '1-0', x: 1, y: 2 }] }])
    expect(horcher).toHaveBeenCalledTimes(1)
    expect(quelle.stand()).toBe(a)
    quelle.setze([{ belegId: 'dok-a', marken: [{ key: '1-0', x: 1, y: 3 }] }])
    expect(horcher).toHaveBeenCalledTimes(2)
    ab()
    quelle.setze([])
    expect(horcher).toHaveBeenCalledTimes(2)
  })
})
