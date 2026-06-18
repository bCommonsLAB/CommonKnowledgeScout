import { describe, it, expect } from 'vitest'
import type { TemplateCreationConfig } from '@/lib/templates/template-types'
import {
  resolveTemplateDocKind,
  isWizardFlowDoc,
  isSchemaDoc,
  partitionTemplateDocsByKind,
  resolveWizardFlow,
  STANDARD_CAPTURE_FLOW,
  STANDARD_CAPTURE_FLOW_ID,
} from '@/lib/creation/wizard-flow-entity'

describe('resolveTemplateDocKind', () => {
  it('liest den gesetzten kind', () => {
    expect(resolveTemplateDocKind({ kind: 'wizard' })).toBe('wizard')
    expect(resolveTemplateDocKind({ kind: 'schema' })).toBe('schema')
  })

  it('fehlendes kind = schema (Bestand)', () => {
    expect(resolveTemplateDocKind({})).toBe('schema')
  })
})

describe('isWizardFlowDoc / isSchemaDoc', () => {
  it('unterscheidet Flow- und Schema-Dokumente', () => {
    expect(isWizardFlowDoc({ kind: 'wizard' })).toBe(true)
    expect(isWizardFlowDoc({ kind: 'schema' })).toBe(false)
    expect(isWizardFlowDoc({})).toBe(false)
    expect(isSchemaDoc({})).toBe(true)
    expect(isSchemaDoc({ kind: 'wizard' })).toBe(false)
  })
})

describe('partitionTemplateDocsByKind', () => {
  it('trennt Schemas (inkl. Bestand ohne kind) von Flow-Entitaeten', () => {
    const docs = [
      { id: 'a', kind: 'schema' as const },
      { id: 'b' }, // Bestand → schema
      { id: 'c', kind: 'wizard' as const },
      { id: 'd', kind: 'wizard' as const },
    ]
    const { schemas, flows } = partitionTemplateDocsByKind(docs)
    expect(schemas.map((d) => d.id)).toEqual(['a', 'b'])
    expect(flows.map((d) => d.id)).toEqual(['c', 'd'])
  })

  it('leere Eingabe → leere Partitionen', () => {
    expect(partitionTemplateDocsByKind([])).toEqual({ schemas: [], flows: [] })
  })
})

describe('STANDARD_CAPTURE_FLOW', () => {
  it('hat die generische Schrittfolge in Reihenfolge', () => {
    const presets = STANDARD_CAPTURE_FLOW.flow.steps.map((s) => s.preset)
    expect(presets).toEqual(['welcome', 'collectSource', 'selectSchemaType', 'editDraft', 'publish'])
  })

  it('ist schema-frei: der editDraft-Schritt nennt keine Feldnamen', () => {
    const edit = STANDARD_CAPTURE_FLOW.flow.steps.find((s) => s.preset === 'editDraft')
    expect(edit?.fields).toBeUndefined()
  })

  it('hat genau eine Datei-Quelle und ist nicht-ingestierend beim Publish', () => {
    expect(STANDARD_CAPTURE_FLOW.supportedSources.map((s) => s.type)).toEqual(['file'])
    const publish = STANDARD_CAPTURE_FLOW.flow.steps.find((s) => s.preset === 'publish')
    expect(publish?.ingestOnFinish).toBe(false)
  })

  it('hat eine stabile ID', () => {
    expect(STANDARD_CAPTURE_FLOW_ID).toBe('standard-capture')
  })
})

describe('resolveWizardFlow', () => {
  const dummyFlow: TemplateCreationConfig = {
    supportedSources: [{ id: 'text', type: 'text', label: 'Text' }],
    flow: { steps: [{ id: 'W', preset: 'welcome' }] },
  }

  it('bevorzugt die referenzierte Flow-Entitaet', () => {
    expect(resolveWizardFlow({ flowConfig: dummyFlow, schemaCreation: STANDARD_CAPTURE_FLOW })).toBe(dummyFlow)
  })

  it('faellt auf den gebuendelten Schema-creation-Block zurueck', () => {
    expect(resolveWizardFlow({ schemaCreation: dummyFlow })).toBe(dummyFlow)
  })

  it('nutzt den Standard-Flow, wenn nichts gegeben ist (kein Voll-Dump)', () => {
    expect(resolveWizardFlow({})).toBe(STANDARD_CAPTURE_FLOW)
    expect(resolveWizardFlow({ flowConfig: null, schemaCreation: null })).toBe(STANDARD_CAPTURE_FLOW)
  })
})
