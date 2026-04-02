import { describe, expect, it } from 'vitest'
import { mergeCreationTypesWithBuiltins } from '@/lib/templates/library-creation-config'
import type { TemplateDocument } from '@/lib/templates/template-types'

describe('mergeCreationTypesWithBuiltins', () => {
  it('fügt Built-ins hinzu, wenn keine Library-Templates existieren', () => {
    const merged = mergeCreationTypesWithBuiltins([], 'lib-1', 'user@test.local')
    const ids = merged.map((t) => t.templateId).sort()
    expect(ids).toContain('audio-transcript-de')
    expect(ids).toContain('file-transcript-de')
    expect(merged.every((t) => t.source === 'builtin')).toBe(true)
    const audio = merged.find((t) => t.templateId === 'audio-transcript-de')
    expect(audio?.icon).toBe('Mic')
  })

  it('Library-Template überschreibt Built-in mit gleichem Namen', () => {
    const mongoAudio: TemplateDocument = {
      _id: 'audio-transcript-de',
      name: 'audio-transcript-de',
      libraryId: 'lib-1',
      user: 'u@test',
      metadata: { fields: [], rawFrontmatter: '' },
      systemprompt: '',
      markdownBody: '',
      creation: {
        supportedSources: [{ id: 'file', type: 'file', label: 'x', helpText: '' }],
        flow: {
          steps: [
            { id: 'w', preset: 'welcome', title: 'W' },
            { id: 'c', preset: 'collectSource', title: 'C' },
            { id: 'e', preset: 'editDraft', title: 'E', fields: ['title'] },
            { id: 'p', preset: 'publish', title: 'P' },
          ],
        },
        ui: { displayName: 'Aus Mongo', description: 'desc', icon: 'FileText' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }

    const merged = mergeCreationTypesWithBuiltins([mongoAudio], 'lib-1', 'user@test.local')
    const audio = merged.find((t) => t.templateId === 'audio-transcript-de')
    expect(audio?.label).toBe('Aus Mongo')
    expect(audio?.source).toBe('library')
    const file = merged.find((t) => t.templateId === 'file-transcript-de')
    expect(file?.source).toBe('builtin')
    expect(file?.disabled).toBe(true)
    expect(file?.disabledHint).toBeTruthy()
  })
})
