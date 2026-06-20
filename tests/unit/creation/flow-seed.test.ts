import { describe, it, expect, vi } from 'vitest'
import {
  buildStandardCaptureFlowDoc,
  seedStandardCaptureFlow,
  type FlowSeedRepoPort,
  type NewTemplateDocument,
} from '@/lib/creation/flow-seed'
import { STANDARD_CAPTURE_FLOW, STANDARD_CAPTURE_FLOW_ID } from '@/lib/creation/wizard-flow-entity'

describe('buildStandardCaptureFlowDoc', () => {
  it('baut ein kind:wizard-Dokument mit dem Standard-Flow und leerem Schema', () => {
    const doc = buildStandardCaptureFlowDoc('lib-1', 'owner@test.local')
    expect(doc.kind).toBe('wizard')
    expect(doc.name).toBe(STANDARD_CAPTURE_FLOW_ID)
    expect(doc.libraryId).toBe('lib-1')
    expect(doc.user).toBe('owner@test.local')
    expect(doc.creation).toBe(STANDARD_CAPTURE_FLOW)
    expect(doc.metadata.fields).toEqual([])
    expect(doc.systemprompt).toBe('')
    expect(doc.markdownBody).toBe('')
  })
})

function fakeRepo(existing: boolean): { port: FlowSeedRepoPort; created: NewTemplateDocument[] } {
  const created: NewTemplateDocument[] = []
  const port: FlowSeedRepoPort = {
    exists: vi.fn(async () => existing),
    create: vi.fn(async (doc) => {
      created.push(doc)
      return doc
    }),
  }
  return { port, created }
}

describe('seedStandardCaptureFlow', () => {
  it('legt den Flow an, wenn er noch nicht existiert', async () => {
    const { port, created } = fakeRepo(false)
    const result = await seedStandardCaptureFlow(port, { libraryId: 'lib-1', userEmail: 'o@test' })
    expect(result).toBe('created')
    expect(created).toHaveLength(1)
    expect(created[0].name).toBe(STANDARD_CAPTURE_FLOW_ID)
    expect(created[0].kind).toBe('wizard')
  })

  it('ist idempotent: existiert er, wird nichts angelegt', async () => {
    const { port, created } = fakeRepo(true)
    const result = await seedStandardCaptureFlow(port, { libraryId: 'lib-1', userEmail: 'o@test' })
    expect(result).toBe('exists')
    expect(created).toHaveLength(0)
    expect(port.create).not.toHaveBeenCalled()
  })

  it('prueft Existenz mit Flow-Name + Library', async () => {
    const { port } = fakeRepo(true)
    await seedStandardCaptureFlow(port, { libraryId: 'lib-9', userEmail: 'o@test' })
    expect(port.exists).toHaveBeenCalledWith(STANDARD_CAPTURE_FLOW_ID, 'lib-9')
  })
})
