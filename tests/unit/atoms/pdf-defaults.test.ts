import { describe, expect, it } from 'vitest'
import { getEffectivePdfDefaults } from '@/atoms/pdf-defaults'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

// Tests fuer applyMistralDefaults nach dem Hard-Rename:
// Aus dem ehemaligen Boolean includePageImages werden zwei unabhaengige Flags
// includePreviewPages und includeHighResPages, die bei mistral_ocr beide standardmaessig
// auf true gesetzt werden.

describe('getEffectivePdfDefaults', () => {
  it('sollte mistral_ocr als globalen Default setzen, wenn extractionMethod nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', undefined, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
  })

  it('sollte includePreviewPages und includeHighResPages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(true)
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte beide Page-Image-Flags auf true setzen, wenn extractionMethod nicht gesetzt ist (globaler Default mistral_ocr)', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(true)
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte includeOcrImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeOcrImages).toBe(true)
  })

  it('sollte includePreviewPages nicht ueberschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', {
      extractionMethod: 'mistral_ocr',
      includePreviewPages: false,
    }, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(false)
    // includeHighResPages bleibt vom Default true
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte includeHighResPages nicht ueberschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', {
      extractionMethod: 'mistral_ocr',
      includeHighResPages: false,
    }, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeHighResPages).toBe(false)
    // includePreviewPages bleibt vom Default true
    expect(result.includePreviewPages).toBe(true)
  })

  it('sollte beide Page-Image-Flags nicht setzen, wenn extractionMethod nicht mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'native' }, {})

    expect(result.extractionMethod).toBe('native')
    expect(result.includePreviewPages).toBeUndefined()
    expect(result.includeHighResPages).toBeUndefined()
  })

  it('sollte Runtime-Overrides vor DB-Defaults anwenden', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'native' }
    const overrides = { 'library-1': { extractionMethod: 'mistral_ocr' } }

    const result = getEffectivePdfDefaults('library-1', dbDefaults, overrides)

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(true)
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte DB-Defaults verwenden, wenn keine Overrides vorhanden sind', () => {
    const dbDefaults: Partial<PdfTransformOptions> = {
      extractionMethod: 'native',
      targetLanguage: 'en'
    }

    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})

    expect(result.extractionMethod).toBe('native')
    expect(result.targetLanguage).toBe('en')
  })

  it('sollte auch ohne libraryId funktionieren', () => {
    const result = getEffectivePdfDefaults(undefined, {}, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(true)
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte beide Page-Image-Flags bei mistral_ocr immer true setzen, auch wenn DB-Defaults sie nicht setzen', () => {
    // Simuliert Fall: DB hat mistral_ocr, aber Page-Image-Flags nicht gesetzt
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'mistral_ocr' }

    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})

    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePreviewPages).toBe(true)
    expect(result.includeHighResPages).toBe(true)
  })

  it('sollte Library-Config targetLanguage verwenden, wenn dbDefaults.targetLanguage nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {}, 'de')

    expect(result.targetLanguage).toBe('de')
  })

  it('sollte dbDefaults.targetLanguage vor Library-Config targetLanguage priorisieren', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { targetLanguage: 'en' }
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {}, 'de')

    expect(result.targetLanguage).toBe('en')
  })

  it('sollte TARGET_LANGUAGE_DEFAULT verwenden, wenn weder dbDefaults noch Library-Config targetLanguage gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})

    expect(result.targetLanguage).toBe('en') // TARGET_LANGUAGE_DEFAULT
  })

  it('sollte Library-Config template verwenden, wenn dbDefaults.template nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {}, undefined, 'pdfanalyse')

    expect(result.template).toBe('pdfanalyse')
  })

  it('sollte dbDefaults.template vor Library-Config template priorisieren', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { template: 'custom-template' }
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {}, undefined, 'pdfanalyse')

    expect(result.template).toBe('custom-template')
  })
})
