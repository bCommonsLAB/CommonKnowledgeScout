import { describe, expect, it } from 'vitest'
import { buildTransformationBody } from '@/lib/external-jobs/template-body-builder'

describe('buildTransformationBody', () => {
  it('bevorzugt bodyInText, wenn vorhanden', () => {
    const res = buildTransformationBody({
      meta: {
        bodyInText: '# Hallo\n\nDies ist der Body.',
        title: 'Ignoriert',
        summary: 'Ignoriert',
      },
      templateContent: null,
    })

    expect(res.strategy).toBe('bodyInText')
    expect(res.body).toContain('# Hallo')
    expect(res.body).toContain('Dies ist der Body.')
  })

  it('rendert template.markdownBody mit Platzhaltern, wenn bodyInText fehlt', () => {
    const templateContent = [
      '---',
      'title: {{title|Titel}}',
      '---',
      '## {{title}}',
      '{{intro|Intro}}',
      '',
      '## Worum geht es?',
      '{{worum|Worum}}',
      '',
      '--- systemprompt',
      'Antworte nur mit JSON.',
      '',
    ].join('\n')

    const res = buildTransformationBody({
      meta: {
        title: 'Mein Titel',
        intro: 'Mein Intro.',
        worum: 'Mein Worum.',
      },
      templateContent,
      templateNameForParsing: 'klimamassnahme-detail-de',
    })

    expect(res.strategy).toBe('template_markdownBody')
    expect(res.body).toContain('## Mein Titel')
    expect(res.body).toContain('Mein Intro.')
    expect(res.body).toContain('## Worum geht es?')
    expect(res.body).toContain('Mein Worum.')
    // Platzhalter sollten ersetzt sein
    expect(res.body).not.toContain('{{intro')
    expect(res.body).not.toContain('{{worum')
  })

  it('normalisiert doppelt-escaped Newlines (\\\\n) in Abschnittstexten', () => {
    const templateContent = [
      '---',
      'title: {{title|Titel}}',
      'intro: {{intro|Intro}}',
      '---',
      '## {{title}}',
      '{{intro}}',
      '',
      '--- systemprompt',
      'Antworte nur mit JSON.',
      '',
    ].join('\n')

    const res = buildTransformationBody({
      meta: {
        title: 'Titel',
        // Wichtig: hier sind es wörtliche Backslash-n Sequenzen (\\n), keine echten Newlines
        intro: 'Zeile 1\\n\\nZeile 2',
      },
      templateContent,
      templateNameForParsing: 'klimamassnahme-detail-de',
    })

    expect(res.strategy).toBe('template_markdownBody')
    expect(res.body).toContain('Zeile 1\n\nZeile 2')
    expect(res.body).not.toContain('\\n\\n')
  })

  it('fällt auf legacy fallback zurück, wenn weder bodyInText noch templateBody nutzbar sind', () => {
    const res = buildTransformationBody({
      meta: {
        title: 'Fallback Titel',
        summary: 'Fallback Summary',
      },
      templateContent: '',
    })

    expect(res.strategy).toBe('fallback')
    expect(res.body).toContain('# Fallback Titel')
    expect(res.body).toContain('## Zusammenfassung')
    expect(res.body).toContain('Fallback Summary')
  })
})

