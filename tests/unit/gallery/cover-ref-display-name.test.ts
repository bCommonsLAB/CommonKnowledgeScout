import { describe, expect, it } from 'vitest'
import { displayBasenameFromCoverRef } from '@/lib/gallery/cover-ref-display-name'

describe('displayBasenameFromCoverRef', () => {
  it('liefert letztes URL-Segment für https', () => {
    expect(
      displayBasenameFromCoverRef(
        'https://blob.example.net/c/books/x/9172_basecolor.jpg?s=1'
      )
    ).toBe('9172_basecolor.jpg')
  })

  it('liefert Dateinamen bei relativem Pfad', () => {
    expect(displayBasenameFromCoverRef('ordner/foo.png')).toBe('foo.png')
    expect(displayBasenameFromCoverRef('foo.png')).toBe('foo.png')
  })

  it('liefert undefined bei leer', () => {
    expect(displayBasenameFromCoverRef(undefined)).toBeUndefined()
    expect(displayBasenameFromCoverRef('   ')).toBeUndefined()
  })
})
