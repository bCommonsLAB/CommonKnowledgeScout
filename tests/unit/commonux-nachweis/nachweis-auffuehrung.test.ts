// @vitest-environment node
/**
 * Die Aufführung der Nachweis-Seite `/commonux-nachweis` (Bündel `@commonux/player`, gebaut im Repo
 * commoning-methods). Geprüft mit dem Leser aus dem Bündel selbst, ohne React.
 */
import { describe, it, expect } from 'vitest'
import { readSceneFromJson } from '@commonux/player/format'
import szene from '@/components/commonux-nachweis/nachweis-auffuehrung.json'

/** Sichtbare Welt der Bühne (28 × 16) und Größeneinheit der Aufführung (3 Welteinheiten). */
const WELT = { breite: 28, hoehe: 16 }
const GROESSEN_EINHEIT = 3

interface RohDarsteller {
  mediaType?: string
  mediaText?: string
  mediaSizeX?: number
  mediaSizeY?: number
}

interface RohBuehne {
  id: string
  entityStates: Record<string, Record<string, { goToView?: string }>>
}

const app = szene.application as unknown as {
  entities: Record<string, RohDarsteller>
  views: RohBuehne[]
}

describe('Nachweis-Aufführung für den Common UX Player', () => {
  it('liest sich mit dem Leser des Bündels: zwei Bühnen, Themen zuerst', () => {
    const doc = readSceneFromJson(szene)
    expect(doc.application.pages.map((p) => p.id)).toEqual(['themen', 'antwort'])
  })

  it('jeder Bühnenwechsel zielt auf eine Bühne der Aufführung', () => {
    const buehnen = new Set(app.views.map((v) => v.id))
    const ziele = app.views.flatMap((v) =>
      Object.values(v.entityStates).flatMap((phasen) =>
        Object.values(phasen).flatMap((werte) => (werte.goToView ? [werte.goToView] : [])),
      ),
    )
    expect(ziele.length).toBeGreaterThan(0)
    for (const ziel of ziele) expect(buehnen.has(ziel)).toBe(true)
  })

  it('jedes Text-Medium passt in die Welt der Bühne', () => {
    const medien = Object.entries(app.entities).filter(([, d]) => d.mediaText !== undefined)
    expect(medien.length).toBeGreaterThan(0)
    for (const [id, d] of medien) {
      expect(d.mediaType, id).toBe('text')
      expect((d.mediaSizeX ?? 0) * GROESSEN_EINHEIT, id).toBeLessThanOrEqual(WELT.breite)
      expect((d.mediaSizeY ?? 0) * GROESSEN_EINHEIT, id).toBeLessThanOrEqual(WELT.hoehe)
    }
  })
})
