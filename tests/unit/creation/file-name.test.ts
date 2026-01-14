import { describe, expect, it } from "vitest"
import { buildCreationFileName } from "@/lib/creation/file-name"

describe("buildCreationFileName", () => {
  it("uses metadata field when configured", () => {
    const res = buildCreationFileName({
      typeId: "session",
      metadata: { title: "Ignoriert", slug: "Mein Titel 2025" },
      config: { metadataFieldKey: "slug", extension: "md" },
      now: new Date("2025-01-02T12:00:00Z"),
    })
    expect(res.fileName).toBe("mein-titel-2025.md")
  })

  it("falls back to title when field is missing", () => {
    const res = buildCreationFileName({
      typeId: "session",
      metadata: { title: "Meine Session" },
      config: { metadataFieldKey: "slug", extension: "md" },
      now: new Date("2025-01-02T12:00:00Z"),
    })
    expect(res.fileName).toBe("meine-session.md")
  })

  it("auto-fills configured field when enabled and empty", () => {
    const res = buildCreationFileName({
      typeId: "session",
      metadata: { title: "Meine Session", slug: "" },
      config: { metadataFieldKey: "slug", autoFillMetadataField: true, extension: "md" },
      now: new Date("2025-01-02T12:00:00Z"),
    })
    expect(res.updatedMetadata.slug).toBe("Meine Session")
    expect(res.fileName).toBe("meine-session.md")
  })

  it("uses fallback prefix + date when nothing is available", () => {
    const res = buildCreationFileName({
      typeId: "session",
      metadata: {},
      config: { fallbackPrefix: "Session", extension: "md" },
      now: new Date("2025-01-02T12:00:00Z"),
    })
    expect(res.fileName).toBe("session-2025-01-02.md")
  })

  it("normalizes extension and avoids duplicate dot", () => {
    const res = buildCreationFileName({
      typeId: "x",
      metadata: { title: "Test" },
      config: { extension: ".md" },
      now: new Date("2025-01-02T12:00:00Z"),
    })
    expect(res.fileName).toBe("test.md")
  })

  it("adds timestamp with milliseconds when ensureUnique is true", () => {
    const res = buildCreationFileName({
      typeId: "testimonial",
      metadata: {},
      config: { fallbackPrefix: "testimonial", extension: "md", ensureUnique: true },
      now: new Date("2025-01-02T14:30:45.123Z"),
    })
    // Sollte Datum + Timestamp mit Millisekunden enthalten: testimonial-2025-01-02-143045123.md
    expect(res.fileName).toMatch(/^testimonial-2025-01-02-\d{9}\.md$/)
    expect(res.fileName).toContain("143045123") // HHMMSSMMM aus 14:30:45.123
  })

  it("does not add timestamp when ensureUnique is false", () => {
    const res = buildCreationFileName({
      typeId: "testimonial",
      metadata: {},
      config: { fallbackPrefix: "testimonial", extension: "md", ensureUnique: false },
      now: new Date("2025-01-02T14:30:45Z"),
    })
    expect(res.fileName).toBe("testimonial-2025-01-02.md")
  })
})


