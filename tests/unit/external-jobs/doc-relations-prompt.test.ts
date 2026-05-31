import { describe, it, expect } from 'vitest'
import {
  buildRelationsMessages,
  RelationsResultSchema,
  relationsSchemaJson,
} from '@/lib/external-jobs/doc-relations-prompt'

describe('doc-relations-prompt', () => {
  const catalog = [
    { slug: 'a', title: 'Maßnahme A', summary: 'kurz A' },
    { slug: 'b', title: 'Maßnahme B' },
  ]

  it('listet alle Katalog-slugs im User-Prompt', () => {
    const msgs = buildRelationsMessages({ catalog, relationType: 'unterstuetzt' })
    const user = msgs.find((m) => m.role === 'user')?.content || ''
    expect(user).toContain('slug=a')
    expect(user).toContain('slug=b')
  })

  it('nennt den generischen Beziehungstyp im System-Prompt', () => {
    const msgs = buildRelationsMessages({ catalog, relationType: 'blockiert' })
    const system = msgs.find((m) => m.role === 'system')?.content || ''
    expect(system).toContain('blockiert')
  })

  it('beschränkt bei focusSlug auf ausgehende Kanten der Maßnahme', () => {
    const msgs = buildRelationsMessages({ catalog, relationType: 'unterstuetzt', focusSlug: 'a' })
    const system = msgs.find((m) => m.role === 'system')?.content || ''
    expect(system).toContain('sourceSlug muss "a" sein')
  })

  it('integriert den optionalen relationPrompt', () => {
    const msgs = buildRelationsMessages({ catalog, relationType: 'unterstuetzt', relationPrompt: 'Fokus Energie' })
    const system = msgs.find((m) => m.role === 'system')?.content || ''
    expect(system).toContain('Fokus Energie')
  })

  it('Zod-Schema validiert eine wohlgeformte LLM-Antwort', () => {
    const parsed = RelationsResultSchema.parse({
      edges: [{ sourceSlug: 'a', targetSlug: 'b', weight: 0.8, rationale: 'x' }],
    })
    expect(parsed.edges).toHaveLength(1)
  })

  it('JSON-Schema ist valides JSON mit edges-Array', () => {
    const schema = JSON.parse(relationsSchemaJson)
    expect(schema.properties.edges.type).toBe('array')
    expect(schema.required).toContain('edges')
  })
})
