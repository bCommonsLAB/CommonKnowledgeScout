/**
 * Characterization Tests fuer file-preview/extension-map.ts
 * (Welle 3-II-a, Schritt 3 — Sicherheitsnetz vor weiteren Splits).
 *
 * Fixiert das Soll-Verhalten der pure-Funktionen, die aus
 * `file-preview.tsx` extrahiert wurden:
 * - `getFileType`
 * - `extractTranscriptLang`
 * - `getTransformationLabel`
 */

import { describe, it, expect } from 'vitest'
import {
  getFileType,
  extractTranscriptLang,
  getTransformationLabel,
  TRANSCRIPT_LANG_LABELS,
} from '@/components/library/file-preview/extension-map'
import type { StorageItem } from '@/lib/storage/types'

function makeItem(name: string, id = 'item-1'): StorageItem {
  return {
    id,
    parentId: 'root',
    type: 'file',
    metadata: {
      name,
      size: 100,
      modifiedAt: new Date('2026-01-01'),
      mimeType: 'application/octet-stream',
    },
  }
}

describe('getFileType', () => {
  it.each([
    ['doc.md', 'markdown'],
    ['doc.MD', 'markdown'],
    ['doc.mdx', 'markdown'],
    ['doc.txt', 'markdown'],
    ['video.mp4', 'video'],
    ['video.MOV', 'video'],
    ['audio.mp3', 'audio'],
    ['audio.opus', 'audio'],
    ['photo.jpg', 'image'],
    ['photo.WEBP', 'image'],
    ['report.pdf', 'pdf'],
    ['letter.docx', 'docx'],
    ['letter.odt', 'docx'],
    ['slides.pptx', 'pptx'],
    ['table.xlsx', 'xlsx'],
    ['link.url', 'website'],
    ['unbekannt.foobar', 'unknown'],
    ['code.py', 'markdown'],
    ['data.json', 'markdown'],
    ['style.css', 'markdown'],
  ])('liefert fuer %s -> %s', (name, expected) => {
    expect(getFileType(name)).toBe(expected)
  })

  it('liefert "unknown" bei Dateinamen ohne Endung', () => {
    expect(getFileType('Makefile')).toBe('unknown')
  })
})

describe('extractTranscriptLang', () => {
  it.each([
    ['Voice-test.en.md', 'en'],
    ['interview.de.md', 'de'],
    ['notes.FR.MD', 'fr'],
  ])('extrahiert Sprache aus %s -> %s', (name, expected) => {
    expect(extractTranscriptLang(name)).toBe(expected)
  })

  it('liefert null, wenn keine Sprache erkennbar ist', () => {
    expect(extractTranscriptLang('plain.md')).toBeNull()
    expect(extractTranscriptLang('multi.lang.txt')).toBeNull()
  })
})

describe('getTransformationLabel', () => {
  it('liefert ein lesbares Label aus Mongo-Shadow-Twin-ID', () => {
    const item = makeItem(
      'irgendwas.md',
      'mongo-shadow-twin:lib%2D1::source%2D1::transformation::de::book',
    )
    const label = getTransformationLabel(item)
    expect(label).toContain('DE')
    expect(label).toContain('book')
  })

  it('liefert ein Label aus dem Dateinamen-Pattern (template.lang.md)', () => {
    const item = makeItem('mein-doc.book.de.md')
    const label = getTransformationLabel(item)
    expect(label).toContain('DE')
    expect(label).toContain('Deutsch')
    expect(label).toContain('book')
  })

  it('faellt auf den Original-Dateinamen zurueck, wenn kein Pattern matched', () => {
    const item = makeItem('komischer-name.txt')
    expect(getTransformationLabel(item)).toBe('komischer-name.txt')
  })
})

describe('TRANSCRIPT_LANG_LABELS', () => {
  it('enthaelt mindestens DE/EN/FR/IT/ES/PT', () => {
    expect(TRANSCRIPT_LANG_LABELS.de).toBe('Deutsch')
    expect(TRANSCRIPT_LANG_LABELS.en).toBe('English')
    expect(TRANSCRIPT_LANG_LABELS.fr).toBe('Français')
    expect(TRANSCRIPT_LANG_LABELS.it).toBe('Italiano')
    expect(TRANSCRIPT_LANG_LABELS.es).toBe('Español')
    expect(TRANSCRIPT_LANG_LABELS.pt).toBe('Português')
  })
})
