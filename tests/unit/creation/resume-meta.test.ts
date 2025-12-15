import { describe, it, expect } from 'vitest'
import { parseCreationResumeMeta } from '@/lib/creation/resume-meta'

describe('parseCreationResumeMeta', () => {
  it('erkennt creationDetailViewType korrekt', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'testimonial',
      textSources: ['Source 1', 'Source 2'],
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).not.toBeNull()
    expect(result?.creationDetailViewType).toBe('testimonial')
  })
  
  it('parst textSources nur als string-array', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'testimonial',
      textSources: ['Source 1', 'Source 2', 'Source 3'],
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).not.toBeNull()
    expect(result?.textSources).toEqual(['Source 1', 'Source 2', 'Source 3'])
  })
  
  it('filtert leere Strings aus textSources', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'testimonial',
      textSources: ['Source 1', '', '   ', 'Source 2'],
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).not.toBeNull()
    expect(result?.textSources).toEqual(['Source 1', 'Source 2'])
  })
  
  it('gibt null zurück, wenn creationTypeId fehlt (Backward Compatibility)', () => {
    const meta = {
      templateName: 'test-template',
      textSources: ['Source 1'],
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).toBeNull()
  })
  
  it('gibt null zurück, wenn creationTemplateId fehlt', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationDetailViewType: 'testimonial',
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).toBeNull()
  })
  
  it('gibt null zurück, wenn creationDetailViewType ungültig ist', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'invalid',
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).toBeNull()
  })
  
  it('parst templateName optional', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'testimonial',
      templateName: 'Test Template',
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).not.toBeNull()
    expect(result?.templateName).toBe('Test Template')
  })
  
  it('ignoriert leeres templateName', () => {
    const meta = {
      creationTypeId: 'testimonial',
      creationTemplateId: 'test-template-123',
      creationDetailViewType: 'testimonial',
      templateName: '   ',
    }
    
    const result = parseCreationResumeMeta(meta)
    expect(result).not.toBeNull()
    expect(result?.templateName).toBeUndefined()
  })
  
  it('unterstützt alle gültigen detailViewTypes', () => {
    const types: Array<'book' | 'session' | 'testimonial'> = ['book', 'session', 'testimonial']
    
    for (const type of types) {
      const meta = {
        creationTypeId: 'test',
        creationTemplateId: 'test-template-123',
        creationDetailViewType: type,
      }
      
      const result = parseCreationResumeMeta(meta)
      expect(result).not.toBeNull()
      expect(result?.creationDetailViewType).toBe(type)
    }
  })
})

