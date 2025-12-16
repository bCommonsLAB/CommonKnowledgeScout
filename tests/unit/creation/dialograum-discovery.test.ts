import { describe, it, expect, vi, beforeEach } from "vitest"
import { findRelatedTestimonials } from "@/lib/creation/dialograum-discovery"
import type { StorageProvider } from "@/lib/storage/types"

// Mock StorageProvider
const createMockProvider = (): StorageProvider => {
  const items: Record<string, { id: string; type: string; metadata: { name?: string }; parentId?: string }> = {}
  const binaries: Record<string, string> = {}
  
  return {
    getItemById: vi.fn(async (id: string) => {
      return items[id] || null
    }),
    listItemsById: vi.fn(async (parentId: string) => {
      return Object.values(items).filter(item => item.parentId === parentId)
    }),
    getBinary: vi.fn(async (id: string) => {
      const content = binaries[id]
      if (!content) {
        throw new Error(`File not found: ${id}`)
      }
      return {
        blob: new Blob([content], { type: "text/markdown" }),
        mimeType: "text/markdown",
      }
    }),
    uploadFile: vi.fn(),
    deleteItem: vi.fn(),
    createFolder: vi.fn(),
  } as unknown as StorageProvider
}

describe("findRelatedTestimonials", () => {
  let mockProvider: StorageProvider
  
  beforeEach(() => {
    mockProvider = createMockProvider()
  })
  
  it("should return empty array if dialograum file not found", async () => {
    const result = await findRelatedTestimonials({
      provider: mockProvider,
      startFileId: "nonexistent",
    })
    
    expect(result).toEqual([])
  })
  
  it("should return empty array if dialograum_id is missing", async () => {
    // Setup: Dialograum-Datei ohne dialograum_id
    const dialograumContent = `---
title: Test Dialograum
---
Body content`
    
    const mockProviderWithDialograum = createMockProvider()
    ;(mockProviderWithDialograum.getItemById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "dialograum-1",
      type: "file",
      metadata: { name: "dialograum.md" },
      parentId: "root",
    })
    ;(mockProviderWithDialograum.getBinary as ReturnType<typeof vi.fn>).mockResolvedValue({
      blob: new Blob([dialograumContent], { type: "text/markdown" }),
    })
    
    const result = await findRelatedTestimonials({
      provider: mockProviderWithDialograum,
      startFileId: "dialograum-1",
    })
    
    expect(result).toEqual([])
  })
  
  it("should find testimonials with matching dialograum_id", async () => {
    const dialograumId = "dialograum-123"
    const dialograumContent = `---
title: Test Dialograum
dialograum_id: ${dialograumId}
---
Body content`
    
    const testimonial1Content = `---
title: Testimonial 1
dialograum_id: ${dialograumId}
creationDetailViewType: testimonial
author_name: Max Mustermann
teaser: Test teaser
---
Testimonial body`
    
    const testimonial2Content = `---
title: Testimonial 2
dialograum_id: ${dialograumId}
creationDetailViewType: testimonial
author_name: Anna Schmidt
---
Testimonial body 2`
    
    const unrelatedContent = `---
title: Unrelated
dialograum_id: other-id
creationDetailViewType: testimonial
---
Unrelated body`
    
    const mockProviderWithFiles = createMockProvider()
    
    // Dialograum
    ;(mockProviderWithFiles.getItemById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === "dialograum-1") {
        return {
          id: "dialograum-1",
          type: "file",
          metadata: { name: "dialograum.md" },
          parentId: "root",
        }
      }
      return null
    })
    
    // Testimonials
    ;(mockProviderWithFiles.listItemsById as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "testimonial-1",
        type: "file",
        metadata: { name: "testimonial-1.md" },
        parentId: "root",
      },
      {
        id: "testimonial-2",
        type: "file",
        metadata: { name: "testimonial-2.md" },
        parentId: "root",
      },
      {
        id: "unrelated-1",
        type: "file",
        metadata: { name: "unrelated.md" },
        parentId: "root",
      },
    ])
    
    ;(mockProviderWithFiles.getBinary as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      const contents: Record<string, string> = {
        "dialograum-1": dialograumContent,
        "testimonial-1": testimonial1Content,
        "testimonial-2": testimonial2Content,
        "unrelated-1": unrelatedContent,
      }
      const content = contents[id]
      if (!content) {
        throw new Error(`File not found: ${id}`)
      }
      return {
        blob: new Blob([content], { type: "text/markdown" }),
      }
    })
    
    const result = await findRelatedTestimonials({
      provider: mockProviderWithFiles,
      startFileId: "dialograum-1",
    })
    
    expect(result).toHaveLength(2)
    expect(result[0]?.fileId).toBe("testimonial-1")
    expect(result[0]?.author_name).toBe("Max Mustermann")
    expect(result[1]?.fileId).toBe("testimonial-2")
    expect(result[1]?.author_name).toBe("Anna Schmidt")
  })
  
  it("should skip the dialograum file itself", async () => {
    const dialograumId = "dialograum-123"
    const dialograumContent = `---
title: Test Dialograum
dialograum_id: ${dialograumId}
creationDetailViewType: testimonial
---
Body content`
    
    const mockProviderWithSelf = createMockProvider()
    ;(mockProviderWithSelf.getItemById as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === "dialograum-1") {
        return {
          id: "dialograum-1",
          type: "file",
          metadata: { name: "dialograum.md" },
          parentId: "root",
        }
      }
      return null
    })
    ;(mockProviderWithSelf.listItemsById as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "dialograum-1",
        type: "file",
        metadata: { name: "dialograum.md" },
        parentId: "root",
      },
    ])
    ;(mockProviderWithSelf.getBinary as ReturnType<typeof vi.fn>).mockResolvedValue({
      blob: new Blob([dialograumContent], { type: "text/markdown" }),
    })
    
    const result = await findRelatedTestimonials({
      provider: mockProviderWithSelf,
      startFileId: "dialograum-1",
    })
    
    // Sollte leer sein, da die Dialograum-Datei selbst übersprungen wird
    expect(result).toEqual([])
  })
  
  it("should use explicit dialograumId if provided", async () => {
    const explicitId = "explicit-123"
    const testimonialContent = `---
title: Testimonial
dialograum_id: ${explicitId}
creationDetailViewType: testimonial
---
Body`
    
    const mockProvider = createMockProvider()
    ;(mockProvider.listItemsById as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "testimonial-1",
        type: "file",
        metadata: { name: "testimonial.md" },
        parentId: "root",
      },
    ])
    ;(mockProvider.getBinary as ReturnType<typeof vi.fn>).mockResolvedValue({
      blob: new Blob([testimonialContent], { type: "text/markdown" }),
    })
    
    const result = await findRelatedTestimonials({
      provider: mockProvider,
      startFileId: "dialograum-1",
      dialograumId: explicitId,
    })
    
    expect(result).toHaveLength(1)
    expect(result[0]?.dialograum_id).toBe(explicitId)
  })
  
  it("should handle files that cannot be parsed gracefully", async () => {
    const dialograumId = "dialograum-123"
    const dialograumContent = `---
title: Test Dialograum
dialograum_id: ${dialograumId}
---
Body`
    
    const mockProvider = createMockProvider()
    ;(mockProvider.getItemById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "dialograum-1",
      type: "file",
      metadata: { name: "dialograum.md" },
      parentId: "root",
    })
    ;(mockProvider.listItemsById as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "invalid-1",
        type: "file",
        metadata: { name: "invalid.md" },
        parentId: "root",
      },
    ])
    ;(mockProvider.getBinary as ReturnType<typeof vi.fn>).mockImplementation(async (id: string) => {
      if (id === "dialograum-1") {
        return {
          blob: new Blob([dialograumContent], { type: "text/markdown" }),
        }
      }
      // Simuliere Parsing-Fehler
      throw new Error("Parse error")
    })
    
    const result = await findRelatedTestimonials({
      provider: mockProvider,
      startFileId: "dialograum-1",
    })
    
    // Sollte leer sein, da die Datei nicht geparst werden kann
    expect(result).toEqual([])
  })
})

