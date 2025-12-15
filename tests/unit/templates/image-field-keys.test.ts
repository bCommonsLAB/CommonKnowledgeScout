import { describe, it, expect } from 'vitest'
import { extractCreationFromFrontmatter, injectCreationIntoFrontmatter } from '@/lib/templates/template-frontmatter-utils'
import type { TemplateCreationConfig } from '@/lib/templates/template-types'

describe('imageFieldKeys parsing and serialization', () => {
  it('should parse imageFieldKeys from frontmatter', () => {
    const frontmatter = `---
title: {{title|Title}}
creation:
  flow:
    steps:
      - id: Personal
        preset: editDraft
        title: "Persönliche Angaben"
        fields:
          - author_name
          - author_image_url
        imageFieldKeys:
          - author_image_url
---`

    const creation = extractCreationFromFrontmatter(frontmatter)
    
    expect(creation).not.toBeNull()
    expect(creation?.flow.steps).toHaveLength(1)
    expect(creation?.flow.steps[0]?.imageFieldKeys).toEqual(['author_image_url'])
  })

  it('should serialize imageFieldKeys to frontmatter', () => {
    const creation: TemplateCreationConfig = {
      supportedSources: [],
      flow: {
        steps: [
          {
            id: 'Personal',
            preset: 'editDraft',
            title: 'Persönliche Angaben',
            fields: ['author_name', 'author_image_url'],
            imageFieldKeys: ['author_image_url'],
          },
        ],
      },
    }

    const frontmatter = `---
title: {{title|Title}}
---`
    
    const result = injectCreationIntoFrontmatter(frontmatter, creation)
    
    expect(result).toContain('imageFieldKeys:')
    expect(result).toContain('- author_image_url')
  })

  it('should handle missing imageFieldKeys gracefully', () => {
    const frontmatter = `---
title: {{title|Title}}
creation:
  flow:
    steps:
      - id: Personal
        preset: editDraft
        fields:
          - author_name
---`

    const creation = extractCreationFromFrontmatter(frontmatter)
    
    expect(creation).not.toBeNull()
    expect(creation?.flow.steps[0]?.imageFieldKeys).toBeUndefined()
  })
})



