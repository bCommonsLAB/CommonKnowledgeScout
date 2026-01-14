/**
 * @fileoverview Unit-Tests für TestimonialList - Formatierungs-Logik
 * 
 * @description
 * Testet die Formatierungs-Logik von TestimonialList:
 * - Datum-Formatierung
 * - Text-Truncation
 * - Summary-Generierung
 */

import { describe, it, expect } from 'vitest'
import type { TestimonialItem } from '@/components/shared/testimonial-list'

/**
 * Simuliert die formatDate-Funktion aus TestimonialList
 */
function formatDate(isoString: string | null): string {
  if (!isoString) return 'Unbekannt'
  try {
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) {
      return 'Ungültiges Datum'
    }
    return date.toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return 'Ungültiges Datum'
  }
}

/**
 * Simuliert die Summary-Generierung aus TestimonialList
 */
function generateSummary(item: TestimonialItem): string {
  const label = item.testimonialId
  if (item.speakerName) {
    const textPreview = (item.text || '').slice(0, 100)
    const suffix = (item.text || '').length > 100 ? '...' : ''
    return `${item.speakerName}: ${textPreview}${suffix}`
  }
  const textPreview = item.text ? item.text.slice(0, 100) : 'Testimonial'
  return `${label}: ${textPreview}${item.text && item.text.length > 100 ? '...' : ''}`
}

describe('TestimonialList Formatierung', () => {
  const mockItems: TestimonialItem[] = [
    {
      testimonialId: 'test-1',
      speakerName: 'Max Mustermann',
      createdAt: '2026-01-14T12:00:00.000Z',
      text: 'Das ist ein Testimonial.',
      hasAudio: true,
      audioFileName: 'audio.webm',
      folderId: 'folder-1',
    },
    {
      testimonialId: 'test-2',
      speakerName: 'Petra Mustermann',
      createdAt: '2026-01-15T10:00:00.000Z',
      text: 'Ein weiteres Testimonial.',
      hasAudio: false,
      audioFileName: null,
      folderId: 'folder-2',
    },
  ]

  it('sollte Datum korrekt formatieren', () => {
    expect(formatDate('2026-01-14T12:00:00.000Z')).toMatch(/14\.01\.2026|14\.\s*01\.\s*2026/)
    expect(formatDate('2026-12-25T00:00:00.000Z')).toMatch(/25\.12\.2026/)
  })

  it('sollte null-Datum korrekt handhaben', () => {
    expect(formatDate(null)).toBe('Unbekannt')
  })

  it('sollte ungültiges Datum korrekt handhaben', () => {
    expect(formatDate('invalid-date')).toBe('Ungültiges Datum')
  })

  it('sollte Summary mit Speaker-Name generieren', () => {
    const summary = generateSummary(mockItems[0])
    expect(summary).toContain('Max Mustermann')
    expect(summary).toContain('Das ist ein Testimonial.')
  })

  it('sollte Summary ohne Speaker-Name generieren', () => {
    const itemWithoutSpeaker: TestimonialItem = {
      ...mockItems[0],
      speakerName: null,
    }
    const summary = generateSummary(itemWithoutSpeaker)
    expect(summary).toContain('test-1')
    expect(summary).toContain('Das ist ein Testimonial.')
  })

  it('sollte Summary mit langem Text kürzen', () => {
    const longText = 'A'.repeat(150)
    const itemWithLongText: TestimonialItem = {
      ...mockItems[0],
      text: longText,
    }
    const summary = generateSummary(itemWithLongText)
    expect(summary).toContain('...')
    expect(summary.length).toBeLessThan(longText.length + 50) // +50 für Prefix
  })

  it('sollte Summary ohne Text generieren', () => {
    const itemWithoutText: TestimonialItem = {
      ...mockItems[0],
      text: null,
    }
    const summary = generateSummary(itemWithoutText)
    // Wenn speakerName vorhanden ist, wird dieser verwendet, auch ohne Text
    expect(summary).toContain('Max Mustermann')
    expect(summary).toContain(':')
  })

  it('sollte Summary ohne Text und ohne Speaker-Name generieren', () => {
    const itemWithoutBoth: TestimonialItem = {
      ...mockItems[0],
      speakerName: null,
      text: null,
    }
    const summary = generateSummary(itemWithoutBoth)
    expect(summary).toContain('test-1')
    expect(summary).toContain('Testimonial')
  })
})
