import { describe, expect, it } from 'vitest'
import {
  mergeCreationTypesWithBuiltins,
  templateDocumentToCreationType,
} from '@/lib/templates/library-creation-config'
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

  it('W-D: der generische Standard-Wizard ist immer als Karte enthalten', () => {
    const merged = mergeCreationTypesWithBuiltins([], 'lib-1', 'user@test.local')
    const standard = merged.find((t) => t.id === 'standard-capture')
    expect(standard).toBeDefined()
    expect(standard?.templateId).toBe('standard-capture')
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
    // U6a: file-transcript-de ist wieder startbar (Compute laeuft off-target ueber
    // die Inbox, computeFileMediaDraft) — nicht mehr gesperrt.
    expect(file?.disabled).toBeFalsy()
  })

  it('U6c: pdfanalyse ist stillgelegt (Start gesperrt, Hinweis auf „Inhalte erfassen")', () => {
    const pdf: TemplateDocument = {
      _id: 'pdfanalyse',
      name: 'pdfanalyse',
      libraryId: 'lib-1',
      user: 'u@test',
      metadata: { fields: [], rawFrontmatter: '' },
      systemprompt: '',
      markdownBody: '',
      creation: {
        supportedSources: [{ id: 'file', type: 'file', label: 'PDF', helpText: '' }],
        flow: {
          steps: [
            { id: 'w', preset: 'welcome', title: 'W' },
            { id: 'c', preset: 'collectSource', title: 'C' },
            { id: 'r', preset: 'reviewMarkdown', title: 'R' },
            { id: 'e', preset: 'editDraft', title: 'E', fields: ['title'] },
            { id: 'p', preset: 'publish', title: 'P' },
          ],
        },
        ui: { displayName: 'PDF-Analyse', description: 'desc', icon: 'BookOpen' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }
    const row = templateDocumentToCreationType(pdf, 'library')
    expect(row?.disabled).toBe(true)
    expect(row?.disabledHint).toMatch(/Inhalte erfassen/)
  })

  it('W-A: eine Wizard-Flow-Entitaet (kind:wizard) ist KEIN Inhaltstyp', () => {
    const flowDoc: TemplateDocument = {
      _id: 'lib-1:standard-capture',
      name: 'standard-capture',
      libraryId: 'lib-1',
      user: 'u@test',
      kind: 'wizard',
      metadata: { fields: [], rawFrontmatter: '' },
      systemprompt: '',
      markdownBody: '',
      creation: {
        supportedSources: [{ id: 'file', type: 'file', label: 'Datei', helpText: '' }],
        flow: { steps: [{ id: 'w', preset: 'welcome', title: 'W' }, { id: 'p', preset: 'publish', title: 'P' }] },
        ui: { displayName: 'Inhalt erfassen', description: 'desc', icon: 'Upload' },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }
    // Trotz vorhandenem creation-Block liefert die Inhaltstyp-Ableitung null.
    expect(templateDocumentToCreationType(flowDoc, 'library')).toBeNull()
  })
})
