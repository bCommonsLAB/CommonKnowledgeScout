import { describe, expect, it } from 'vitest'
import { mergeTemplateNames } from '@/lib/templates/template-options'

describe('mergeTemplateNames', () => {
  it('deduplicates (case-insensitive) and sorts', () => {
    const result = mergeTemplateNames({
      templateNames: ['pdfanalyse', 'PdfAnalyse', 'zeta', 'alpha', '  alpha  '],
      currentTemplateName: '',
    })

    expect(result).toEqual(['alpha', 'pdfanalyse', 'zeta'])
  })

  it('includes current template even if missing in mongo list', () => {
    const result = mergeTemplateNames({
      templateNames: ['pdfanalyse'],
      currentTemplateName: 'pdfanalyse-commoning',
    })

    expect(result).toEqual(['pdfanalyse', 'pdfanalyse-commoning'])
  })

  it('ignores empty/whitespace entries', () => {
    const result = mergeTemplateNames({
      templateNames: [' ', '', 'a', '  '],
      currentTemplateName: '   ',
    })

    expect(result).toEqual(['a'])
  })
})











