// @vitest-environment jsdom

/**
 * Welle N2 — Kachel-Renderer: Klick ruft den Rueckruf (ohne Neuladen), Strg-Klick
 * und fehlende Navigation lassen den Link in Ruhe, ein unbekanntes Ziel steht sichtbar da.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { Cards } from '@/components/library/website/section-cards'

const ITEMS = [
  { title: 'Archiv', text: 'Stoebern.', linkLabel: 'Zum Archiv', href: '?view=gallery' },
  { title: 'Themen', text: '', linkLabel: 'Zu den Themen', href: '?mode=story' },
  { title: 'Hilfe', text: 'Erklaerung.', linkLabel: 'Mehr', href: '?site=wie-funktioniert' },
]

describe('Cards', () => {
  afterEach(cleanup)

  it('Klick ruft den Rueckruf der Zielart und verhindert das Neuladen', () => {
    const nav = { onShowGallery: vi.fn(), onShowStory: vi.fn(), onShowSite: vi.fn() }
    render(<Cards items={ITEMS} navigation={nav} />)
    expect(fireEvent.click(screen.getByText('Zum Archiv'))).toBe(false)
    fireEvent.click(screen.getByText('Zu den Themen'))
    fireEvent.click(screen.getByText('Mehr'))
    expect(nav.onShowGallery).toHaveBeenCalledTimes(1)
    expect(nav.onShowStory).toHaveBeenCalledTimes(1)
    expect(nav.onShowSite).toHaveBeenCalledWith('wie-funktioniert')
  })

  it('Strg-Klick bleibt ein gewoehnlicher Link (neuer Tab)', () => {
    const nav = { onShowGallery: vi.fn() }
    render(<Cards items={ITEMS} navigation={nav} />)
    expect(fireEvent.click(screen.getByText('Zum Archiv'), { ctrlKey: true })).toBe(true)
    expect(nav.onShowGallery).not.toHaveBeenCalled()
  })

  it('ohne Navigation: reine Links; Root-Modus nutzt die Adressen der Explore-Seite', () => {
    const { unmount } = render(<Cards items={ITEMS} />)
    expect(screen.getByText('Zum Archiv').closest('a')?.getAttribute('href')).toBe('?view=gallery')
    unmount()
    render(<Cards items={ITEMS} navigation={{ galleryBaseHref: '/explore/x?view=gallery', storyBaseHref: '/explore/x?mode=story' }} />)
    expect(screen.getByText('Zum Archiv').closest('a')?.getAttribute('href')).toBe('/explore/x?view=gallery')
    expect(screen.getByText('Zu den Themen').closest('a')?.getAttribute('href')).toBe('/explore/x?mode=story')
  })

  it('unbekanntes Ziel steht als Fehler da, nicht als toter Link', () => {
    render(<Cards items={[{ title: 'X', text: '', linkLabel: 'Hin', href: '/irgendwo' }]} />)
    expect(screen.getByRole('alert').textContent).toMatch(/Kachel-Ziel "\/irgendwo" ist unbekannt/)
  })
})
