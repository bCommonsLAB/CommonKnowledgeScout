/**
 * Characterization Tests fuer src/lib/templates/template-service.ts.
 *
 * Welle 2.2 Schritt 3 — fixiert das Verhalten der File-basierten
 * Template-Service-Funktionen vor dem Catch-Fix in Schritt 4.
 *
 * Provider wird via Test-Double gemockt (kein echtes Storage).
 */

import { describe, expect, it, vi } from 'vitest'
import {
  ensureTemplatesFolderId,
  listAvailableTemplates,
  loadTemplate,
  parseTemplateContent,
  loadAndParseTemplate,
  getUxConfig,
  getPromptConfig,
  serializeTemplateWithoutCreation,
  TemplateNotFoundError,
} from '@/lib/templates/template-service'
import type { TemplateServiceProvider } from '@/lib/templates/template-service'

interface FakeItem {
  id: string
  type: 'file' | 'folder'
  metadata?: { name?: string }
}

function makeProvider(initial: { rootItems: FakeItem[]; templates?: FakeItem[]; binaries?: Record<string, string> }): TemplateServiceProvider & { state: { rootItems: FakeItem[]; templates: FakeItem[]; binaries: Record<string, string> } } {
  const state = {
    rootItems: [...initial.rootItems],
    templates: initial.templates ?? [],
    binaries: initial.binaries ?? {},
  }
  return {
    state,
    listItemsById: vi.fn(async (parentId: string) => {
      if (parentId === 'root') return state.rootItems
      if (parentId === 'tpl-folder-id') return state.templates
      return []
    }),
    createFolder: vi.fn(async (parentId: string, name: string) => {
      const id = `${parentId}-${name}`
      const item: FakeItem = { id, type: 'folder', metadata: { name } }
      state.rootItems.push(item)
      return { id }
    }),
    getBinary: vi.fn(async (itemId: string) => {
      const text = state.binaries[itemId] ?? ''
      return { blob: new Blob([text], { type: 'text/markdown' }) }
    }),
  } as unknown as TemplateServiceProvider & typeof state
}

describe('ensureTemplatesFolderId', () => {
  it('liefert id wenn Templates-Ordner existiert', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
    })
    expect(await ensureTemplatesFolderId(p)).toBe('tpl-folder-id')
  })

  it('legt Ordner an wenn nicht vorhanden', async () => {
    const p = makeProvider({ rootItems: [] })
    const id = await ensureTemplatesFolderId(p)
    expect(id).toContain('templates')
  })

  it('wirft Error mit Praefix bei Provider-Fehler', async () => {
    const p = {
      listItemsById: vi.fn(async () => { throw new Error('storage down') }),
      createFolder: vi.fn(),
      getBinary: vi.fn(),
    } as unknown as TemplateServiceProvider
    await expect(ensureTemplatesFolderId(p)).rejects.toThrowError(
      /Fehler beim Zugriff auf Templates-Ordner/,
    )
  })
})

describe('listAvailableTemplates', () => {
  it('liefert Namen ohne .md, gefiltert auf .md-Dateien', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [
        { id: 't1', type: 'file', metadata: { name: 'pdfanalyse.md' } },
        { id: 't2', type: 'file', metadata: { name: 'session.md' } },
        { id: 't3', type: 'file', metadata: { name: 'README.txt' } },
        { id: 'sub', type: 'folder', metadata: { name: 'sub' } },
      ],
    })
    const names = await listAvailableTemplates(p)
    expect(names).toEqual(['pdfanalyse', 'session'])
  })

  it('liefert leeres Array bei Provider-Fehler (silent fallback per Vertrag)', async () => {
    const p = {
      listItemsById: vi.fn(async () => { throw new Error('boom') }),
      createFolder: vi.fn(async () => { throw new Error('boom') }),
      getBinary: vi.fn(),
    } as unknown as TemplateServiceProvider
    await expect(listAvailableTemplates(p)).resolves.toEqual([])
  })
})

