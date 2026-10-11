// @vitest-environment jsdom

/**
 * Welle J2 (Viewer): `EventSlides` reicht abrufbare Adressen durch und zeigt
 * nackte Dateinamen als „nicht aufgeloest" — raet keinen Wurzel-Pfad mehr.
 */

import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('next/image', () => ({
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} data-testid="slide-img" />,
}))

vi.mock('@ks/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock('@ks/i18n/react', () => ({
  useTranslation: () => ({ locale: 'de', t: (key: string) => key }),
}))

import { EventSlides, isDisplayableImageUrl } from '@/components/event-slides'

afterEach(() => {
  cleanup()
})

describe('isDisplayableImageUrl', () => {
  it('akzeptiert http(s) und Site-absolute Pfade, sonst nichts', () => {
    expect(isDisplayableImageUrl('https://blob/x.jpeg')).toBe(true)
    expect(isDisplayableImageUrl('/api/storage/streaming-url?x=1')).toBe(true)
    expect(isDisplayableImageUrl('preview_001.jpg')).toBe(false)
    expect(isDisplayableImageUrl('ordner/preview_001.jpg')).toBe(false)
    expect(isDisplayableImageUrl(undefined)).toBe(false)
  })
})

describe('EventSlides', () => {
  it('zeigt absolute URLs als Bild', () => {
    render(<EventSlides slides={[{ page_num: 1, title: 'Eins', image_url: 'https://blob/preview_001.jpeg' }]} />)
    expect(screen.getByTestId('slide-img').getAttribute('src')).toBe('https://blob/preview_001.jpeg')
    expect(screen.queryByTestId('slide-image-unresolved')).toBeNull()
  })

  it('zeigt einen nackten Dateinamen als nicht aufgeloest, ohne Streaming-URL zu raten', () => {
    render(<EventSlides slides={[{ page_num: 3, title: 'Drei', image_url: 'preview_003.jpg' }]} />)
    expect(screen.queryByTestId('slide-img')).toBeNull()
    const hinweis = screen.getByTestId('slide-image-unresolved')
    expect(hinweis.textContent).toContain('event.imageUnresolved')
    expect(hinweis.textContent).toContain('preview_003.jpg')
    expect(document.body.innerHTML).not.toContain('streaming-url')
  })

  it('zeigt „kein Bild" ohne image_url und nichts ohne Folien', () => {
    const { container } = render(<EventSlides slides={[]} />)
    expect(container.innerHTML).toBe('')
    render(<EventSlides slides={[{ page_num: 1, title: 'Ohne' }]} />)
    expect(screen.getByText('event.noImage')).toBeTruthy()
  })
})
