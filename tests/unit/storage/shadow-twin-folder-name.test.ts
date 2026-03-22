import { describe, expect, it } from 'vitest'
import {
  buildTwinRelativeMediaRef,
  generateShadowTwinFolderName,
  parseTwinRelativeImageRef,
} from '@/lib/storage/shadow-twin-folder-name'

describe('shadow-twin-folder-name', () => {
  it('buildTwinRelativeMediaRef erzeugt Obsidian-kompatiblen Pfad', () => {
    expect(buildTwinRelativeMediaRef('Quelle.pdf', 'img-0.jpeg')).toBe('_Quelle.pdf/img-0.jpeg')
  })

  it('parseTwinRelativeImageRef erkennt gültige Twin-Pfade', () => {
    expect(parseTwinRelativeImageRef('_Aktionstag Wasser DE-web.pdf/img-2.jpeg')).toEqual({
      twinFolderName: '_Aktionstag Wasser DE-web.pdf',
      imageFileName: 'img-2.jpeg',
    })
  })

  it('parseTwinRelativeImageRef lehnt einfachen Dateinamen ab', () => {
    expect(parseTwinRelativeImageRef('img-0.jpeg')).toBeNull()
  })

  it('generateShadowTwinFolderName stimmt mit bekanntem PDF-Namen überein', () => {
    expect(generateShadowTwinFolderName('doc.pdf')).toBe('_doc.pdf')
  })
})
