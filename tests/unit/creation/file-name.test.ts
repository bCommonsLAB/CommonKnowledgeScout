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
})


