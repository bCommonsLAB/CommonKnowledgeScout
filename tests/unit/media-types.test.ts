import { describe, expect, it } from 'vitest'
import {
  getMediaKind,
  isPipelineSupported,
  mediaKindToJobType,
} from '@/lib/media-types'

describe('media-types', () => {
  describe('getMediaKind', () => {
    const makeItem = (name: string, mimeType = '') => ({
      id: '_',
      parentId: '_',
      type: 'file' as const,
      metadata: { name, size: 0, modifiedAt: new Date(0), mimeType },
    })

    it('erkennt Bilder an Dateiendung', () => {
      expect(getMediaKind(makeItem('texture.jpg'))).toBe('image')
      expect(getMediaKind(makeItem('cover.png'))).toBe('image')
      expect(getMediaKind(makeItem('icon.webp'))).toBe('image')
      expect(getMediaKind(makeItem('photo.jpeg'))).toBe('image')
    })

    it('erkennt Bilder an MIME-Type', () => {
      expect(getMediaKind(makeItem('file', 'image/jpeg'))).toBe('image')
      expect(getMediaKind(makeItem('file', 'image/png'))).toBe('image')
    })
  })

  describe('isPipelineSupported', () => {
    it('unterstuetzt Bilder in der Pipeline', () => {
      expect(isPipelineSupported('image')).toBe(true)
    })

    it('unterstuetzt weiterhin PDF, Audio, Video, Markdown', () => {
      expect(isPipelineSupported('pdf')).toBe(true)
      expect(isPipelineSupported('audio')).toBe(true)
      expect(isPipelineSupported('video')).toBe(true)
      expect(isPipelineSupported('markdown')).toBe(true)
    })

    it('unterstuetzt keine unbekannten Typen', () => {
      expect(isPipelineSupported('unknown')).toBe(false)
      expect(isPipelineSupported('link')).toBe(false)
    })
  })

  describe('mediaKindToJobType', () => {
    it('mappt image auf image-JobType', () => {
      expect(mediaKindToJobType('image')).toBe('image')
    })

    it('mappt markdown auf text-JobType', () => {
      expect(mediaKindToJobType('markdown')).toBe('text')
    })

    it('mappt pdf/audio/video korrekt', () => {
      expect(mediaKindToJobType('pdf')).toBe('pdf')
      expect(mediaKindToJobType('audio')).toBe('audio')
      expect(mediaKindToJobType('video')).toBe('video')
    })

    it('mappt Office-Typen auf office', () => {
      expect(mediaKindToJobType('docx')).toBe('office')
      expect(mediaKindToJobType('xlsx')).toBe('office')
      expect(mediaKindToJobType('pptx')).toBe('office')
    })
  })
})
