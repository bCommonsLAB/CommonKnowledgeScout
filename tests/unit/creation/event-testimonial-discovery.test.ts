import { describe, it, expect, vi, beforeEach } from "vitest"
import { findRelatedEventTestimonialsFilesystem } from "@/lib/creation/event-testimonial-discovery"
import type { StorageProvider } from "@/lib/storage/types"

type MockItem = { id: string; type: string; metadata: { name?: string }; parentId?: string }

const createMockProvider = () => {
  const items: Record<string, MockItem> = {}
  const binaries: Record<string, string> = {}

  const provider: StorageProvider = {
    getItemById: vi.fn(async (id: string) => items[id] || null),
    listItemsById: vi.fn(async (parentId: string) => Object.values(items).filter((it) => it.parentId === parentId)),
    getBinary: vi.fn(async (id: string) => {
      const content = binaries[id]
      if (content === undefined) throw new Error(`File not found: ${id}`)
      return { blob: new Blob([content], { type: "text/markdown" }), mimeType: "text/markdown" }
    }),
    uploadFile: vi.fn(),
    deleteItem: vi.fn(),
    createFolder: vi.fn(),
  } as unknown as StorageProvider

  return {
    provider,
    addItem: (item: MockItem) => { items[item.id] = item },
    addBinary: (id: string, content: string) => { binaries[id] = content },
  }
}

describe("findRelatedEventTestimonialsFilesystem", () => {
  let mock: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    mock = createMockProvider()
  })

  it("returns [] if event file not found", async () => {
    const res = await findRelatedEventTestimonialsFilesystem({
      provider: mock.provider,
      eventFileId: "missing",
      libraryId: "lib",
    })
    expect(res).toEqual([])
  })

  it("returns [] if no testimonials folder exists", async () => {
    mock.addItem({ id: "event.md", type: "file", metadata: { name: "event.md" }, parentId: "event-folder" })
    const res = await findRelatedEventTestimonialsFilesystem({
      provider: mock.provider,
      eventFileId: "event.md",
      libraryId: "lib",
    })
    expect(res).toEqual([])
  })

  it("prefers markdown files inside testimonial folders", async () => {
    // event file → event folder
    mock.addItem({ id: "event.md", type: "file", metadata: { name: "event.md" }, parentId: "event-folder" })

    // event-folder/testimonials/
    mock.addItem({ id: "testimonials-folder", type: "folder", metadata: { name: "testimonials" }, parentId: "event-folder" })

    // testimonials/<t1>/
    mock.addItem({ id: "t1-folder", type: "folder", metadata: { name: "t1" }, parentId: "testimonials-folder" })
    mock.addItem({ id: "t1-md", type: "file", metadata: { name: "testimonial.md" }, parentId: "t1-folder" })
    mock.addBinary("t1-md", `---\nspeakerName: A\n---\n\nHallo Welt`)

    const res = await findRelatedEventTestimonialsFilesystem({
      provider: mock.provider,
      eventFileId: "event.md",
      libraryId: "lib",
    })

    expect(res).toHaveLength(1)
    expect(res[0]?.kind).toBe("file")
    expect(res[0]?.id).toBe("file-t1-md")
    expect(res[0]?.extractedText).toContain("Hallo Welt")
  })
})

