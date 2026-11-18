// @vitest-environment jsdom

/**
 * WE2 — Wege der Startseite im Renderer: Handlungsaufruf, Markdown-Links und
 * Fusszeile laufen ueber `WebsiteNavigation`. Normaler Klick ruft den Rueckruf
 * (ohne Neuladen), Strg-Klick bleibt Link, ein Ziel ohne Weg laesst das
 * Element weg; ohne Navigation (Archiv-Vorschau) bleibt der rohe Link.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { InstanceApi } from '@ks/api-client'
import type { DocCardMeta } from '@ks/contracts'
import { appNavigation, type WebsiteNavigation } from '@ks/module-website'
import { AutorenLink, MarkdownHtml, WebsiteSiteFooter } from '@ks/module-website/react'

const KEINE_INSTANZ: InstanceApi = {
  baseUrl: '',
  url: (p) => p,
  fetch: () => Promise.reject(new Error('kein Abruf erwartet')),
}

describe('Wege der Startseite', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('Handlungsaufruf ?site=: Klick wechselt ohne Neuladen, Strg-Klick bleibt Link', () => {
    const onShowSite = vi.fn()
    render(<AutorenLink href="?site=kontakt" navigation={appNavigation({ onShowSite })}>Kontakt</AutorenLink>)
    const link = screen.getByText('Kontakt')
    expect(link.getAttribute('href')).toBe('?site=kontakt')
    expect(fireEvent.click(link)).toBe(false)
    expect(onShowSite).toHaveBeenCalledWith('kontakt')
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true)
    expect(onShowSite).toHaveBeenCalledTimes(1)
  })

  it('Handlungsaufruf ohne Navigation: der rohe Link wie vor WE2', () => {
    render(<AutorenLink href="/eigene/seite">Mehr</AutorenLink>)
    expect(screen.getByText('Mehr').getAttribute('href')).toBe('/eigene/seite')
  })

  it('Handlungsaufruf ohne Weg: entfaellt, die Konsole sagt es', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const nav: WebsiteNavigation = { weg: () => null }
    const { container } = render(<AutorenLink href="?mode=story" navigation={nav}>Fragen</AutorenLink>)
    expect(container.innerHTML).toBe('')
    expect(warn).toHaveBeenCalled()
  })

  it('Markdown-Link: Klick ruft den Weg, Strg-Klick nicht', () => {
    const onShowGallery = vi.fn()
    render(<MarkdownHtml markdown="Zum [Archiv](?view=gallery)." navigation={appNavigation({ onShowGallery })} />)
    const link = screen.getByText('Archiv')
    expect(link.getAttribute('href')).toBe('?view=gallery')
    expect(fireEvent.click(link)).toBe(false)
    expect(onShowGallery).toHaveBeenCalledTimes(1)
    fireEvent.click(link, { ctrlKey: true })
    expect(onShowGallery).toHaveBeenCalledTimes(1)
  })

  it('Fusszeile: Links sind Adressen der Seite und wechseln ohne Neuladen', () => {
    const onShowSite = vi.fn()
    const impressum = { id: 'f1', fileId: 'f1', title: 'Impressum', slug: 'impressum' } as DocCardMeta
    render(
      <WebsiteSiteFooter
        instanz={KEINE_INSTANZ}
        libraryId="lib"
        footerDoc={null}
        footerLinkDocs={[impressum]}
        locale="de"
        navigation={appNavigation({ onShowSite })}
      />,
    )
    const link = screen.getByText('Impressum')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('?site=impressum')
    fireEvent.click(link)
    expect(onShowSite).toHaveBeenCalledWith('impressum')
  })
})
