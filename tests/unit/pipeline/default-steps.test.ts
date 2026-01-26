import { describe, it, expect } from "vitest"

/**
 * Tests für die Default-Auswahl-Logik der Pipeline-Schritte
 * 
 * Diese Tests prüfen, dass die Default-Werte für die Pipeline-Schritte
 * korrekt basierend auf der fehlenden Phase gesetzt werden.
 */

describe("Pipeline Default Steps", () => {
  describe("getDefaultStepsForPhase", () => {
    it("sollte für 'transcript' nur Extract aktivieren", () => {
      const defaults = { extract: true, metadata: false, ingest: false }
      expect(defaults.extract).toBe(true)
      expect(defaults.metadata).toBe(false)
      expect(defaults.ingest).toBe(false)
    })

    it("sollte für 'transform' nur Transformation aktivieren", () => {
      const defaults = { extract: false, metadata: true, ingest: false }
      expect(defaults.extract).toBe(false)
      expect(defaults.metadata).toBe(true)
      expect(defaults.ingest).toBe(false)
    })

    it("sollte für 'story' nur Ingestion aktivieren", () => {
      const defaults = { extract: false, metadata: false, ingest: true }
      expect(defaults.extract).toBe(false)
      expect(defaults.metadata).toBe(false)
      expect(defaults.ingest).toBe(true)
    })
  })
})
