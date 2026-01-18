import { describe, expect, it } from 'vitest'
import { getEffectivePdfDefaults } from '@/atoms/pdf-defaults'
import type { PdfTransformOptions } from '@/lib/transform/transform-service'

describe('getEffectivePdfDefaults', () => {
  it('sollte mistral_ocr als globalen Default setzen, wenn extractionMethod nicht gesetzt ist', () => {
    const result = getEffectivePdfDefaults('library-1', undefined, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages auf true setzen, wenn extractionMethod nicht gesetzt ist (globaler Default mistral_ocr)', () => {
    const result = getEffectivePdfDefaults('library-1', {}, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includeOcrImages auf true setzen, wenn extractionMethod mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'mistral_ocr' }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includeOcrImages).toBe(true)
  })

  it('sollte includePageImages nicht überschreiben, wenn explizit auf false gesetzt', () => {
    const result = getEffectivePdfDefaults('library-1', { 
      extractionMethod: 'mistral_ocr',
      includePageImages: false 
    }, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(false)
  })

  it('sollte includePageImages nicht setzen, wenn extractionMethod nicht mistral_ocr ist', () => {
    const result = getEffectivePdfDefaults('library-1', { extractionMethod: 'native' }, {})
    
    expect(result.extractionMethod).toBe('native')
    expect(result.includePageImages).toBeUndefined()
  })

  it('sollte Runtime-Overrides vor DB-Defaults anwenden', () => {
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'native' }
    const overrides = { 'library-1': { extractionMethod: 'mistral_ocr' } }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, overrides)
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true)
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
    expect(result.includePageImages).toBe(true)
  })

  it('sollte includePageImages bei mistral_ocr immer true setzen, auch wenn DB-Defaults es nicht setzen', () => {
    // Simuliert Fall: DB hat mistral_ocr, aber includePageImages nicht gesetzt
    const dbDefaults: Partial<PdfTransformOptions> = { extractionMethod: 'mistral_ocr' }
    
    const result = getEffectivePdfDefaults('library-1', dbDefaults, {})
    
    expect(result.extractionMethod).toBe('mistral_ocr')
    expect(result.includePageImages).toBe(true) // Sollte automatisch auf true gesetzt werden
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
