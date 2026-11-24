/**
 * @fileoverview Vorlage als Text: Was vorlage_lesen ausgibt, muss vorlage_schreiben
 * wieder annehmen — Felder, Body, Systemprompt und Facetten-Platzhalter bleiben.
 */

import { describe, it, expect } from 'vitest'
import { parseTemplate } from '@/lib/templates/template-parser'
import { serializeTemplateToMarkdown } from '@/lib/templates/template-service-mongodb'
import type { TemplateDocument } from '@/lib/templates/template-types'
import { gebundeneFacetten } from '@/lib/external-jobs/facetten-bindung'

const TEXT = `---
title: {{title|Titel des Dokuments}}
source_types: {{source_types|Eine oder mehrere aus: <<werte:source_types>>}}
docType: session
---

# {{title|Titel des Dokuments}}

## Zusammenfassung
{{summary|Drei Saetze}}

--- systemprompt
Du ordnest Quellen ein. Bedeutung der Arten: <<legende:source_types>>.`

function alsDokument(text: string, name: string): TemplateDocument {
  const { template, errors } = parseTemplate(text, name)
  expect(errors).toEqual([])
  return { ...template, _id: name, name, libraryId: 'lib', user: 'a@example.org', createdAt: new Date(), updatedAt: new Date() } as unknown as TemplateDocument
}

describe('Vorlage lesen und wieder schreiben', () => {
  it('behaelt Felder, Body, Systemprompt und Platzhalter ueber den Rundweg', () => {
    const erste = alsDokument(TEXT, 'session-test')
    const gelesen = serializeTemplateToMarkdown(erste, true)
    const zweite = alsDokument(gelesen, 'session-test')
    expect(zweite.metadata.fields.map((f) => [f.key, f.description ?? f.rawValue])).toEqual(erste.metadata.fields.map((f) => [f.key, f.description ?? f.rawValue]))
    expect(zweite.markdownBody.trim()).toBe(erste.markdownBody.trim())
    expect(zweite.systemprompt.trim()).toBe(erste.systemprompt.trim())
    expect(gebundeneFacetten(gelesen)).toEqual(['source_types'])
    expect(serializeTemplateToMarkdown(zweite, true)).toBe(gelesen)
  })
})
