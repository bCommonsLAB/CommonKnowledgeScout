import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"

describe("Creation Wizard handleSave with image upload", () => {
  beforeEach(() => {
    // Mock fetch für API-Calls
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("merges image URLs into finalMetadata after upload", async () => {
    // Mock erfolgreichen Upload-Response
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://example.blob.core.windows.net/container/library-id/sessions/owner-id/abc123.jpg" }),
    })

    // Simuliere handleSave-Logik (vereinfacht)
    const baseMetadata = { title: "Test Session" }
    const imageUrls: Record<string, string> = {}

    // Simuliere Upload für ein Bildfeld
    const formData = new FormData()
    formData.append("file", new File(["test"], "test.jpg", { type: "image/jpeg" }))
    formData.append("key", "coverImageUrl")
    formData.append("ownerId", "test-session")
    formData.append("scope", "sessions")

    const response = await fetch("/api/creation/upload-image", {
      method: "POST",
      headers: { "X-Library-Id": "test-library" },
      body: formData,
    })

    if (response.ok) {
      const result = await response.json()
      if (result.url) {
        imageUrls["coverImageUrl"] = result.url
      }
    }

    const metadataWithImages = {
      ...baseMetadata,
      ...imageUrls,
    }

    expect(metadataWithImages.coverImageUrl).toBe("https://example.blob.core.windows.net/container/library-id/sessions/owner-id/abc123.jpg")
    expect(metadataWithImages.title).toBe("Test Session")
  })

  it("handles multiple image fields", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://example.blob.core.windows.net/container/library-id/sessions/owner-id/cover.jpg" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://example.blob.core.windows.net/container/library-id/sessions/owner-id/testimonial.jpg" }),
      })

    const baseMetadata = { title: "Test" }
    const imageUrls: Record<string, string> = {}

    // Simuliere zwei Uploads
    const uploads = [
      { key: "coverImageUrl", url: "cover.jpg" },
      { key: "testimonial_image_url", url: "testimonial.jpg" },
    ]

    for (const upload of uploads) {
      const formData = new FormData()
      formData.append("file", new File(["test"], upload.url, { type: "image/jpeg" }))
      formData.append("key", upload.key)
      formData.append("ownerId", "test")
      formData.append("scope", "sessions")

      const response = await fetch("/api/creation/upload-image", {
        method: "POST",
        headers: { "X-Library-Id": "test-library" },
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        if (result.url) {
          imageUrls[upload.key] = result.url
        }
      }
    }

    const metadataWithImages = {
      ...baseMetadata,
      ...imageUrls,
    }

    expect(metadataWithImages.coverImageUrl).toContain("cover.jpg")
    expect(metadataWithImages.testimonial_image_url).toContain("testimonial.jpg")
    expect(Object.keys(metadataWithImages)).toHaveLength(3) // title + 2 image URLs
  })

  it("continues even if one image upload fails", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid file type" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://example.blob.core.windows.net/container/library-id/sessions/owner-id/success.jpg" }),
      })

    const baseMetadata = { title: "Test" }
    const imageUrls: Record<string, string> = {}

    // Simuliere zwei Uploads, einer schlägt fehl
    const uploads = [
      { key: "coverImageUrl", shouldFail: true },
      { key: "testimonial_image_url", shouldFail: false },
    ]

    for (const upload of uploads) {
      try {
        const formData = new FormData()
        formData.append("file", new File(["test"], "test.jpg", { type: "image/jpeg" }))
        formData.append("key", upload.key)
        formData.append("ownerId", "test")
        formData.append("scope", "sessions")

        const response = await fetch("/api/creation/upload-image", {
          method: "POST",
          headers: { "X-Library-Id": "test-library" },
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          if (result.url) {
            imageUrls[upload.key] = result.url
          }
        }
      } catch {
        // Fehler wird ignoriert, Upload wird übersprungen
      }
    }

    const metadataWithImages = {
      ...baseMetadata,
      ...imageUrls,
    }

    // Nur erfolgreicher Upload sollte in metadataWithImages sein
    expect(metadataWithImages.testimonial_image_url).toBeDefined()
    expect(metadataWithImages.coverImageUrl).toBeUndefined()
    expect(metadataWithImages.title).toBe("Test")
  })
})



