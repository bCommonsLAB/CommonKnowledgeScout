// @vitest-environment jsdom

import * as React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { UseLiveTranscriptionOptions } from '@/components/shared/use-live-transcription'

/**
 * Beweis-Ziel: Der Kontext (Thema als `prompt`, Eigennamen als `keywords`) erreicht
 * den Hook. Genau hier klaffte die Kette vorher — Endpunkt und Ticket-Client nahmen
 * `prompt` bereits an, die Oberflaeche reichte ihn aber nicht durch.
 */

const useLiveTranscription = vi.fn()

vi.mock('@/components/shared/use-live-transcription', () => ({
  useLiveTranscription: (options: UseLiveTranscriptionOptions) => {
    useLiveTranscription(options)
    return {
      snapshot: {
        status: 'bereit',
        connection: 'getrennt',
        segments: [],
        pendingText: '',
        gaps: [],
        bufferedSeconds: 0,
        elapsedMs: 0,
        error: null,
      },
      liveStream: null,
      isRecording: false,
      start: vi.fn(),
      stop: vi.fn(),
      canUseLiveTranscription: true,
    }
  },
}))

vi.mock('@ks/ui', () => ({
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
}))

beforeEach(() => {
  cleanup()
  useLiveTranscription.mockClear()
})

describe('LiveDictationTextarea', () => {
  it('reicht Thema und Begriffe an den Hook durch', async () => {
    const { LiveDictationTextarea } = await import('@/components/shared/live-dictation-textarea')

    render(
      <LiveDictationTextarea
        label="Erzähl mir was"
        value=""
        onChange={() => {}}
        prompt="Interview auf einem Permakultur-Hof in Südtirol"
        keywords={['Permakultur', 'Vinschgau']}
        sourceLanguage="de"
      />
    )

    const options = useLiveTranscription.mock.calls[0][0] as UseLiveTranscriptionOptions
    expect(options.prompt).toBe('Interview auf einem Permakultur-Hof in Südtirol')
    expect(options.keywords).toEqual(['Permakultur', 'Vinschgau'])
    expect(options.sourceLanguage).toBe('de')
  })

  it('kommt ohne Kontext aus', async () => {
    const { LiveDictationTextarea } = await import('@/components/shared/live-dictation-textarea')

    render(<LiveDictationTextarea label="Notiz" value="" onChange={() => {}} />)

    const options = useLiveTranscription.mock.calls[0][0] as UseLiveTranscriptionOptions
    expect(options.prompt).toBeUndefined()
    expect(options.keywords).toBeUndefined()
  })
})
