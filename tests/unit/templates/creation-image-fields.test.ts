import { describe, expect, it } from "vitest"
import { extractCreationFromFrontmatter } from "@/lib/templates/template-frontmatter-utils"
import { parseTemplate } from "@/lib/templates/template-parser"

describe("creation.imageFields parsing and serialization", () => {
  it("parses imageFields from frontmatter", () => {
    const frontmatter = `---
creation:
  supportedSources: []
  flow:
    steps: []
  imageFields:
    - key: coverImageUrl
      label: Cover-Bild
    - key: testimonial_image_url
      label: Testimonial Foto
      multiple: false
---`

    const result = extractCreationFromFrontmatter(frontmatter)
    expect(result).not.toBeNull()
    expect(result?.imageFields).toHaveLength(2)
    expect(result?.imageFields?.[0]).toEqual({
      key: "coverImageUrl",
      label: "Cover-Bild",
      multiple: undefined,
    })
    expect(result?.imageFields?.[1]).toEqual({
      key: "testimonial_image_url",
      label: "Testimonial Foto",
      multiple: false,
    })
  })

  it("handles imageFields without label", () => {
    const frontmatter = `---
creation:
  supportedSources: []
  flow:
    steps: []
  imageFields:
    - key: image_url
---`

    const result = extractCreationFromFrontmatter(frontmatter)
    expect(result).not.toBeNull()
    expect(result?.imageFields).toHaveLength(1)
    expect(result?.imageFields?.[0]).toEqual({
      key: "image_url",
      label: undefined,
      multiple: undefined,
    })
  })

  it("filters out invalid imageFields (missing key)", () => {
    const frontmatter = `---
creation:
  supportedSources: []
  flow:
    steps: []
  imageFields:
    - label: Invalid
    - key: valid_key
---`

    const result = extractCreationFromFrontmatter(frontmatter)
    expect(result).not.toBeNull()
    expect(result?.imageFields).toHaveLength(1)
    expect(result?.imageFields?.[0]?.key).toBe("valid_key")
  })

  it("parses imageFields via template parser", () => {
    const templateContent = `---
creation:
  supportedSources: []
  flow:
    steps: []
  imageFields:
    - key: coverImageUrl
      label: Cover
---
# Template Body
`

    const result = parseTemplate(templateContent, "test-template")
    expect(result.creation?.imageFields).toHaveLength(1)
    expect(result.creation?.imageFields?.[0]?.key).toBe("coverImageUrl")
    expect(result.creation?.imageFields?.[0]?.label).toBe("Cover")
  })
})



