import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseTemplate } from '@/lib/templates/template-parser'

describe('template-samples/pdfanalyse-commoning.md', () => {
  it('parses without validation errors and contains a systemprompt', () => {
    const templatePath = join(process.cwd(), 'template-samples', 'pdfanalyse-commoning.md')
    const content = readFileSync(templatePath, 'utf-8')

    const { template, errors } = parseTemplate(content, 'pdfanalyse-commoning')

    expect(errors).toEqual([])
    expect(template.name).toBe('pdfanalyse-commoning')
    expect(template.systemprompt.trim().length).toBeGreaterThan(50)

    // Frontmatter-Felder sollten extrahiert werden (Smoke-Test)
    const variables = template.metadata.fields.map(f => f.variable)
    expect(variables).toContain('title')
    expect(variables).toContain('authors')
    expect(variables).toContain('topics')
  })
})













