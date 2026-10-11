/**
 * Welle J Nachzug 2: Seitenbilder im Twin-Ordner werden auch dann zur
 * Registrierung eingeplant, wenn der Twin schon andere Fragmente (OCR-Bilder)
 * traegt — `zaehleRekonstruierbareSeitenbilder` in reconstruct-from-storage.ts.
 */
import { describe, expect, it } from 'vitest'
import { zaehleRekonstruierbareSeitenbilder } from '@/lib/shadow-twin/reconstruct-from-storage'

const ordner = [
  { type: 'file', metadata: { name: 'preview_001.jpg' } },
  { type: 'file', metadata: { name: 'page_001.jpeg' } },
  { type: 'file', metadata: { name: 'preview_002.jpg' } },
  { type: 'file', metadata: { name: 'page_002.jpeg' } },
  { type: 'file', metadata: { name: 'page_001.de.md' } },
  { type: 'file', metadata: { name: 'img-0.jpeg' } },
  { type: 'folder', metadata: { name: 'preview_003.jpg' } },
]

describe('zaehleRekonstruierbareSeitenbilder', () => {
  it('zaehlt Seitenbilder trotz vorhandener OCR-Fragmente (Befund 11.10.: 0 statt 174)', () => {
    expect(zaehleRekonstruierbareSeitenbilder(['img-0.jpeg', 'img-1.jpeg'], ordner)).toBe(4)
  })

  it('laesst schon registrierte Seitenbilder aus und ignoriert Markdown, OCR-Bilder und Ordner', () => {
    expect(zaehleRekonstruierbareSeitenbilder(['preview_001.jpg', 'page_001.jpeg', undefined], ordner)).toBe(2)
    expect(zaehleRekonstruierbareSeitenbilder(['preview_001.jpg', 'page_001.jpeg', 'preview_002.jpg', 'page_002.jpeg'], ordner)).toBe(0)
  })

  it('ohne Fragmente wie bisher: alle Seitenbilder', () => {
    expect(zaehleRekonstruierbareSeitenbilder([], ordner)).toBe(4)
    expect(zaehleRekonstruierbareSeitenbilder([], [])).toBe(0)
  })
})
