/**
 * @fileoverview Im Material fuer das Sprachmodell sagt jede Quelle, was ihr Text ist —
 * nur Audio und Video sind Transkripte.
 */

import { describe, it, expect } from 'vitest'
import { inhaltsArt } from '@/lib/creation/composite-transcript'

describe('inhaltsArt', () => {
  it('nennt PDF-Text nicht Transkript', () => {
    expect(inhaltsArt('application/pdf')).toBe('PDF-Text')
    expect(inhaltsArt('audio/mp4')).toBe('Audio-Transkript')
    expect(inhaltsArt('video/mp4')).toBe('Video-Transkript')
    expect(inhaltsArt('text/markdown')).toBe('Markdown')
    expect(inhaltsArt('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('Dokument-Text')
    expect(inhaltsArt('image/png')).toBe('Bild (kein Text)')
  })
})
