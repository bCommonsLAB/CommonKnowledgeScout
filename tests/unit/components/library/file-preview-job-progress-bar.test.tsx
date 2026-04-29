// @vitest-environment jsdom

/**
 * Characterization Tests fuer file-preview/job-progress-bar.tsx
 * (Welle 3-II-a, Schritt 3).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { JobProgressBar, getPhaseLabel } from '@/components/library/file-preview/job-progress-bar'

afterEach(() => {
  cleanup()
})

describe('getPhaseLabel', () => {
  it.each([
    [undefined, ''],
    ['', ''],
    ['extract', 'Transkript'],
    ['extract_pdf', 'Transkript'],
    ['transcribe', 'Transkript'],
    ['transform', 'Transformation'],
    ['template', 'Transformation'],
    ['ingest', 'Story'],
    ['publish', 'Story'],
    ['running', ''],
    ['initializing', ''],
    ['unknown_phase', ''],
  ])('liefert fuer phase=%s -> %s', (phase, expected) => {
    expect(getPhaseLabel(phase)).toBe(expected)
  })

  it('ist case-insensitive', () => {
    expect(getPhaseLabel('EXTRACT')).toBe('Transkript')
    expect(getPhaseLabel('Transform')).toBe('Transformation')
  })
})

describe('JobProgressBar', () => {
  it('zeigt "In Warteschlange..." bei status=queued', () => {
    render(<JobProgressBar status="queued" />)
    expect(screen.getByText('In Warteschlange...')).toBeTruthy()
  })

  it('zeigt "Abgeschlossen" bei status=completed', () => {
    render(<JobProgressBar status="completed" />)
    expect(screen.getByText('Abgeschlossen')).toBeTruthy()
  })

  it('zeigt "Fehlgeschlagen" bei status=failed', () => {
    render(<JobProgressBar status="failed" />)
    expect(screen.getByText('Fehlgeschlagen')).toBeTruthy()
  })

  it('zeigt phase-spezifischen Status-Text, wenn running + phase gesetzt', () => {
    render(<JobProgressBar status="running" phase="extract" />)
    expect(screen.getByText('Transkript wird verarbeitet...')).toBeTruthy()
  })

  it('zeigt Progress-Prozentzahl bei status=running', () => {
    render(<JobProgressBar status="running" progress={42} />)
    expect(screen.getByText('42%')).toBeTruthy()
  })

  it('clamped Progress auf 0..100', () => {
    const { rerender } = render(<JobProgressBar status="running" progress={150} />)
    expect(screen.getByText('100%')).toBeTruthy()
    rerender(<JobProgressBar status="running" progress={-10} />)
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('bereinigt Mistral-OCR-Messages', () => {
    render(
      <JobProgressBar
        status="running"
        message="Mistral-OCR: Seite 5/10 - Args: { foo: 1 }"
      />
    )
    expect(screen.getByText('Seite 5/10')).toBeTruthy()
  })
})
