import { describe, expect, it } from 'vitest'
import { removeTemplateFrontmatterField, templateHasFrontmatterField } from '@/lib/templates/template-field-check'
import { applySlidesOption } from '@/lib/external-jobs/template-slides-option'

const VORLAGE = `---
detailViewType: session
title: {{title|Titel}}
slides: {{slides|PFLICHT, sobald ein Folien-PDF unter den Quellen ist: Array mit EINEM Objekt je Seite}}
galleryImageUrls: []
---

## {{title}}

{{vortrag_md|Der Vortrag als Text; slides bleiben hier unberuehrt}}

--- systemprompt
Die Folien erscheinen ausschliesslich ueber slides.
`

describe('template-field-check (P6)', () => {
  it('erkennt ein Feld nur im ersten Frontmatter-Block, nicht im Body oder Systemprompt', () => {
    expect(templateHasFrontmatterField(VORLAGE, 'slides')).toBe(true)
    expect(templateHasFrontmatterField(VORLAGE, 'vortrag_md')).toBe(false)
    expect(templateHasFrontmatterField(VORLAGE, 'slide')).toBe(false)
    expect(templateHasFrontmatterField('kein frontmatter', 'slides')).toBe(false)
  })

  it('entfernt genau die Feldzeile und laesst Body und Systemprompt unveraendert', () => {
    const result = removeTemplateFrontmatterField(VORLAGE, 'slides')
    expect(result.removed).toBe(true)
    expect(result.content).not.toMatch(/^slides:/m)
    expect(result.content).toContain('title: {{title|Titel}}')
    expect(result.content).toContain('galleryImageUrls: []')
    expect(result.content).toContain('{{vortrag_md|Der Vortrag als Text; slides bleiben hier unberuehrt}}')
    expect(result.content).toContain('--- systemprompt')
    expect(templateHasFrontmatterField(result.content, 'slides')).toBe(false)
  })

  it('nimmt ein mehrzeiliges Token bis zum schliessenden }} mit', () => {
    const vorlage = '---\na: 1\nslides: {{slides|erste Zeile\nzweite Zeile}}\nb: 2\n---\nBody'
    const result = removeTemplateFrontmatterField(vorlage, 'slides')
    expect(result.content).toBe('---\na: 1\nb: 2\n---\nBody')
  })

  it('meldet removed=false, wenn das Feld fehlt, und laesst den Inhalt unangetastet', () => {
    const result = removeTemplateFrontmatterField(VORLAGE, 'chapters')
    expect(result).toEqual({ content: VORLAGE, removed: false })
  })
})

describe('applySlidesOption (P6)', () => {
  it('false entfernt das Feld und meldet es im Trace', () => {
    const r = applySlidesOption(VORLAGE, false)
    expect(templateHasFrontmatterField(r.content, 'slides')).toBe(false)
    expect(r.trace).toEqual({ slidesAsTable: 'false', feldVorhanden: true, entfernt: true })
  })

  it('true und nicht gesetzt lassen die Vorlage unveraendert, Trace nennt die Ausprägung', () => {
    expect(applySlidesOption(VORLAGE, true)).toEqual({
      content: VORLAGE, trace: { slidesAsTable: 'true', feldVorhanden: true, entfernt: false },
    })
    expect(applySlidesOption(VORLAGE, undefined).trace.slidesAsTable).toBe('nicht gesetzt')
    expect(applySlidesOption(VORLAGE, 'false').trace.slidesAsTable).toBe('nicht gesetzt')
  })

  it('false ohne Feld in der Vorlage ist kein Fehler, steht aber als entfernt=false im Trace', () => {
    const ohne = '---\ntitle: {{title|T}}\n---\nBody'
    expect(applySlidesOption(ohne, false)).toEqual({
      content: ohne, trace: { slidesAsTable: 'false', feldVorhanden: false, entfernt: false },
    })
  })
})
