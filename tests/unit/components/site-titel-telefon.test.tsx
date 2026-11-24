// @vitest-environment jsdom
/**
 * Name der Library auf dem Telefon (Owner 24.11.2026): Er steht in der TopNav (`SiteLogo`, neben dem
 * Menue), der Kopfstreifen der Erkunden-Seite zeigt ihn dort nicht noch einmal (`titelInNavigation`).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
// Der Kopf ist ein innerer Baustein des Pakets (kein oeffentlicher Export): direkt eingebunden.
import { ExplorerHeader } from '../../../packages/module-explorer/src/react/explorer-header'
import { SiteLogo } from '@/components/site-logo'

vi.mock('@ks/i18n/react', () => ({ useTranslation: () => ({ t: (key: string) => key, locale: 'de' }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }))
const libs = vi.hoisted(() => ({ liste: [] as unknown[] }))
vi.mock('@ks/shell/react', () => ({ useLibraries: () => libs.liste }))

afterEach(() => { cleanup(); libs.liste = []; vi.unstubAllGlobals() })

const LIBRARY = { id: 'l1', label: 'Vortragsarchiv', logoUrl: undefined } as Parameters<typeof ExplorerHeader>[0]['library']

describe('ExplorerHeader', () => {
  it('ohne Angabe steht der Name im Kopf (eingebettet, ohne eigene Navigation)', () => {
    render(<ExplorerHeader library={LIBRARY} />)
    expect(screen.getByRole('heading', { level: 1 }).className).not.toContain('sr-only')
  })

  it('mit `titelInNavigation`: auf dem Telefon nur fuer Vorleser, ab `sm` sichtbar', () => {
    render(<ExplorerHeader library={LIBRARY} titelInNavigation />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('Vortragsarchiv')
    expect(h1.className).toContain('sr-only')
    expect(h1.className).toContain('sm:not-sr-only')
  })

  it('mit Logo und `titelInNavigation`: die Ueberschrift bleibt fuer Vorleser', () => {
    render(<ExplorerHeader library={{ ...LIBRARY, logoUrl: 'https://beispiel.invalid/logo.png' }} titelInNavigation />)
    expect(screen.getByRole('heading', { level: 1 }).className).toBe('sr-only')
  })
})

describe('SiteLogo: Name auf dem Telefon', () => {
  it('nimmt den oeffentlichen Namen der geladenen Library und fuehrt zur Startseite der Site', () => {
    libs.liste = [{ id: 'l1', label: 'intern', config: { publicPublishing: { slugName: 'archiv', publicName: 'Vortragsarchiv' } } }]
    const { container } = render(<SiteLogo slug="archiv" homeHref="/explore/archiv" />)
    const titel = container.querySelector('[data-site-titel]') as HTMLAnchorElement
    expect(titel.textContent).toBe('Vortragsarchiv')
    expect(titel.getAttribute('href')).toBe('/explore/archiv')
    expect(titel.className).toContain('sm:hidden')
    expect(container.querySelector('img')).toBeNull()
  })

  it('ohne geladene Library (Domain-Root, anonym): Name und Logo aus der oeffentlichen Slug-API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ library: { label: 'Vortragsarchiv', logoUrl: 'https://beispiel.invalid/logo.png' } }) })))
    const { container } = render(<SiteLogo slug="archiv" homeHref="/" />)
    await waitFor(() => expect(container.querySelector('[data-site-titel]')?.textContent).toBe('Vortragsarchiv'))
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://beispiel.invalid/logo.png')
  })

  it('ohne Namen und ohne Logo rendert sie nichts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    const { container } = render(<SiteLogo slug="archiv" homeHref="/" />)
    await waitFor(() => expect(container.innerHTML).toBe(''))
  })
})
