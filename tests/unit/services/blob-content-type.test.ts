/**
 * @fileoverview Content-Type fuer Blobs (Befund 23.09.2026: PDFs als image/jpeg).
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/debug/logger', () => ({ FileLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import { blobContentType } from '@/lib/services/azure-storage-service'

describe('blobContentType', () => {
  it('bekannter MIME-Typ gewinnt gegen die Endung', () => {
    expect(blobContentType('jpg', 'application/pdf')).toBe('application/pdf')
  })

  it('PDF ueber die Endung — nie mehr image/jpeg', () => {
    expect(blobContentType('pdf')).toBe('application/pdf')
    expect(blobContentType('.PDF')).toBe('application/pdf')
  })

  it('Bilder wie bisher', () => {
    expect(blobContentType('jpeg')).toBe('image/jpeg')
    expect(blobContentType('webp')).toBe('image/webp')
  })

  it('unbekannte Endung: octet-stream statt falschem Bild-Etikett; leerer/unbrauchbarer MIME zaehlt nicht', () => {
    expect(blobContentType('bin')).toBe('application/octet-stream')
    expect(blobContentType('pdf', '')).toBe('application/pdf')
    expect(blobContentType('pdf', 'application/octet-stream')).toBe('application/pdf')
  })
})
