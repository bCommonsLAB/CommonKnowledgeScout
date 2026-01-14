/**
 * @fileoverview Unit-Tests für useTestimonials Hook - API-Normalisierung
 * 
 * @description
 * Testet die Normalisierungs-Logik von useTestimonials:
 * - Normalisiert API-Response korrekt zu TestimonialItem[]
 * - Handhabt verschiedene API-Response-Formate
 * - Extrahiert Metadaten korrekt
 */

import { describe, it, expect } from 'vitest'
import type { TestimonialItem } from '@/components/shared/testimonial-list'

/**
 * Simuliert die Normalisierungs-Logik aus useTestimonials
 * (ohne React Hook zu verwenden)
 */
function normalizeApiResponse(apiItems: unknown[]): TestimonialItem[] {
  return apiItems
    .map((it) => (it && typeof it === 'object') ? (it as Record<string, unknown>) : null)
    .filter((it): it is Record<string, unknown> => !!it)
    .map((it) => {
      const testimonialId = typeof it.testimonialId === 'string' ? it.testimonialId : 'unknown'
      const folderId = typeof it.folderId === 'string' ? it.folderId : undefined

      const metaObj = it.meta && typeof it.meta === 'object' 
        ? (it.meta as Record<string, unknown>) 
        : null
      
      const createdAt = typeof metaObj?.createdAt === 'string' ? metaObj.createdAt : null
      const speakerName = typeof metaObj?.speakerName === 'string' ? metaObj.speakerName : null
      const text = typeof metaObj?.text === 'string' ? metaObj.text : null

      const audioObj = it.audio && typeof it.audio === 'object' 
        ? (it.audio as Record<string, unknown>) 
        : null
      const audioFileName = typeof audioObj?.fileName === 'string' ? audioObj.fileName : null
      const hasAudio = !!audioObj

      return {
        testimonialId,
        folderId,
        createdAt,
        speakerName,
        text,
        hasAudio,
        audioFileName,
      }
    })
}

describe('useTestimonials Normalisierung', () => {
  it('sollte API-Response korrekt zu TestimonialItem[] normalisieren', () => {
    const apiResponse = [
      {
        testimonialId: 'test-1',
        folderId: 'folder-1',
        status: 'ready',
        meta: {
          speakerName: 'Max Mustermann',
          createdAt: '2026-01-14T12:00:00.000Z',
          text: 'Das ist ein Testimonial.',
        },
        audio: {
          fileId: 'audio-1',
          fileName: 'audio.webm',
          url: 'https://example.com/audio.webm',
        },
      },
    ]

    const result = normalizeApiResponse(apiResponse)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      testimonialId: 'test-1',
      folderId: 'folder-1',
      speakerName: 'Max Mustermann',
      createdAt: '2026-01-14T12:00:00.000Z',
      text: 'Das ist ein Testimonial.',
      hasAudio: true,
      audioFileName: 'audio.webm',
    })
  })

  it('sollte Testimonials ohne Audio korrekt normalisieren', () => {
    const apiResponse = [
      {
        testimonialId: 'test-1',
        folderId: 'folder-1',
        status: 'ready',
        meta: {
          speakerName: 'Petra Mustermann',
          createdAt: '2026-01-15T10:00:00.000Z',
          text: 'Ein weiteres Testimonial.',
        },
        audio: null,
      },
    ]

    const result = normalizeApiResponse(apiResponse)

    expect(result[0]).toMatchObject({
      testimonialId: 'test-1',
      speakerName: 'Petra Mustermann',
      text: 'Ein weiteres Testimonial.',
      hasAudio: false,
      audioFileName: null,
    })
  })

  it('sollte Testimonials mit pending-Status korrekt normalisieren', () => {
    const apiResponse = [
      {
        testimonialId: 'test-2',
        folderId: 'folder-2',
        status: 'pending',
        meta: {
          speakerName: null,
          createdAt: '2026-01-16T14:00:00.000Z',
          text: null,
        },
        audio: {
          fileId: 'audio-2',
          fileName: 'audio.mp3',
          url: 'https://example.com/audio.mp3',
        },
      },
    ]

    const result = normalizeApiResponse(apiResponse)

    expect(result[0]).toMatchObject({
      testimonialId: 'test-2',
      speakerName: null,
      text: null,
      hasAudio: true,
      audioFileName: 'audio.mp3',
    })
  })

  it('sollte ungültige Einträge filtern', () => {
    const apiResponse = [
      { testimonialId: 'test-1', meta: { text: 'Valid' } },
      null,
      undefined,
      'invalid-string',
      { testimonialId: 'test-2', meta: { text: 'Also valid' } },
    ]

    const result = normalizeApiResponse(apiResponse)

    expect(result).toHaveLength(2)
    expect(result[0].testimonialId).toBe('test-1')
    expect(result[1].testimonialId).toBe('test-2')
  })

  it('sollte fehlende Felder mit Defaults behandeln', () => {
    const apiResponse = [
      {
        testimonialId: 'test-1',
        // folderId fehlt
        meta: {
          // speakerName fehlt
          createdAt: '2026-01-14T12:00:00.000Z',
          // text fehlt
        },
        // audio fehlt
      },
    ]

    const result = normalizeApiResponse(apiResponse)

    expect(result[0]).toMatchObject({
      testimonialId: 'test-1',
      folderId: undefined,
      speakerName: null,
      text: null,
      hasAudio: false,
      audioFileName: null,
    })
    expect(result[0].createdAt).toBe('2026-01-14T12:00:00.000Z')
  })

  it('sollte leeres Array korrekt handhaben', () => {
    const result = normalizeApiResponse([])
    expect(result).toEqual([])
  })
})
