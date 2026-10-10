import { describe, expect, it } from 'vitest'
import { istMarkdownQuelle } from '@/lib/external-jobs/phase-shadow-twin-loader'

/**
 * Befund 10.10.2026 (Job 4e25acc5): transformation_starten ueber die Bruecke legt auf eine PDF
 * einen Text-Job mit mediaType 'markdown' an. Der Lader las daraufhin die PDF-Bytes als Text
 * und schickte 2,6 MB „%PDF-1.4…" an den Transformer. Der Dateiname entscheidet.
 */
describe('istMarkdownQuelle', () => {
  it('Markdown-Datei ist Markdown — unabhaengig vom Job-Typ', () => {
    expect(istMarkdownQuelle({ name: 'Sammeldatei.md', mediaType: 'markdown', jobType: 'text' })).toBe(true)
    expect(istMarkdownQuelle({ name: 'NOTIZ.MD' })).toBe(true)
    expect(istMarkdownQuelle({ name: 'a.markdown', jobType: 'pdf' })).toBe(true)
  })

  it('PDF/Audio bleibt keine Markdown-Quelle, auch wenn der Job Text/Markdown sagt', () => {
    expect(istMarkdownQuelle({ name: '2026-08-19 Armutsheft Sascha Britsko.pdf', mediaType: 'markdown', jobType: 'text' })).toBe(false)
    expect(istMarkdownQuelle({ name: 'Teil 4.m4a', jobType: 'text' })).toBe(false)
  })

  it('ohne erkennbare Endung gilt die Angabe des Jobs', () => {
    expect(istMarkdownQuelle({ name: 'Notiz ohne Endung', mediaType: 'markdown' })).toBe(true)
    expect(istMarkdownQuelle({ name: 'Notiz ohne Endung', jobType: 'text' })).toBe(true)
    expect(istMarkdownQuelle({ name: 'Notiz ohne Endung' })).toBe(false)
  })
})
