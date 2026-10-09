/**
 * Regeln der Perspektiv-Wahl (09.10.2026), abgelesen von der frueheren
 * Perspektiv-Seite: hoechstens fuenf, „nicht festgelegt" allein, leere Wahl
 * wird „nicht festgelegt"; Modell folgt der Sprache und meldet den Tausch.
 */
import { describe, it, expect } from 'vitest'
import type { LlmModelDto, TargetLanguage } from '@ks/contracts'
import { gesperrt, kannSpeichern, modelleFuerSprache, modellNachSprachwechsel, sprachenSortiert, umschalten, zumSpeichern, type PerspektivWahl } from '@ks/module-story/react'

const modell = (modelId: string, order: number, supportedLanguages: string[]): LlmModelDto =>
  ({ _id: modelId, modelId, name: modelId, provider: 'p', supportedLanguages, strengths: '', isActive: true, order, createdAt: '', updatedAt: '' })

const MODELLE = [modell('b', 2, ['de', 'en']), modell('a', 1, ['en']), modell('c', 3, ['de', 'en', 'sw'])]

describe('umschalten / gesperrt', () => {
  it('waehlt an und ab; leere Wahl wird „nicht festgelegt"', () => {
    expect(umschalten(['undefined'], 'ecology')).toEqual(['ecology'])
    expect(umschalten(['ecology', 'business'], 'ecology')).toEqual(['business'])
    expect(umschalten(['ecology'], 'ecology')).toEqual(['undefined'])
  })

  it('hoechstens fuenf; die sechste bleibt aus und ist gesperrt', () => {
    const fuenf = ['technical', 'ecology', 'business', 'educational', 'practical']
    expect(umschalten(fuenf, 'creative')).toEqual(fuenf)
    expect(gesperrt(fuenf, 'creative')).toBe(true)
    expect(gesperrt(fuenf, 'ecology')).toBe(false)
  })

  it('„nicht festgelegt" ist gesperrt, sobald etwas gewaehlt ist', () => {
    expect(gesperrt(['ecology'], 'undefined')).toBe(true)
    expect(gesperrt(['undefined'], 'undefined')).toBe(false)
  })
})

describe('Modell und Sprache', () => {
  it('filtert nach Sprache und sortiert nach Reihenfolge; global nimmt alle', () => {
    expect(modelleFuerSprache(MODELLE, 'de').map((m) => m.modelId)).toEqual(['b', 'c'])
    expect(modelleFuerSprache(MODELLE, 'global').map((m) => m.modelId)).toEqual(['a', 'b', 'c'])
  })

  it('behaelt ein passendes Modell, tauscht ein unpassendes und sagt es', () => {
    expect(modellNachSprachwechsel('b', MODELLE, 'de')).toEqual({ modellId: 'b', gewechselt: false })
    expect(modellNachSprachwechsel('a', MODELLE, 'sw')).toEqual({ modellId: 'c', gewechselt: true })
    expect(modellNachSprachwechsel('', MODELLE, 'de')).toEqual({ modellId: 'b', gewechselt: false })
  })

  it('kein passendes Modell: das bisherige bleibt (der Abschnitt meldet die leere Liste)', () => {
    expect(modellNachSprachwechsel('a', MODELLE, 'yo')).toEqual({ modellId: 'a', gewechselt: false })
  })

  it('Sprachen: global, die Oberflaechensprache, dann nach Name', () => {
    const labels = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch' } as Record<TargetLanguage, string>
    const liste = sprachenSortiert('fr', labels)
    expect(liste.slice(0, 2)).toEqual(['global', 'fr'])
    expect(liste.indexOf('de')).toBeLessThan(liste.indexOf('en'))
  })
})

describe('Speichern', () => {
  const wahl: PerspektivWahl = { targetLanguage: 'de', character: ['undefined', 'ecology'], accessPerspective: ['undefined'], socialContext: 'general', llmModel: 'b' }

  it('entfernt „nicht festgelegt" neben einer Wahl, laesst es allein stehen', () => {
    const out = zumSpeichern(wahl)
    expect(out.character).toEqual(['ecology'])
    expect(out.accessPerspective).toEqual(['undefined'])
  })

  it('braucht ein Modell', () => {
    expect(kannSpeichern(wahl)).toBe(true)
    expect(kannSpeichern({ ...wahl, llmModel: '' })).toBe(false)
  })
})
