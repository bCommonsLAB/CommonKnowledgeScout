// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReferenceList } from '@/components/library/story/reference-list'

// next/image auf ein einfaches <img> reduzieren (kein Next-Runtime im Test).
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt } = props as { src: string; alt: string }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} />
  },
}))

afterEach(() => cleanup())

describe('ReferenceList', () => {
  it('rendert nichts bei leeren/keinen Verweisen', () => {
    const { container } = render(<ReferenceList references={undefined} />)
    expect(container.firstChild).toBeNull()
    cleanup()
    const { container: c2 } = render(<ReferenceList references={['   ']} />)
    expect(c2.firstChild).toBeNull()
  })

  it('rendert je Format den passenden Renderer', () => {
    const { container } = render(
      <ReferenceList
        references={[
          'https://x/photo.png',
          'https://x/clip.mp4',
          'https://x/talk.mp3',
          'https://x/doc.pdf',
          'https://x/article', // web
        ]}
      />,
    )
    // Bild → <img> in der Bilder-Gruppe
    expect(container.querySelector('[data-format="image"] img')).toBeTruthy()
    // Video/Audio → Player-Elemente
    expect(container.querySelector('[data-format="video"] video')).toBeTruthy()
    expect(container.querySelector('[data-format="audio"] audio')).toBeTruthy()
    // PDF + Web → Links
    expect(screen.getByText('doc.pdf')).toBeTruthy()
    expect(screen.getByText('x/article')).toBeTruthy()
  })

  it('gruppiert in stabiler Reihenfolge (Bilder vor Links)', () => {
    const { container } = render(
      <ReferenceList references={['https://x/link', 'https://x/a.png']} />,
    )
    const formats = Array.from(container.querySelectorAll('[data-format]')).map((el) =>
      el.getAttribute('data-format'),
    )
    expect(formats).toEqual(['image', 'web'])
  })

  it('nutzt den uebergebenen Titel', () => {
    render(<ReferenceList references={['https://x/a.pdf']} title="Quellen" />)
    expect(screen.getByText('Quellen')).toBeTruthy()
  })
})