describe('loadTemplate', () => {
  it('laedt preferredTemplate wenn vorhanden', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [{ id: 't1', type: 'file', metadata: { name: 'session.md' } }],
      binaries: { t1: 'session-content' },
    })
    const r = await loadTemplate({ provider: p, preferredTemplateName: 'session' })
    expect(r.templateContent).toBe('session-content')
    expect(r.templateName).toBe('session')
    expect(r.isPreferred).toBe(true)
  })

  it('faellt auf pdfanalyse-Default zurueck wenn preferred nicht angegeben', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [
        { id: 't1', type: 'file', metadata: { name: 'pdfanalyse.md' } },
        { id: 't2', type: 'file', metadata: { name: 'session.md' } },
      ],
      binaries: { t1: 'pdf-content', t2: 'session-content' },
    })
    const r = await loadTemplate({ provider: p })
    expect(r.templateName).toBe('pdfanalyse')
    expect(r.isPreferred).toBe(false)
  })

  it('faellt auf erstes Template zurueck wenn pdfanalyse fehlt', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [{ id: 't2', type: 'file', metadata: { name: 'session.md' } }],
      binaries: { t2: 'session-content' },
    })
    const r = await loadTemplate({ provider: p })
    expect(r.templateName).toBe('session')
  })

  it('wirft TemplateNotFoundError wenn Templates-Ordner leer und kein preferred', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [],
    })
    await expect(loadTemplate({ provider: p })).rejects.toBeInstanceOf(
      TemplateNotFoundError,
    )
  })

  it('wirft TemplateNotFoundError wenn preferredTemplate nicht gefunden', async () => {
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [{ id: 't1', type: 'file', metadata: { name: 'pdfanalyse.md' } }],
      binaries: { t1: 'x' },
    })
    let caught: TemplateNotFoundError | undefined
    try {
      await loadTemplate({ provider: p, preferredTemplateName: 'nichtda' })
    } catch (e) {
      caught = e as TemplateNotFoundError
    }
    expect(caught).toBeInstanceOf(TemplateNotFoundError)
    expect(caught?.preferredTemplate).toBe('nichtda')
    expect(caught?.availableTemplates).toEqual(['pdfanalyse'])
  })
})

describe('parseTemplateContent + loadAndParseTemplate', () => {
  it('parseTemplateContent ist Wrapper um parseTemplate', () => {
    const content = `---\nname: tpl\n---\n\nBody`
    const r = parseTemplateContent(content, 'tpl')
    expect(r.template).toBeDefined()
    expect(Array.isArray(r.errors)).toBe(true)
  })

  it('loadAndParseTemplate kombiniert load + parse', async () => {
    const content = `---\nname: tpl\nfields:\n  - variable: x\n    description: X\n---\n\nBody`
    const p = makeProvider({
      rootItems: [{ id: 'tpl-folder-id', type: 'folder', metadata: { name: 'templates' } }],
      templates: [{ id: 't1', type: 'file', metadata: { name: 'tpl.md' } }],
      binaries: { t1: content },
    })
    const r = await loadAndParseTemplate({ provider: p, preferredTemplateName: 'tpl' })
    expect(r.template).toBeDefined()
    expect(Array.isArray(r.errors)).toBe(true)
  })
})

describe('getUxConfig + getPromptConfig', () => {
  it('getUxConfig liefert null ohne creation-Block', () => {
    const tpl = {
      name: 'x',
      metadata: { fields: [] },
      systemprompt: '',
      markdownBody: '',
    } as never
    expect(getUxConfig(tpl)).toBeNull()
  })

  it('getUxConfig liefert UxConfig mit creation', () => {
    const tpl = {
      name: 'x',
      metadata: { fields: [{ variable: 'a', description: 'A' }] },
      systemprompt: '',
      markdownBody: '',
      creation: { steps: [] },
    } as never
    const r = getUxConfig(tpl)
    expect(r?.templateId).toBe('x')
    expect(r?.availableFields).toEqual(['a'])
  })

  it('getPromptConfig laesst creation weg', () => {
    const tpl = {
      name: 'x',
      metadata: { fields: [] },
      systemprompt: 'sys',
      markdownBody: 'body',
      creation: { steps: [] },
    } as never
    const r = getPromptConfig(tpl)
    expect(r.templateId).toBe('x')
    expect(r.systemprompt).toBe('sys')
    expect(r.markdownBody).toBe('body')
    expect((r as unknown as { creation?: unknown }).creation).toBeUndefined()
  })
})

describe('serializeTemplateWithoutCreation', () => {
  it('entfernt creation-Block aus Frontmatter', () => {
    const content = `---
name: tpl
creation:
  flow:
    steps:
      - { preset: source }
---

Body

--- systemprompt
sys`
    const r = serializeTemplateWithoutCreation(content)
    expect(r).not.toContain('creation:')
    expect(r).toContain('Body')
    expect(r).toContain('systemprompt')
    expect(r).toContain('sys')
  })

  it('funktioniert ohne systemprompt-Teil', () => {
    const content = `---
name: tpl
---

Body only`
    const r = serializeTemplateWithoutCreation(content)
    expect(r).toContain('Body only')
    expect(r).not.toContain('--- systemprompt')
  })

  it('liefert Body unveraendert wenn kein Frontmatter', () => {
    const r = serializeTemplateWithoutCreation('Just body')
    expect(r).toContain('Just body')
  })
})
