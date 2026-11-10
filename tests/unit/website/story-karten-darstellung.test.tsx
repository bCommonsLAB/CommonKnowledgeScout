// @vitest-environment jsdom
/**
 * Karten-Darstellungen der Story-Sektion (Owner 09.11.2026, Figma S2-A/S2-B):
 * Karte mit Zitatmarke und Klickweg, Spalte ohne Obergrenze, Absatzvariante
 * mit Zeilen (Karte + Block), Bloecken voller Breite und Rest-Raster.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { DocCardMeta, DocReference } from '@ks/contracts'
import type { Nachricht } from '@ks/module-story/react'
import { WebsiteStoryVortragskarte } from '@/components/library/website/story/website-story-vortragskarte'
import { WebsiteStoryVortragsspalte } from '@/components/library/website/story/website-story-vortragsspalte'
import { WebsiteStoryAntwortZweispaltig } from '@/components/library/website/story/website-story-antwort-zweispaltig'
import { kartenEintraege } from '@/lib/website/story-karten'

vi.mock('@ks/module-explorer/react', () => ({
  DocumentCard: ({ doc, onOpen, teaser }: { doc: DocCardMeta; onOpen?: (d: DocCardMeta) => void; teaser?: boolean }) => (
    <button type="button" data-testid={`karte-${doc.fileId}`} data-teaser={teaser ? 'true' : 'false'} onClick={() => onOpen?.(doc)}>{doc.title}</button>
  ),
}))
vi.mock('@ks/module-story/react', () => ({
  AntwortText: ({ text, markenVerborgen }: { text: string; markenVerborgen?: boolean }) => <div data-antwort-text data-marken-verborgen={markenVerborgen ? 'true' : undefined}>{text}</div>,
}))
vi.mock('@ks/ui', () => ({
  Zitatmarke: ({ nummer }: { nummer: number }) => <span data-zitatmarke>{nummer}</span>,
}))

afterEach(cleanup)

const ref = (number: number, fileId: string): DocReference => ({ number, fileId, description: '' })
const doc = (fileId: string, title: string): DocCardMeta => ({ id: fileId, fileId, title, slug: `slug-${fileId}` } as DocCardMeta)

describe('WebsiteStoryVortragskarte', () => {
  it('zeigt die Karte in der Teaser-Form mit Zitatmarke und reicht beim Klick das Dokument weiter', () => {
    const onOpen = vi.fn()
    const d = doc('a', 'Talk A')
    const { container } = render(<WebsiteStoryVortragskarte eintrag={{ nummer: 3, fileId: 'a', titel: 'Talk A', doc: d }} libraryId="lib" onOpen={onOpen} />)
    expect(container.querySelector('[data-zitatmarke]')?.textContent).toBe('3')
    expect(container.querySelector('#beleg-3')).not.toBeNull()
    expect(screen.getByTestId('karte-a').getAttribute('data-teaser')).toBe('true')
    fireEvent.click(screen.getByTestId('karte-a'))
    expect(onOpen).toHaveBeenCalledWith(d)
  })

  it('solange die Karte laedt: Platzhalter mit Nummer und Titel, keine Karte', () => {
    const { container } = render(<WebsiteStoryVortragskarte eintrag={{ nummer: 2, fileId: 'b', titel: 'Talk B laedt', doc: null }} libraryId="lib" onOpen={vi.fn()} />)
    expect(container.querySelector('[data-story-karte-laedt="true"]')).not.toBeNull()
    expect(container.querySelector('[aria-busy="true"]')?.textContent).toContain('Talk B laedt')
    expect(container.querySelector('[data-zitatmarke]')?.textContent).toBe('2')
    expect(screen.queryByTestId('karte-b')).toBeNull()
  })
})

describe('WebsiteStoryVortragsspalte', () => {
  it('rendert alle 20 Karten in Reihenfolge, Titel und den Verweis „weitere"', () => {
    const belege = Array.from({ length: 20 }, (_, i) => ref(i + 1, `f${i + 1}`))
    const eintraege = kartenEintraege(belege, belege.map((b) => doc(b.fileId, `T${b.number}`)))
    const onWeitere = vi.fn()
    const { container } = render(<WebsiteStoryVortragsspalte eintraege={eintraege} libraryId="lib" titel="Genannte Talks" weitereLabel="weitere Talks" onWeitere={onWeitere} onOpen={vi.fn()} />)
    expect(container.querySelectorAll('[data-story-karte]')).toHaveLength(20)
    expect(Array.from(container.querySelectorAll('[data-zitatmarke]')).map((m) => m.textContent)).toEqual(belege.map((b) => String(b.number)))
    expect(screen.getByText('Genannte Talks')).toBeTruthy()
    fireEvent.click(screen.getByText(/weitere Talks/))
    expect(onWeitere).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[data-story-karten="column"]')).not.toBeNull()
  })

  it('ohne Eintraege nichts', () => {
    const { container } = render(<WebsiteStoryVortragsspalte eintraege={[]} libraryId="lib" onOpen={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('WebsiteStoryAntwortZweispaltig', () => {
  const belege = [ref(1, 'a'), ref(2, 'b'), ref(3, 'c')]
  const antwort: Nachricht = {
    id: 'q1', art: 'antwort', createdAt: '2026-11-09T00:00:00Z', text: 'Einleitung.\n\n- Talk A [1] ist toll.\n- Talk B [2] auch, wie A [1].\n\nNochmal A [1].\n\nSchluss.', belege,
  }

  it('Zeile je Block mit neuer Nummer, volle Breite sonst, Rest-Raster fuer nicht zugeordnete Dokumente', () => {
    const eintraege = kartenEintraege(belege, [doc('a', 'A'), doc('b', 'B'), doc('c', 'C')])
    const onWeitere = vi.fn()
    const { container } = render(
      <WebsiteStoryAntwortZweispaltig antwort={antwort} markenVerborgen={true} eintraege={eintraege} libraryId="lib" onOpen={vi.fn()} restTitel="Weitere genannte Talks" weitereLabel="weitere Talks" onWeitere={onWeitere} />,
    )
    const zeilen = container.querySelectorAll('[data-story-absatz-zeile]')
    expect(Array.from(zeilen).map((z) => z.getAttribute('data-story-absatz-zeile'))).toEqual(['1', '2'])
    // 5 Bloecke: Einleitung, Punkt A, Punkt B, „Nochmal A" (keine neue Nummer → volle Breite), Schluss
    expect(container.querySelectorAll('[data-antwort-text]')).toHaveLength(5)
    expect(container.querySelectorAll('[data-antwort-text][data-marken-verborgen="true"]')).toHaveLength(5)
    // Jede Zeile traegt ihre Karte schon als Platzhalter, wenn die Dokumente noch laden
    cleanup()
    const laedt = render(
      <WebsiteStoryAntwortZweispaltig antwort={antwort} markenVerborgen={false} eintraege={kartenEintraege(belege, [], true)} libraryId="lib" onOpen={vi.fn()} restTitel="R" weitereLabel="weitere Talks" onWeitere={vi.fn()} />,
    )
    expect(laedt.container.querySelectorAll('[data-story-absatz-zeile]')).toHaveLength(2)
    expect(laedt.container.querySelectorAll('[data-story-karte-laedt="true"]')).toHaveLength(3)
    cleanup()
    // C ist zitiert, aber in keinem Block → Rest-Raster
    const zweiter = render(
      <WebsiteStoryAntwortZweispaltig antwort={antwort} markenVerborgen={true} eintraege={eintraege} libraryId="lib" onOpen={vi.fn()} restTitel="Weitere genannte Talks" weitereLabel="weitere Talks" onWeitere={onWeitere} />,
    )
    const raster = zweiter.container.querySelector('[data-story-karten="raster"]')
    expect(raster).not.toBeNull()
    expect(raster?.querySelectorAll('[data-story-karte]')).toHaveLength(1)
    expect(raster?.textContent).toContain('C')
    fireEvent.click(screen.getByText(/weitere Talks/))
    expect(onWeitere).toHaveBeenCalledTimes(1)
  })
})
